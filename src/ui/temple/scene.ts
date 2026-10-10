// The 3D temple (three.js). Imperative and self-contained; Temple3D.tsx loads it lazily.
// A round temple: two foundation steps (cold shower, walk with God), six columns in a ring that rise with
// steps toward each pillar, God as the roof above that is always lit and never depends on the columns,
// light falling from the roof onto the fire at the center, and three torches for the Big 3.
import * as THREE from 'three';
import type { Journey } from '../../planner';

export interface TempleState {
  foundation: { coldShower: boolean; walk: boolean };
  pillars: { id: Journey; rise: number }[];
  torches: { done: number; total: number };
  /** EMBER (0.12) to about 1.25. */
  fire: number;
  refiner: boolean;
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

const COLUMN_H = 2.6;
const RING_R = 2.25;
const BASE_Y = 0.5;

function flameTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.65)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

interface Particle {
  sprite: THREE.Sprite;
  age: number;
  life: number;
  vx: number;
  vz: number;
  spark: boolean;
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

  scene.add(new THREE.HemisphereLight(0xfff7e6, 0x6b5a3a, 0.9));
  const godLight = new THREE.DirectionalLight(0xfff1cf, 1.1);
  godLight.position.set(0.5, 8, 2);
  scene.add(godLight);
  const fireLight = new THREE.PointLight(0xffa040, 6, 9, 1.6);
  fireLight.position.set(0, BASE_Y + 0.7, 0);
  world.add(fireLight);

