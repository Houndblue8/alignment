import type { CSSProperties } from 'react';
import type { Journey } from '../planner';
import type { FireState } from '../state/fire';
import type { BuildingState } from '../state/temple';

export const SHORT: Record<Journey, string> = {
  faith: 'Faith',
  body: 'Stewardship',
  sport: 'Athletics',
  school: 'Academics',
  shs: 'Hustle',
  life: 'Social',
};

export function buildingLabel(b: BuildingState, fire?: FireState): string {
  const f = fire ? ` The fire: ${fire.pct} percent.` : '';
  return `Today's temple under God's veil. Foundation ${Number(b.foundation.water) + Number(b.foundation.coldShower) + Number(b.foundation.walk)} of 3, ${b.pillars.filter((p) => p.done >= p.target).length} of 6 pillars at this week's target, ${b.torches.done} of ${b.torches.total} little flames in the fire.${f}`;
}

const W = 340;
const CX = W / 2;
const RING = 112;
const DEPTH = 20;
const FLOOR = 222;

/** One Roman column: attic base, fluted shaft, Ionic capital with volutes. */
function Column({ x, y, h, s, id, ratio, today }: { x: number; y: number; h: number; s: number; id: Journey; ratio: number; today: boolean }) {
  const w = 18 * s;
  const fill: CSSProperties = { fill: `color-mix(in srgb, var(--j-${id}) ${Math.round(22 + 55 * ratio)}%, var(--card))` };
  return (
    <g className={`col ${today ? 'today' : ''}`} style={{ ['--jc' as string]: `var(--j-${id})` }}>
      <rect className="stone" x={x - w * 0.75} y={y - 5 * s} width={w * 1.5} height={5 * s} rx={1.5} />
      <rect className="shaft" x={x - w / 2} y={y - 5 * s - h} width={w} height={h} style={fill} />
      <line className="flute" x1={x - w / 6} x2={x - w / 6} y1={y - 5 * s - h + 3} y2={y - 8 * s} />
      <line className="flute" x1={x + w / 6} x2={x + w / 6} y1={y - 5 * s - h + 3} y2={y - 8 * s} />
      <rect className="stone" x={x - w * 0.8} y={y - 5 * s - h - 6 * s} width={w * 1.6} height={6 * s} rx={1.5} />
      <circle className="stone" cx={x - w * 0.7} cy={y - 5 * s - h - 1.5 * s} r={3 * s} />
      <circle className="stone" cx={x + w * 0.7} cy={y - 5 * s - h - 1.5 * s} r={3 * s} />
    </g>
  );
}

