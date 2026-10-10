import { useEffect, useState } from 'react';
import type { Journey } from '../planner';
import type { BuildingState } from '../state/pillars';

const SHORT: Record<Journey, string> = {
  faith: 'Faith',
  body: 'Body',
  sport: 'Sports',
  school: 'Academics',
  shs: 'Hustle',
  life: 'Social',
};

/** Pillar height for a number of steps: one step raises it a lot, more steps finish it. */
export const rise = (steps: number): number => (steps <= 0 ? 0 : steps === 1 ? 0.55 : steps === 2 ? 0.8 : 1);

const W = 340;
const COL_TOP = 92;
const COL_BOTTOM = 196;
const COL_W = 24;

/**
 * Today's building. The cold shower and the walk are the two foundation steps, each pillar rises with steps
 * toward it, and the Big 3 are the roof beams. When the foundation and the roof are done, it stands (a Win).
 */
export function Building({ b, onPillar, compact }: { b: BuildingState; onPillar?: (id: Journey) => void; compact?: boolean }) {
  // Pillars rise from the ground when the building first appears, then move with each new step.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSettled(true), 60);
    return () => clearTimeout(t);
  }, []);

  const gap = (W - 40) / 6;
  const beams = Math.max(b.roof.total, 1);
  // Roof beams fill from the bottom band up.
  const bandH = (72 - 14) / beams;
  const label = `Today's building: foundation ${Number(b.foundation.coldShower) + Number(b.foundation.walk)} of 2, ${b.pillars.filter((p) => p.steps > 0).length} of 6 pillars risen, roof ${b.roof.done} of ${b.roof.total}${b.complete ? '. It stands.' : '.'}`;

  return (
    <figure className={`building ${b.complete ? 'is-complete' : ''} ${compact ? 'compact' : ''} ${settled ? 'settled' : ''}`} aria-label={label} role="group">
      <svg viewBox={`0 0 ${W} 246`} aria-hidden={onPillar ? undefined : true}>
        <defs>
          <clipPath id="roof-clip">
            <polygon points={`22,72 ${W / 2},14 ${W - 22},72`} />
          </clipPath>
          <linearGradient id="marble" x1="0" x2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.28" />
            <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity="0.08" />
          </linearGradient>
        </defs>

        {/* Roof: the Big 3. */}
        <g className="roof">
          <polygon className="stone" points={`22,72 ${W / 2},14 ${W - 22},72`} />
          <g clipPath="url(#roof-clip)">
            {Array.from({ length: beams }, (_, i) => {
              const y = 72 - (i + 1) * bandH;
              const on = i < b.roof.done;
              return <rect key={i} className={`beam ${on ? 'on' : ''}`} x={22} y={y + 0.75} width={W - 44} height={bandH - 1.5} />;
            })}
          </g>
          <polygon className="outline" points={`22,72 ${W / 2},14 ${W - 22},72`} />
        </g>
        <rect className="stone outline" x={14} y={74} width={W - 28} height={12} rx={2} />

        {/* Pillars. */}
        {b.pillars.map((p, i) => {
          const cx = 20 + gap * i + gap / 2;
          const x = cx - COL_W / 2;
          const h = COL_BOTTOM - COL_TOP;
          const r = rise(p.steps);
          const g = (
            <g key={p.id} className={`pillar ${r > 0 ? 'risen' : ''}`} style={{ ['--jc' as string]: `var(--j-${p.id})` }}>
              <rect className="stone outline" x={x - 5} y={COL_TOP - 4} width={COL_W + 10} height={6} rx={1.5} />
              <rect className="stone outline" x={x} y={COL_TOP + 2} width={COL_W} height={h - 4} rx={2} />
              <rect
                className="fill"
                x={x}
                y={COL_TOP + 2}
                width={COL_W}
                height={h - 4}
                rx={2}
                style={{ transform: `scaleY(${settled ? r : 0})`, transitionDelay: settled ? `${i * 70}ms` : '0ms' }}
              />
              <rect className="sheen" x={x} y={COL_TOP + 2} width={COL_W} height={h - 4} rx={2} fill="url(#marble)" />
              <line className="flute" x1={cx - 5} x2={cx - 5} y1={COL_TOP + 8} y2={COL_BOTTOM - 8} />
              <line className="flute" x1={cx + 5} x2={cx + 5} y1={COL_TOP + 8} y2={COL_BOTTOM - 8} />
              <rect className="stone outline" x={x - 5} y={COL_BOTTOM - 2} width={COL_W + 10} height={5} rx={1.5} />
              {!compact && (
                <text className="pillar-label" x={cx} y={240} textAnchor="middle">
                  {SHORT[p.id]}
                </text>
              )}
              {onPillar && <rect className="hit" x={cx - gap / 2} y={COL_TOP - 8} width={gap} height={248 - COL_TOP} />}
            </g>
          );
          return onPillar ? (
            <g
              key={p.id}
              role="button"
              tabIndex={0}
              aria-label={`${p.label}: ${p.steps} ${p.steps === 1 ? 'step' : 'steps'} today`}
              onClick={() => onPillar(p.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onPillar(p.id);
                }
              }}
            >
              {g}
            </g>
          ) : (
            g
          );
        })}

        {/* Foundation: the walk (upper step) on the cold shower (lower step). */}
        <rect className={`step ${b.foundation.walk ? 'on' : ''}`} x={10} y={201} width={W - 20} height={10} rx={2} />
        <rect className={`step ${b.foundation.coldShower ? 'on' : ''}`} x={2} y={212} width={W - 4} height={12} rx={2} />
      </svg>
    </figure>
  );
}
