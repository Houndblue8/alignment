import { useEffect, useState } from 'react';
import type { Journey } from '../planner';
import type { FireState } from '../state/fire';
import type { BuildingState } from '../state/pillars';

export const SHORT: Record<Journey, string> = {
  faith: 'Faith',
  body: 'Body',
  sport: 'Sports',
  school: 'Academics',
  shs: 'Hustle',
  life: 'Social',
};

/** Pillar height for a number of steps: unbuilt pillars stand a quarter high; one step raises it a lot, three finish it. */
export const rise = (steps: number): number => (steps <= 0 ? 0.25 : steps === 1 ? 0.6 : steps === 2 ? 0.82 : 1);

const W = 340;
const COL_TOP = 92;
const COL_BOTTOM = 196;
const COL_W = 22;
/** Three pillars each side of a wide center bay where the fire and the torches stand. */
const COL_X = [34, 76, 118, 222, 264, 306];

export function buildingLabel(b: BuildingState, fire?: FireState): string {
  const f = fire ? ` The fire: ${Math.round(fire.value * 100)} percent.` : '';
  return `Today's building: God is the roof. Foundation ${Number(b.foundation.coldShower) + Number(b.foundation.walk)} of 2, ${b.pillars.filter((p) => p.steps > 0).length} of 6 pillars risen, ${b.torches.done} of ${b.torches.total} torches lit.${f}`;
}

/**
 * The building drawn flat: God is the roof (always lit), six pillars rise with steps toward them, the cold shower
 * and the walk are the foundation, and the fire burns in the center bay with the three Big 3 torches.
 * Used on Home and wherever 3D is not available.
 */
export function Building({ b, fire, onPillar, compact }: { b: BuildingState; fire?: FireState; onPillar?: (id: Journey) => void; compact?: boolean }) {
  // Pillars rise from the ground when the building first appears, then move with each new step.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSettled(true), 60);
    return () => clearTimeout(t);
  }, []);
  const flame = fire ? Math.min(1.3, fire.value) : 0.5;
  const torches = Math.max(3, b.torches.total);

  return (
    <figure className={`building ${b.complete ? 'is-complete' : ''} ${compact ? 'compact' : ''} ${fire?.level === 'refiner' ? 'refiner' : ''}`} aria-label={buildingLabel(b, fire)} role="group">
      <svg viewBox={`0 0 ${W} 246`} aria-hidden={onPillar ? undefined : true}>
        <defs>
          <linearGradient id="marble" x1="0" x2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.28" />
            <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity="0.08" />
          </linearGradient>
          <radialGradient id="glow">
            <stop offset="0" stopColor="var(--fire-core)" stopOpacity="0.9" />
            <stop offset="0.45" stopColor="var(--fire-mid)" stopOpacity="0.45" />
            <stop offset="1" stopColor="var(--fire-mid)" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* The roof: God. Always lit, never taken away. */}
        <g className="god-roof">
          <polygon className="roof-fill" points={`22,72 ${W / 2},14 ${W - 22},72`} />
          <polygon className="outline" points={`22,72 ${W / 2},14 ${W - 22},72`} />
          <path className="cross" d={`M${W / 2} 28 v34 M${W / 2 - 10} 39 h20`} />
        </g>
        <rect className="stone outline" x={14} y={74} width={W - 28} height={12} rx={2} />

        {/* The fire and the torches, in the center bay. */}
        <g className="hearth">
          <circle className="glow" cx={W / 2} cy={170} r={34 + 30 * flame} fill="url(#glow)" />
          <g className="flame" style={{ transform: `scale(${0.45 + 0.55 * flame})` }}>
            <path className="flame-outer" d={`M${W / 2} 128 C ${W / 2 + 22} 152, ${W / 2 + 18} 190, ${W / 2} 192 C ${W / 2 - 18} 190, ${W / 2 - 22} 152, ${W / 2} 128 Z`} />
            <path className="flame-inner" d={`M${W / 2} 152 C ${W / 2 + 10} 166, ${W / 2 + 9} 188, ${W / 2} 189 C ${W / 2 - 9} 188, ${W / 2 - 10} 166, ${W / 2} 152 Z`} />
          </g>
          {Array.from({ length: torches }, (_, i) => {
            const x = W / 2 - 36 + i * 36;
            const lit = i < b.torches.done;
            return (
              <g key={i} className={`torch ${lit ? 'lit' : ''}`}>
                <rect x={x - 2} y={176} width={4} height={20} rx={1} />
                {lit && <path className="torch-flame" d={`M${x} 162 C ${x + 6} 168, ${x + 5} 176, ${x} 177 C ${x - 5} 176, ${x - 6} 168, ${x} 162 Z`} />}
              </g>
            );
          })}
        </g>

        {/* Pillars. */}
        {b.pillars.map((p, i) => {
          const cx = COL_X[i]!;
          const x = cx - COL_W / 2;
          const h = COL_BOTTOM - COL_TOP;
          const r = rise(p.steps);
          const g = (
            <g key={p.id} className={`pillar ${p.steps > 0 ? 'risen' : ''}`} style={{ ['--jc' as string]: `var(--j-${p.id})` }}>
              <rect className="stone outline" x={x - 5} y={COL_TOP - 4} width={COL_W + 10} height={6} rx={1.5} />
              <rect className="stone outline" x={x} y={COL_TOP + 2} width={COL_W} height={h - 4} rx={2} />
              <rect className="fill" x={x} y={COL_TOP + 2} width={COL_W} height={h - 4} rx={2} style={{ transform: `scaleY(${settled ? r : 0})`, transitionDelay: settled ? `${i * 70}ms` : '0ms' }} />
              <rect className="sheen" x={x} y={COL_TOP + 2} width={COL_W} height={h - 4} rx={2} fill="url(#marble)" />
              <rect className="stone outline" x={x - 5} y={COL_BOTTOM - 2} width={COL_W + 10} height={5} rx={1.5} />
              {!compact && (
                <text className="pillar-label" x={cx} y={240} textAnchor="middle">
                  {SHORT[p.id]}
                </text>
              )}
              {onPillar && <rect className="hit" x={cx - 21} y={COL_TOP - 8} width={42} height={248 - COL_TOP} />}
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
