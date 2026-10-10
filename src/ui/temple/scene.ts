// The 3D temple (three.js). Imperative and self-contained; Temple3D.tsx loads it lazily.
// A round Roman temple under a veil of light (God: always there, covering everything, even on a day when
// nothing got done). Six fluted columns rise with the week's progress toward each pillar. At the center
// lives the fire, a little flame with a face; the Big 3 are small flames that hop into it when done and
// pop back out if unchecked. The foundation is the cold shower and the walk with God.
import * as THREE from 'three';
import type { Journey } from '../../planner';

export interface TempleState {
  foundation: { coldShower: boolean; walk: boolean };
  /** rise: this week's progress (0 to 1); today: counted today (the column glows). */
  pillars: { id: Journey; rise: number; today: boolean }[];
  /** One little flame per Big 3 item. */
  buddies: { pillar: Journey; done: boolean }[];
  /** EMBER (0.12) to about 1.25. */
  fire: number;
  level: 'ember' | 'flame' | 'blaze' | 'bright' | 'refiner';
}

export interface TempleColors {
  stone: string;
  accent: string;
  muted: string;
  pillars: Record<Journey, string>;
}

export interface TempleHandle {
  update(state: TempleState, colors: TempleColors): void;
  dispose(): void;
}

export interface TempleOptions {
  onPillar?: (id: Journey) => void;
  onFire?: () => void;
  reducedMotion: boolean;
}

const COLUMN_H = 2.5;
const RING_R = 2.3;
const BASE_Y = 0.5;
const MIN_RISE = 0.22;

// ---------- Roman column ----------

/** A fluted shaft (20 flutes) with a gentle entasis, 1 unit tall, base at y = 0. */
function shaftGeometry(): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(0.2, 0.2, 1, 80, 12);
  g.translate(0, 0.5, 0);
  const p = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const r = Math.hypot(v.x, v.z);
    if (r < 0.01) continue;
    const a = Math.atan2(v.z, v.x);
    const flute = 1 - 0.07 * Math.max(0, Math.cos(a * 20));
    const entasis = 1.08 - 0.16 * v.y + 0.05 * Math.sin(Math.PI * v.y);
    const k = flute * entasis;
    p.setXYZ(i, v.x * k, v.y, v.z * k);
  }
  g.computeVertexNormals();
  return g;
}

const lathe = (pts: [number, number][], segments = 40) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), segments);

/** Attic base: plinth, torus, scotia, torus. */
function baseGeometry(): THREE.BufferGeometry {
  return lathe([
    [0, 0],
    [0.33, 0],
    [0.33, 0.06],
    [0.31, 0.07],
    [0.3, 0.1],
    [0.31, 0.13],
    [0.27, 0.15],
    [0.24, 0.16],
    [0.25, 0.18],
    [0.24, 0.2],
    [0.21, 0.21],
    [0, 0.21],
  ]);
}

/** Ionic capital: echinus, abacus, and a scroll volute on each side. */
function capital(mat: THREE.Material, geo: { echinus: THREE.BufferGeometry; abacus: THREE.BufferGeometry; scroll: THREE.BufferGeometry }): THREE.Group {
  const g = new THREE.Group();
  const echinus = new THREE.Mesh(geo.echinus, mat);
  const abacus = new THREE.Mesh(geo.abacus, mat);
  abacus.position.y = 0.145;
  g.add(echinus, abacus);
  for (const side of [-1, 1]) {
    const scroll = new THREE.Mesh(geo.scroll, mat);
    scroll.rotation.y = Math.PI / 2;
    scroll.position.set(side * 0.27, 0.07, 0);
    g.add(scroll);
  }
  return g;
}

// ---------- The flame character ----------