/** A little flame with a face. The main fire, and the Big 3 flames waiting to hop in. */
export function FlameFace({ x, y, size, mood, pillar }: { x: number; y: number; size: number; mood: 'sleepy' | 'happy' | 'beaming'; pillar?: Journey }) {
  const h = 54 * size;
  const r = 20 * size;
  const style = pillar ? ({ ['--jc' as string]: `var(--j-${pillar})` } as CSSProperties) : undefined;
  return (
    <g className={pillar ? 'buddy' : 'hero-flame'} style={style}>
      {/* Two tongues behind the body, and a tip that leans: a fire, not a drop. Same shape as the app icon. */}
      <path
        className="flame-tongue"
        d={`M${x - r * 0.55} ${y - h * 0.12} C ${x - r * 1.45} ${y - h * 0.3}, ${x - r * 1.35} ${y - h * 0.55}, ${x - r * 1.05} ${y - h * 0.78} C ${x - r * 0.95} ${y - h * 0.55}, ${x - r * 0.55} ${y - h * 0.5}, ${x - r * 0.3} ${y - h * 0.42} Z`}
      />
      <path
        className="flame-tongue"
        d={`M${x + r * 0.55} ${y - h * 0.12} C ${x + r * 1.45} ${y - h * 0.28}, ${x + r * 1.4} ${y - h * 0.5}, ${x + r * 1.15} ${y - h * 0.7} C ${x + r * 1.0} ${y - h * 0.5}, ${x + r * 0.6} ${y - h * 0.46}, ${x + r * 0.3} ${y - h * 0.4} Z`}
      />
      <path
        className="flame-body"
        d={`M${x + r * 0.18} ${y - h} C ${x + r * 0.5} ${y - h * 0.82}, ${x + r * 1.2} ${y - h * 0.5}, ${x + r * 1.12} ${y - h * 0.28} C ${x + r * 1.05} ${y - h * 0.06}, ${x + r * 0.6} ${y}, ${x} ${y} C ${x - r * 0.6} ${y}, ${x - r * 1.05} ${y - h * 0.06}, ${x - r * 1.12} ${y - h * 0.28} C ${x - r * 1.2} ${y - h * 0.5}, ${x - r * 0.3} ${y - h * 0.62}, ${x + r * 0.18} ${y - h} Z`}
      />
      <path className="flame-core" d={`M${x} ${y - h * 0.55} C ${x + r * 0.6} ${y - h * 0.3}, ${x + r * 0.6} ${y - 2}, ${x} ${y - 2} C ${x - r * 0.6} ${y - 2}, ${x - r * 0.6} ${y - h * 0.3}, ${x} ${y - h * 0.55} Z`} />
      <g className="face">
        <ellipse cx={x - r * 0.36} cy={y - h * 0.36} rx={r * 0.12} ry={mood === 'sleepy' ? r * 0.04 : r * 0.17} />
        <ellipse cx={x + r * 0.36} cy={y - h * 0.36} rx={r * 0.12} ry={mood === 'sleepy' ? r * 0.04 : r * 0.17} />
        <path d={`M${x - r * 0.2} ${y - h * 0.24} Q ${x} ${y - h * (mood === 'beaming' ? 0.14 : 0.19)} ${x + r * 0.2} ${y - h * 0.24}`} />
        {mood !== 'sleepy' && (
          <>
            <circle className="cheek" cx={x - r * 0.62} cy={y - h * 0.25} r={r * 0.13} />
            <circle className="cheek" cx={x + r * 0.62} cy={y - h * 0.25} r={r * 0.13} />
          </>
        )}
      </g>
    </g>
  );
}

/**
 * The temple drawn flat, matching the 3D one: a veil of light over everything (God), a ring of Roman
 * columns that rise with the week, the foundation steps, the fire with a face, and the Big 3 flames
 * waiting beside it. Used on Home without WebGL and in automated tests.
 */
