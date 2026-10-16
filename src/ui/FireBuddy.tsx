import type { FireLevel } from '../state/fire';
import { FlameFace } from './Building';

/**
 * The fire on its own, without the temple: the little flame with a face in its glow. Used by the Lost Day page
 * and the evening recap. hoppers: three small flames hopping around it (the loading screen does the same).
 */
export function FireBuddy({ level, value, hoppers = false, label }: { level: FireLevel; value: number; hoppers?: boolean; label: string }) {
  const f = Math.max(0.12, Math.min(1, value));
  const mood = level === 'ember' ? 'sleepy' : level === 'flame' ? 'happy' : 'beaming';
  return (
    <figure className={`building fire-solo fire-${level}`} role="img" aria-label={label}>
      <svg viewBox="0 30 200 140" aria-hidden="true">
        <defs>
          <radialGradient id="solo-glow">
            <stop offset="0" stopColor="var(--fire-core)" stopOpacity="0.9" />
            <stop offset="0.45" stopColor="var(--fire-mid)" stopOpacity="0.4" />
            <stop offset="1" stopColor="var(--fire-mid)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle className="glow" cx={100} cy={112} r={34 + 40 * f} fill="url(#solo-glow)" />
        {[0, 1, 2, 3, 4, 5, 6, 7].map((k) => {
          const a = (k / 8) * Math.PI * 2;
          return <ellipse key={k} className="pebble" cx={100 + Math.sin(a) * 30} cy={146 + Math.cos(a) * 7} rx={7} ry={4.5} />;
        })}
        <FlameFace x={100} y={146} size={1.25 + 0.55 * f} mood={mood} />
        {hoppers &&
          [0, 1, 2].map((i) => (
            <g key={i} className={`hopper h${i}`}>
              <FlameFace x={[38, 162, 100][i]!} y={[150, 150, 162][i]!} size={0.34} mood="happy" />
            </g>
          ))}
      </svg>
    </figure>
  );
}