const FLAME_VERT = `
uniform float uTime;
varying float vH;
varying vec3 vNormal;
varying vec3 vView;
void main() {
  vec3 p = position;
  float h = clamp(p.y / 1.5, 0.0, 1.0);
  p.x += sin(uTime * 3.1 + p.y * 3.0) * 0.05 * h * h;
  p.z += cos(uTime * 2.7 + p.y * 2.6) * 0.04 * h * h;
  vH = h;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vNormal = normalize(normalMatrix * normal);
  vView = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;

const FLAME_FRAG = `
uniform vec3 uCore;
uniform vec3 uMid;
uniform vec3 uEdge;
varying float vH;
varying vec3 vNormal;
varying vec3 vView;
void main() {
  float rim = pow(1.0 - max(dot(vNormal, vView), 0.0), 1.6);
  vec3 c = mix(uCore, uMid, smoothstep(0.05, 0.55, vH));
  c = mix(c, uEdge, smoothstep(0.55, 1.0, vH));
  c = mix(c, uEdge, rim * 0.5);
  gl_FragColor = vec4(c, 1.0);
}`;

/** A round-bottomed teardrop: a little flame body, about 1.5 tall. */
function flameGeometry(): THREE.BufferGeometry {
  const pts: [number, number][] = [];
  const R = 0.55;
  for (let i = 0; i <= 14; i++) {
    const a = -Math.PI / 2 + (i / 14) * (Math.PI / 2);
    pts.push([Math.cos(a) * R, R + Math.sin(a) * R]);
  }
  for (let i = 1; i <= 16; i++) {
    const k = i / 16;
    pts.push([R * Math.pow(1 - k, 1.5), R + k * 0.95]);
  }
  return lathe(pts, 40);
}

interface FlameParts {
  body: THREE.BufferGeometry;
  eye: THREE.BufferGeometry;
  shine: THREE.BufferGeometry;
  mouth: THREE.BufferGeometry;
  cheek: THREE.BufferGeometry;
}

interface Flame {
  group: THREE.Group;
  mat: THREE.ShaderMaterial;
  setColors(core: THREE.Color, mid: THREE.Color, edge: THREE.Color): void;
  setMood(m: 'sleepy' | 'happy' | 'beaming'): void;
  blink(amount: number): void;
}

function makeFlame(parts: FlameParts): Flame {
  const group = new THREE.Group();
  const mat = new THREE.ShaderMaterial({
    vertexShader: FLAME_VERT,
    fragmentShader: FLAME_FRAG,
    uniforms: {
      uTime: { value: 0 },
      uCore: { value: new THREE.Color(0xfff3c4) },
      uMid: { value: new THREE.Color(0xffa040) },
      uEdge: { value: new THREE.Color(0xe8572a) },
    },
  });
  group.add(new THREE.Mesh(parts.body, mat));
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x3b2316 });
  const shineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const eyes: THREE.Mesh[] = [];
  for (const x of [-0.17, 0.17]) {
    const eye = new THREE.Mesh(parts.eye, eyeMat);
    eye.position.set(x, 0.66, 0.5);
    eye.scale.set(1, 1.35, 0.5);
    const shine = new THREE.Mesh(parts.shine, shineMat);
    shine.position.set(0.025, 0.035, 0.06);
    eye.add(shine);
    group.add(eye);
    eyes.push(eye);
  }
  const mouth = new THREE.Mesh(parts.mouth, eyeMat);
  mouth.position.set(0, 0.5, 0.535);
  mouth.rotation.z = Math.PI;
  group.add(mouth);
  const cheekMat = new THREE.MeshBasicMaterial({ color: 0xff8a8a, transparent: true, opacity: 0.55, depthWrite: false });
  const blush: THREE.Mesh[] = [];
  for (const x of [-0.31, 0.31]) {
    const c = new THREE.Mesh(parts.cheek, cheekMat);
    c.position.set(x, 0.52, 0.47);
    c.rotation.y = x * 0.9;
    group.add(c);
    blush.push(c);
  }
  let mood: 'sleepy' | 'happy' | 'beaming' = 'happy';
  let blinkK = 0;
  const applyEyes = () => {
    const open = mood === 'sleepy' ? 0.3 : 1;
    for (const e of eyes) e.scale.y = Math.max(0.12, 1.35 * open * (1 - blinkK * 0.9));
  };
  return {
    group,
    mat,
    setColors(core, mid, edge) {
      (mat.uniforms.uCore!.value as THREE.Color).copy(core);
      (mat.uniforms.uMid!.value as THREE.Color).copy(mid);
      (mat.uniforms.uEdge!.value as THREE.Color).copy(edge);
    },
    setMood(m) {
      mood = m;
      mouth.scale.setScalar(m === 'beaming' ? 1.35 : m === 'sleepy' ? 0.7 : 1);
      for (const c of blush) c.visible = m !== 'sleepy';
      applyEyes();
    },
    blink(k) {
      blinkK = k;
      applyEyes();
    },
  };
}

// ---------- The veil ----------

const VEIL_VERT = `
uniform float uTime;
varying vec3 vNormal;
varying vec3 vView;
varying float vY;
void main() {
  vec3 p = position;
  float a = atan(p.x, p.z);
  p += normal * sin(uTime * 0.7 + p.y * 1.8 + a * 3.0) * 0.045;
  vY = p.y;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vNormal = normalize(normalMatrix * normal);
  vView = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;

const VEIL_FRAG = `
uniform vec3 uColor;
uniform float uTime;
varying vec3 vNormal;
varying vec3 vView;
varying float vY;
void main() {
  float f = pow(1.0 - abs(dot(vNormal, vView)), 2.2);
  float shimmer = 0.85 + 0.15 * sin(uTime * 0.9 + vY * 2.0);
  float alpha = (0.05 + 0.42 * f) * shimmer;
  gl_FragColor = vec4(uColor * (0.85 + 0.6 * f), alpha);
}`;

// ---------- Scene ----------

function sparkTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.6)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