export function Building({ b, fire, compact }: { b: BuildingState; fire?: FireState; onPillar?: (id: Journey) => void; compact?: boolean }) {
  const f = fire ? Math.min(1, fire.value) : 0.5;
  const mood = fire?.level === 'ember' ? 'sleepy' : fire?.level === 'flame' || fire?.level === 'little' || !fire ? 'happy' : 'beaming';
  const cols = b.pillars.map((p, i) => {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const depth = Math.cos(a);
    const s = 0.82 + 0.18 * depth;
    const ratio = Math.max(0.22, Math.min(1, p.ratio));
    return { p, x: CX + Math.sin(a) * RING, y: FLOOR - 6 + depth * DEPTH, s, h: (28 + 112 * ratio) * s, depth, ratio };
  });
  const back = cols.filter((c) => c.depth < 0).sort((a, b) => a.depth - b.depth);
  const front = cols.filter((c) => c.depth >= 0).sort((a, b) => a.depth - b.depth);
  const waiting = b.torches.items.map((it, i) => ({ it, i })).filter((x) => !x.it.done);
  const spots = [
    [-40, 4],
    [40, 4],
    [0, 16],
  ];
  return (
    <figure className={`building ${compact ? 'compact' : ''} ${fire ? `fire-${fire.level}` : ''} ${b.complete ? 'is-complete' : ''}`} aria-label={buildingLabel(b, fire)} role="group">
      <svg viewBox={`0 0 ${W} 270`} aria-hidden="true">
        <defs>
          <radialGradient id="veil-fill" cx="50%" cy="85%" r="75%">
            <stop offset="0" stopColor="var(--accent)" stopOpacity="0.04" />
            <stop offset="0.8" stopColor="var(--accent)" stopOpacity="0.1" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0.28" />
          </radialGradient>
          <radialGradient id="glow">
            <stop offset="0" stopColor="var(--fire-core)" stopOpacity="0.85" />
            <stop offset="0.45" stopColor="var(--fire-mid)" stopOpacity="0.4" />
            <stop offset="1" stopColor="var(--fire-mid)" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Foundation: the water (the base), the cold shower (lower step) and the walk with God (upper step). */}
        <ellipse className={`step side ${b.foundation.water ? 'on' : ''}`} cx={CX} cy={FLOOR + 38} rx={164} ry={28} />
        <ellipse className={`step side ${b.foundation.coldShower ? 'on' : ''}`} cx={CX} cy={FLOOR + 30} rx={150} ry={26} />
        <ellipse className={`step ${b.foundation.coldShower ? 'on' : ''}`} cx={CX} cy={FLOOR + 22} rx={150} ry={26} />
        <ellipse className={`step side ${b.foundation.walk ? 'on' : ''}`} cx={CX} cy={FLOOR + 12} rx={132} ry={22} />
        <ellipse className={`step ${b.foundation.walk ? 'on' : ''}`} cx={CX} cy={FLOOR + 5} rx={132} ry={22} />

        {back.map((c) => (
          <Column key={c.p.id} x={c.x} y={c.y} h={c.h} s={c.s} id={c.p.id} ratio={c.ratio} today={c.p.today} />
        ))}

        {/* The fire and its little flames. */}
        <circle className="glow" cx={CX} cy={FLOOR - 26} r={30 + 34 * f} fill="url(#glow)" />
        {[0, 1, 2, 3, 4, 5, 6, 7].map((k) => {
          const a = (k / 8) * Math.PI * 2;
          return <ellipse key={k} className="pebble" cx={CX + Math.sin(a) * 26} cy={FLOOR - 2 + Math.cos(a) * 6} rx={6} ry={4} />;
        })}
        <FlameFace x={CX} y={FLOOR - 2} size={0.6 + 0.5 * f} mood={mood} />
        {waiting.map(({ it, i }) => (
          <FlameFace key={i} x={CX + spots[i % 3]![0]!} y={FLOOR + spots[i % 3]![1]!} size={0.36} mood="happy" pillar={it.pillar} />
        ))}

        {front.map((c) => (
          <Column key={c.p.id} x={c.x} y={c.y} h={c.h} s={c.s} id={c.p.id} ratio={c.ratio} today={c.p.today} />
        ))}

        {/* The veil: God over everything, always. */}
        <path className="veil" d={`M${CX - 160} ${FLOOR + 22} C ${CX - 168} ${FLOOR - 190}, ${CX + 168} ${FLOOR - 190}, ${CX + 160} ${FLOOR + 22}`} fill="url(#veil-fill)" />
        <path className="veil-fold" d={`M${CX - 90} ${FLOOR + 10} C ${CX - 100} ${FLOOR - 100}, ${CX - 40} ${FLOOR - 136}, ${CX} ${FLOOR - 138}`} />
        <path className="veil-fold" d={`M${CX + 90} ${FLOOR + 10} C ${CX + 100} ${FLOOR - 100}, ${CX + 40} ${FLOOR - 136}, ${CX} ${FLOOR - 138}`} />
        <path className="cross" d={`M${CX} ${FLOOR - 162} v22 M${CX - 7} ${FLOOR - 155} h14`} />
      </svg>
    </figure>
  );
}