  const stoneMat = () => new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.65, metalness: 0.02 });

  // Foundation: cold shower (lower step), walk with God (upper step).
  const lower = new THREE.Mesh(new THREE.CylinderGeometry(3.35, 3.45, 0.25, 64), stoneMat());
  lower.position.y = 0.125;
  const upper = new THREE.Mesh(new THREE.CylinderGeometry(3.0, 3.1, 0.25, 64), stoneMat());
  upper.position.y = 0.375;
  world.add(lower, upper);

  // Columns.
  const columns: { id: Journey; shaft: THREE.Mesh; cap: THREE.Mesh; base: THREE.Mesh; mat: THREE.MeshStandardMaterial; height: number; target: number }[] = [];
  const shaftGeo = new THREE.CylinderGeometry(0.19, 0.22, 1, 24, 1);
  shaftGeo.translate(0, 0.5, 0);
  const capGeo = new THREE.BoxGeometry(0.55, 0.12, 0.55);
  const baseGeo = new THREE.CylinderGeometry(0.3, 0.32, 0.1, 24);
  const ids: Journey[] = ['faith', 'body', 'sport', 'school', 'shs', 'life'];
  ids.forEach((id, i) => {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const x = Math.sin(a) * RING_R;
    const z = Math.cos(a) * RING_R;
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45, metalness: 0.05, emissive: 0x000000 });
    const shaft = new THREE.Mesh(shaftGeo, mat);
    shaft.position.set(x, BASE_Y + 0.05, z);
    shaft.userData.pillar = id;
    const cap = new THREE.Mesh(capGeo, stoneMat());
    cap.userData.pillar = id;
    const base = new THREE.Mesh(baseGeo, stoneMat());
    base.position.set(x, BASE_Y + 0.05, z);
    base.userData.pillar = id;
    world.add(shaft, cap, base);
    columns.push({ id, shaft, cap, base, mat, height: 0.05, target: 0.25 });
  });

  // God: the roof. It floats above the columns, held up by Him, not by them, and is always lit.
  const roofY = BASE_Y + COLUMN_H + 0.45;
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.35, emissive: 0xffffff, emissiveIntensity: 0.35 });
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(2.85, 2.85, 0.22, 64, 1, true), roofMat);
  ring.position.y = roofY;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(2.75, 64, 24, 0, Math.PI * 2, 0, Math.PI / 2), roofMat);
  dome.scale.y = 0.42;
  dome.position.y = roofY + 0.11;
  const lip = new THREE.Mesh(new THREE.TorusGeometry(2.86, 0.07, 12, 96), roofMat);
  lip.rotation.x = Math.PI / 2;
  lip.position.y = roofY - 0.11;
  const crossMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.3 });
  const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.7, 0.09), crossMat);
  crossV.position.y = roofY + 1.55 - 0.12;
  const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.09, 0.09), crossMat);
  crossH.position.y = roofY + 1.66 - 0.12;
  world.add(ring, dome, lip, crossV, crossH);

  // Light falling from the roof onto the fire.
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xfff1cf, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 1.1, roofY - BASE_Y, 32, 1, true), beamMat);
  beam.position.y = BASE_Y + (roofY - BASE_Y) / 2;
  world.add(beam);

  // The hearth.
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.3, 0.28, 32), new THREE.MeshStandardMaterial({ color: 0x3a2f24, roughness: 0.8, metalness: 0.3 }));
  bowl.position.y = BASE_Y + 0.14;
  bowl.userData.fire = true;
  world.add(bowl);

  // Torches (the Big 3).
  const torchMat = new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 0.8 });
  const torches: { pole: THREE.Mesh; flame: THREE.Sprite; lit: boolean }[] = [];
  const tex = flameTexture();
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.75, 12), torchMat);
    pole.position.set(Math.sin(a) * 1.05, BASE_Y + 0.375, Math.cos(a) * 1.05);
    pole.userData.fire = true;
    const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xffa040, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    flame.position.set(pole.position.x, BASE_Y + 0.85, pole.position.z);
    flame.scale.setScalar(0.3);
    flame.visible = false;
    world.add(pole, flame);
    torches.push({ pole, flame, lit: false });
  }

  // Flame particles.
  const particles: Particle[] = [];
  const flameGroup = new THREE.Group();
  flameGroup.position.y = BASE_Y + 0.28;
  world.add(flameGroup);
  const MAX = 90;
  for (let i = 0; i < MAX; i++) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    sprite.visible = false;
    flameGroup.add(sprite);
    particles.push({ sprite, age: 0, life: 0, vx: 0, vz: 0, spark: false });
  }
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xffb050, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.55 }));
  glow.position.y = BASE_Y + 0.6;
  world.add(glow);

  let state: TempleState | null = null;
  const core = new THREE.Color();
  const mid = new THREE.Color();
  const edge = new THREE.Color();

  function applyColors(c: TempleColors, s: TempleState) {
    const stone = new THREE.Color(c.stone);
    const accent = new THREE.Color(c.accent);
    for (const m of [lower, upper]) (m.material as THREE.MeshStandardMaterial).color.copy(stone);
    const lowerMat = lower.material as THREE.MeshStandardMaterial;
    const upperMat = upper.material as THREE.MeshStandardMaterial;
    const litStone = stone.clone().lerp(accent, 0.45);
    lowerMat.color.copy(s.foundation.coldShower ? litStone : stone);
    lowerMat.emissive.copy(accent).multiplyScalar(s.foundation.coldShower ? 0.18 : 0);
    upperMat.color.copy(s.foundation.walk ? litStone : stone);
    upperMat.emissive.copy(accent).multiplyScalar(s.foundation.walk ? 0.18 : 0);
    // God: light gold, glowing from within.
    roofMat.color.copy(accent).lerp(new THREE.Color(0xffffff), 0.3);
    roofMat.emissive.copy(accent).lerp(new THREE.Color(0xfff3d0), 0.4);
    crossMat.color.set(0xfffaf0);
    crossMat.emissive.set(0xfff3d0);
    for (const col of columns) {
      const p = s.pillars.find((x) => x.id === col.id)!;
      const risen = p.rise > 0.3;
      const pc = new THREE.Color(c.pillars[col.id]);
      col.mat.color.copy(risen ? pc : stone);
      col.mat.emissive.copy(pc).multiplyScalar(risen ? 0.18 : 0);
      (col.cap.material as THREE.MeshStandardMaterial).color.copy(stone);
      (col.base.material as THREE.MeshStandardMaterial).color.copy(stone);
      col.target = p.rise;
    }
    if (s.refiner) {
      core.set(0xffffff);
      mid.set(0x8ccaff);
      edge.set(0xffc04d);
    } else {
      core.set(0xfff3c4);
      mid.set(0xffa040);
      edge.set(0xd9481c);
    }
    torches.forEach((t, i) => {
      t.lit = i < s.torches.done;
      t.flame.visible = t.lit;
      t.flame.material.color.copy(mid);
    });
    (glow.material as THREE.SpriteMaterial).color.copy(mid);
    fireLight.color.copy(mid);
  }

  // Interaction: drag to turn, tap a column or the fire.
  let yaw = 0.35;
  let pitch = 0.2;
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
    pitch = Math.min(0.7, Math.max(0.05, pitch + dy * 0.004));
    idle = 0;
  };
  const onUp = (e: PointerEvent) => {
    dragging = false;
    if (moved > 8) return;
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(world.children, false).find((h) => h.object.userData.pillar || h.object.userData.fire);
    if (hit?.object.userData.pillar) opts.onPillar?.(hit.object.userData.pillar as Journey);
    else if (hit?.object.userData.fire) opts.onFire?.();
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', () => (dragging = false));

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

  let frame = 0;
  let last = performance.now();
  let running = false;
  function spawn(p: Particle, f: number) {
    const spark = Math.random() < 0.12 * f;
    p.spark = spark;
    p.age = 0;
    p.life = spark ? 1.2 + Math.random() * 1.2 : 0.55 + Math.random() * 0.5;
    p.vx = (Math.random() - 0.5) * (spark ? 0.5 : 0.18);
    p.vz = (Math.random() - 0.5) * (spark ? 0.5 : 0.18);
    p.sprite.position.set((Math.random() - 0.5) * 0.28, 0, (Math.random() - 0.5) * 0.28);
    p.sprite.visible = true;
  }

  function step(dt: number, t: number, elapsed: number) {
    if (!state) return;
    const f = Math.max(0.12, state.fire);
    // Columns rise toward their target.
    for (const col of columns) {
      // By real time elapsed, so a throttled device (few frames) still finishes rising.
      col.height += (col.target - col.height) * (1 - Math.exp(-elapsed * 2.2));
      const h = Math.max(0.05, col.height) * COLUMN_H;
      col.shaft.scale.y = h;
      col.cap.position.set(col.shaft.position.x, BASE_Y + 0.05 + h + 0.06, col.shaft.position.z);
    }
    // Fire.
    const active = Math.round(MAX * Math.min(1, 0.25 + 0.75 * Math.min(1, f)));
    const height = 0.55 + 1.5 * Math.min(1.3, f);
    for (let i = 0; i < MAX; i++) {
      const p = particles[i]!;
      if (i >= active) {
        p.sprite.visible = false;
        continue;
      }
      if (!p.sprite.visible || p.age >= p.life) {
        if (Math.random() < 0.35 || !p.sprite.visible) spawn(p, f);
        else p.sprite.visible = false;
        continue;
      }
      p.age += dt;
      const k = p.age / p.life;
      const rise = p.spark ? height * 1.6 : height;
      p.sprite.position.y = k * rise;
      p.sprite.position.x += p.vx * dt + Math.sin(t * 6 + i) * 0.002;
      p.sprite.position.z += p.vz * dt;
      const size = p.spark ? 0.06 : (0.55 - 0.4 * k) * (0.6 + 0.5 * Math.min(1.2, f));
      p.sprite.scale.setScalar(size);
      const m = p.sprite.material;
      if (p.spark) m.color.copy(edge).lerp(core, 0.5);
      else if (k < 0.3) m.color.copy(core).lerp(mid, k / 0.3);
      else m.color.copy(mid).lerp(edge, (k - 0.3) / 0.7);
      m.opacity = (1 - k) * (p.spark ? 0.9 : 0.75);
    }
    const flick = 1 + Math.sin(t * 11) * 0.06 + Math.sin(t * 17) * 0.04;
    fireLight.intensity = (3 + 12 * Math.min(1.3, f)) * flick;
    glow.scale.setScalar((1.2 + 2.2 * Math.min(1.3, f)) * flick);
    (glow.material as THREE.SpriteMaterial).opacity = 0.35 + 0.3 * Math.min(1, f);
    beamMat.opacity = 0.05 + 0.05 * Math.sin(t * 0.8) ** 2;
    for (const tr of torches) if (tr.lit) tr.flame.scale.setScalar(0.32 * flick);
    // Camera.
    if (!dragging) {
      vyaw *= 0.94;
      yaw += vyaw;
      idle += dt;
      if (!opts.reducedMotion && idle > 2) yaw += dt * 0.12;
    }
    const r = 12.5;
    camera.position.set(Math.sin(yaw) * Math.cos(pitch) * r, 2.1 + Math.sin(pitch) * r, Math.cos(yaw) * Math.cos(pitch) * r);
    camera.lookAt(0, 2.05, 0);
  }

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
      const firstUpdate = !state;
      state = s;
      applyColors(c, s);
      if (firstUpdate) for (const col of columns) col.height = 0.05;
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