type BuddyPhase = 'out' | 'in' | 'hopIn' | 'popOut';

interface Buddy {
  flame: Flame;
  home: THREE.Vector3;
  phase: BuddyPhase;
  t: number;
}

export function createTemple(canvas: HTMLCanvasElement, opts: TempleOptions): TempleHandle {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  const world = new THREE.Group();
  scene.add(world);

  scene.add(new THREE.HemisphereLight(0xfff7e6, 0x8a7550, 1.0));
  const sun = new THREE.DirectionalLight(0xfff1cf, 1.2);
  sun.position.set(3, 8, 5);
  scene.add(sun);
  const fireLight = new THREE.PointLight(0xffa040, 5, 7, 1.6);
  fireLight.position.set(0, BASE_Y + 0.8, 0);
  world.add(fireLight);

  const marble = () => new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0.02 });

  // Foundation: the cold shower (lower step) and the walk with God (upper step).
  const lowerMat = marble();
  const upperMat = marble();
  const lower = new THREE.Mesh(new THREE.CylinderGeometry(3.35, 3.45, 0.25, 72), lowerMat);
  lower.position.y = 0.125;
  const upper = new THREE.Mesh(new THREE.CylinderGeometry(3.0, 3.1, 0.25, 72), upperMat);
  upper.position.y = 0.375;
  world.add(lower, upper);

  // Columns.
  const shaftGeo = shaftGeometry();
  const baseGeo = baseGeometry();
  const capGeo = {
    echinus: lathe([
      [0, 0],
      [0.2, 0],
      [0.24, 0.04],
      [0.27, 0.09],
      [0.27, 0.11],
      [0, 0.11],
    ]),
    abacus: new THREE.BoxGeometry(0.62, 0.07, 0.46),
    scroll: new THREE.TorusGeometry(0.075, 0.03, 10, 24, Math.PI * 1.7),
  };
  const ids: Journey[] = ['faith', 'body', 'sport', 'school', 'shs', 'life'];
  const columns = ids.map((id, i) => {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const x = Math.sin(a) * RING_R;
    const z = Math.cos(a) * RING_R;
    const shaftMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.42, metalness: 0.04, emissive: 0x000000 });
    const stoneMat = marble();
    const base = new THREE.Mesh(baseGeo, stoneMat);
    base.position.set(x, BASE_Y, z);
    const shaft = new THREE.Mesh(shaftGeo, shaftMat);
    shaft.position.set(x, BASE_Y + 0.2, z);
    const cap = capital(stoneMat, capGeo);
    cap.position.set(x, BASE_Y + 0.2, z);
    cap.rotation.y = a;
    for (const o of [base, shaft, ...cap.children]) o.userData.pillar = id;
    world.add(base, shaft, cap);
    return { id, shaft, cap, shaftMat, stoneMat, pc: new THREE.Color(), height: MIN_RISE, target: MIN_RISE, today: false };
  });

  // The veil: God over everything, always.
  const veilMat = new THREE.ShaderMaterial({
    vertexShader: VEIL_VERT,
    fragmentShader: VEIL_FRAG,
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(0xfff1cf) } },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const veil = new THREE.Mesh(new THREE.SphereGeometry(3.75, 72, 36, 0, Math.PI * 2, 0, Math.PI * 0.56), veilMat);
  veil.scale.y = 1.12;
  veil.position.y = 0.35;
  veil.raycast = () => undefined;
  world.add(veil);
  const crossMat = new THREE.MeshStandardMaterial({ color: 0xfffaf0, emissive: 0xfff1cf, emissiveIntensity: 0.8, roughness: 0.4, transparent: true, opacity: 0.85 });
  const cross = new THREE.Group();
  const cv = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.46, 0.07), crossMat);
  const ch = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.07, 0.07), crossMat);
  ch.position.y = 0.08;
  cross.add(cv, ch);
  cross.position.y = 0.35 + 3.75 * 1.12 + 0.3;
  world.add(cross);

  // Hearth: a ring of round stones, the cozy kind.
  const pebbleMat = new THREE.MeshStandardMaterial({ color: 0x9c8f7c, roughness: 0.9 });
  const pebbleGeo = new THREE.SphereGeometry(0.11, 14, 10);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const p = new THREE.Mesh(pebbleGeo, pebbleMat);
    p.position.set(Math.sin(a) * 0.62, BASE_Y + 0.06, Math.cos(a) * 0.62);
    p.scale.set(1.2, 0.7, 1);
    world.add(p);
  }

  // The fire: a little flame with a face.
  const parts: FlameParts = {
    body: flameGeometry(),
    eye: new THREE.SphereGeometry(0.07, 16, 12),
    shine: new THREE.SphereGeometry(0.022, 8, 6),
    mouth: new THREE.TorusGeometry(0.075, 0.017, 8, 20, Math.PI),
    cheek: new THREE.CircleGeometry(0.06, 20),
  };
  const fire = makeFlame(parts);
  fire.group.position.y = BASE_Y + 0.02;
  fire.group.traverse((o) => (o.userData.fire = true));
  world.add(fire.group);

  // Sparks above the fire.
  const tex = sparkTexture();
  const sparks: { s: THREE.Sprite; age: number; life: number; vx: number; vz: number }[] = [];
  for (let i = 0; i < 26; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xffc060, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    s.visible = false;
    world.add(s);
    sparks.push({ s, age: 1, life: 1, vx: 0, vz: 0 });
  }
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xffb050, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.5 }));
  glow.position.y = BASE_Y + 0.8;
  world.add(glow);

  // Big 3 buddies.
  const buddies: Buddy[] = [];
  const homeFor = (i: number, n: number) => {
    const a = (i / Math.max(n, 1)) * Math.PI * 2 + 0.6;
    return new THREE.Vector3(Math.sin(a) * 1.25, BASE_Y, Math.cos(a) * 1.25);
  };
  function syncBuddies(list: TempleState['buddies'], colors: TempleColors, animate: boolean) {
    while (buddies.length > list.length) world.remove(buddies.pop()!.flame.group);
    list.forEach((item, i) => {
      let b = buddies[i];
      if (!b) {
        const flame = makeFlame(parts);
        flame.group.scale.setScalar(0.34);
        flame.group.traverse((o) => (o.userData.fire = true));
        world.add(flame.group);
        b = { flame, home: homeFor(i, list.length), phase: item.done ? 'in' : 'out', t: 1 };
        buddies.push(b);
      }
      b.home = homeFor(i, list.length);
      const pc = new THREE.Color(colors.pillars[item.pillar]);
      b.flame.setColors(new THREE.Color(0xfff6dc), new THREE.Color(0xffb04a).lerp(pc, 0.45), pc.clone().lerp(new THREE.Color(0xe8572a), 0.3));
      b.flame.setMood('happy');
      const isIn = b.phase === 'in' || b.phase === 'hopIn';
      if (item.done && !isIn) {
        b.phase = animate ? 'hopIn' : 'in';
        b.t = 0;
      } else if (!item.done && isIn) {
        b.phase = animate ? 'popOut' : 'out';
        b.t = 0;
      }
    });
  }

  let state: TempleState | null = null;
  let puff = 0;
  const core = new THREE.Color();
  const mid = new THREE.Color();
  const edge = new THREE.Color();

  function applyColors(c: TempleColors, s: TempleState, animate: boolean) {
    const stone = new THREE.Color(c.stone).lerp(new THREE.Color(0xf4efe4), 0.35);
    const accent = new THREE.Color(c.accent);
    const lit = stone.clone().lerp(accent, 0.45);
    lowerMat.color.copy(s.foundation.coldShower ? lit : stone);
    lowerMat.emissive.copy(accent).multiplyScalar(s.foundation.coldShower ? 0.16 : 0);
    upperMat.color.copy(s.foundation.walk ? lit : stone);
    upperMat.emissive.copy(accent).multiplyScalar(s.foundation.walk ? 0.16 : 0);
    for (const col of columns) {
      const p = s.pillars.find((x) => x.id === col.id)!;
      col.pc.set(c.pillars[col.id]);
      // Marble, tinted more as the week comes along.
      col.shaftMat.color.copy(stone).lerp(col.pc, 0.25 + 0.55 * p.rise);
      col.stoneMat.color.copy(stone);
      col.target = Math.max(MIN_RISE, p.rise);
      col.today = p.today;
    }
    (veilMat.uniforms.uColor!.value as THREE.Color).copy(accent).lerp(new THREE.Color(0xfff6e0), 0.65);
    if (s.level === 'refiner') {
      // Refiner's fire: white-hot at the core, gold, with a blue edge. Still a fire.
      core.set(0xffffff);
      mid.set(0xffd66b);
      edge.set(0x5aa9f0);
    } else {
      core.set(0xfff3c4);
      mid.set(0xffa040);
      edge.set(0xe8572a);
    }
    fire.setColors(core, mid, edge);
    fire.setMood(s.level === 'ember' ? 'sleepy' : s.level === 'flame' ? 'happy' : 'beaming');
    (glow.material as THREE.SpriteMaterial).color.copy(mid);
    fireLight.color.copy(mid);
    syncBuddies(s.buddies, c, animate);
  }

  // Interaction: drag to turn, tap a column or the fire.
  let yaw = 0.35;
  let pitch = 0.18;
  let vyaw = 0;
  let dragging = false;
  let moved = 0;
  let lastX = 0;
  let lastY = 0;
  let idle = 0;
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const onDown = (e: PointerEvent) => {
    dragging = true;
    moved = 0;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    moved += Math.abs(dx) + Math.abs(dy);
    vyaw = dx * 0.008;
    yaw += vyaw;
    pitch = Math.min(0.7, Math.max(0.04, pitch + dy * 0.004));
    idle = 0;
  };
  const onUp = (e: PointerEvent) => {
    dragging = false;
    if (moved > 8) return;
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(world.children, true).find((h) => h.object.visible && (h.object.userData.pillar || h.object.userData.fire));
    if (hit?.object.userData.pillar) opts.onPillar?.(hit.object.userData.pillar as Journey);
    else if (hit?.object.userData.fire) opts.onFire?.();
  };
  const onCancel = () => (dragging = false);
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onCancel);

  function resize() {
    const w = canvas.clientWidth || 300;
    const h = canvas.clientHeight || 280;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  let visible = true;
  const io = new IntersectionObserver(([en]) => {
    visible = !!en?.isIntersecting;
    if (visible) loop();
  });
  io.observe(canvas);
  const onVis = () => {
    if (!document.hidden) loop();
  };
  document.addEventListener('visibilitychange', onVis);

  let nextBlink = 2.5;
  let blinkT = -1;
  const camTarget = new THREE.Vector3(0, 1.9, 0);
  const center = new THREE.Vector3();

  function step(dt: number, t: number, elapsed: number) {
    if (!state) return;
    const f = Math.max(0.12, state.fire);
    // Columns rise toward the week's progress (by real time, so a throttled device still gets there).
    const k = 1 - Math.exp(-elapsed * 2.2);
    for (const col of columns) {
      col.height += (col.target - col.height) * k;
      const h = col.height * COLUMN_H;
      col.shaft.scale.y = h;
      col.cap.position.y = BASE_Y + 0.2 + h;
      col.shaftMat.emissive.copy(col.pc).multiplyScalar(col.today ? 0.18 + 0.1 * Math.sin(t * 2.4) : 0.04);
    }
    // The fire: size and bounce follow its strength; a puff when a buddy hops in.
    puff = Math.max(0, puff - dt * 1.6);
    const size = 0.55 + 0.55 * Math.min(1.25, f) + puff * 0.25;
    const bounce = state.level === 'bright' || state.level === 'refiner' ? Math.abs(Math.sin(t * 2.2)) * 0.06 : Math.sin(t * 1.6) * 0.02;
    fire.group.scale.set(size * (1 + puff * 0.1), size * (1 - puff * 0.05), size);
    fire.group.position.y = BASE_Y + 0.02 + bounce;
    fire.mat.uniforms.uTime!.value = t;
    fire.group.rotation.y = yaw;
    // Blink now and then.
    nextBlink -= dt;
    if (nextBlink <= 0 && blinkT < 0) blinkT = 0;
    if (blinkT >= 0) {
      blinkT += dt;
      const b = blinkT < 0.08 ? blinkT / 0.08 : blinkT < 0.16 ? 1 - (blinkT - 0.08) / 0.08 : 0;
      fire.blink(b);
      if (blinkT >= 0.16) {
        blinkT = -1;
        nextBlink = 2.5 + Math.random() * 3;
        fire.blink(0);
      }
    }
    const flick = 1 + Math.sin(t * 9) * 0.05 + Math.sin(t * 15) * 0.03;
    fireLight.intensity = (2.5 + 9 * Math.min(1.25, f)) * flick;
    glow.scale.setScalar((1.4 + 2.4 * Math.min(1.25, f)) * flick);
    (glow.material as THREE.SpriteMaterial).opacity = 0.28 + 0.3 * Math.min(1, f);
    veilMat.uniforms.uTime!.value = t;
    // Sparks.
    const active = Math.round(6 + 20 * Math.min(1, f));
    sparks.forEach((p, i) => {
      if (i >= active) {
        p.s.visible = false;
        return;
      }
      p.age += dt;
      if (p.age >= p.life) {
        p.age = 0;
        p.life = 0.9 + Math.random() * 1.1;
        p.vx = (Math.random() - 0.5) * 0.4;
        p.vz = (Math.random() - 0.5) * 0.4;
        p.s.position.set((Math.random() - 0.5) * 0.3, BASE_Y + 0.9 * size, (Math.random() - 0.5) * 0.3);
        p.s.visible = true;
      }
      const q = p.age / p.life;
      p.s.position.y += dt * (0.7 + 0.6 * f);
      p.s.position.x += p.vx * dt;
      p.s.position.z += p.vz * dt;
      p.s.scale.setScalar(0.07 * (1 - q) + 0.02);
      p.s.material.color.copy(mid).lerp(core, 0.4);
      p.s.material.opacity = (1 - q) * 0.9;
    });
    // Buddies: wait and bob at home, hop into the fire when done, pop back out when unchecked.
    center.set(0, BASE_Y + 0.4 * size, 0);
    buddies.forEach((b, i) => {
      const g = b.flame.group;
      b.flame.mat.uniforms.uTime!.value = t + i;
      g.rotation.y = yaw;
      if (b.phase === 'out') {
        g.visible = true;
        g.position.set(b.home.x, b.home.y + Math.abs(Math.sin(t * 2.4 + i * 1.7)) * 0.08, b.home.z);
        g.scale.setScalar(0.34);
        return;
      }
      if (b.phase === 'in') {
        g.visible = false;
        return;
      }
      b.t = Math.min(1, b.t + dt / 0.75);
      const p = b.phase === 'hopIn' ? b.t : 1 - b.t;
      g.position.copy(b.home).lerp(center, p);
      g.position.y += Math.sin(Math.PI * p) * 1.1;
      g.scale.setScalar(0.34 * (1 - 0.6 * Math.max(0, (p - 0.75) / 0.25)));
      g.visible = true;
      if (b.t >= 1) {
        if (b.phase === 'hopIn') {
          b.phase = 'in';
          g.visible = false;
          puff = 1;
        } else b.phase = 'out';
      }
    });
    // Camera.
    if (!dragging) {
      vyaw *= 0.94;
      yaw += vyaw;
      idle += dt;
      if (!opts.reducedMotion && idle > 2) yaw += dt * 0.1;
    }
    const r = 13;
    camera.position.set(Math.sin(yaw) * Math.cos(pitch) * r, 2.2 + Math.sin(pitch) * r, Math.cos(yaw) * Math.cos(pitch) * r);
    camera.lookAt(camTarget);
  }

  let frame = 0;
  let last = performance.now();
  let running = false;
  function loop() {
    if (running) return;
    running = true;
    last = performance.now();
    const tick = (now: number) => {
      if (!visible || document.hidden) {
        running = false;
        return;
      }
      // About 30 frames a second when nobody is touching it (battery); full speed while dragging.
      if (!dragging && now - last < 30) {
        frame = requestAnimationFrame(tick);
        return;
      }
      const elapsed = Math.min(2, (now - last) / 1000);
      const dt = Math.min(0.05, elapsed);
      last = now;
      step(opts.reducedMotion ? dt * 0.5 : dt, now / 1000, elapsed);
      renderer.render(scene, camera);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
  }

  return {
    update(s, c) {
      const animate = !!state && !opts.reducedMotion;
      if (!state) for (const col of columns) col.height = MIN_RISE * 0.5;
      state = s;
      applyColors(c, s, animate);
      loop();
    },
    dispose() {
      cancelAnimationFrame(frame);
      running = false;
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onCancel);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose();
      });
      tex.dispose();
      renderer.dispose();
    },
  };
}
