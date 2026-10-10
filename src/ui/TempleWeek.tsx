import { useEffect, useState } from 'react';
import { journeyStyle } from '../lib/format';
import { fmtDate, type Journey } from '../planner';
import { UNIT, weekTemple, type SavedTemple } from '../state/temple';
import { useApp } from '../state/store';
import { JOURNEY_ICON } from './icons';

const ORDER: Journey[] = ['faith', 'body', 'sport', 'school', 'shs', 'life'];

/** This week's temple: each pillar's progress toward its weekly target. */
export function WeekTempleCard({ start }: { start: string }) {
  const s = useApp((a) => a.s)!;
  const now = useApp((a) => a.now);
  const t = weekTemple(s, start, now);
  const atTarget = t.pillars.filter((p) => p.done >= p.target).length;
  return (
    <section className="card stack" aria-label="Temple this week">
      <div className="row between">
        <h2>Temple</h2>
        <span className="small muted">
          {atTarget} of 6 pillars at target{t.examWeek ? ', exam week' : ''}
        </span>
      </div>
      {t.pillars.map((p) => {
        const Icon = JOURNEY_ICON[p.id];
        return (
          <div key={p.id} className="row temple-row" style={journeyStyle(p.id)} aria-label={`${p.label}: ${p.done} of ${p.target} ${UNIT[p.id]}`}>
            <Icon size={16} aria-hidden="true" className="journey-icon" />
            <span className="grow clip small">{p.label}</span>
            <span className="temple-dots" aria-hidden="true">
              {Array.from({ length: Math.max(p.target, p.done) }, (_, i) => (
                <span key={i} className={i < p.done ? 'on' : ''} />
              ))}
            </span>
            <span className="small muted" style={{ width: 34, textAlign: 'right' }}>
              {p.done}/{p.target}
            </span>
          </div>
        );
      })}
    </section>
  );
}

/** Finished temples, one per week, drawn again from their numbers. */
export function TempleGallery() {
  const load = useApp((a) => a.temples);
  const [list, setList] = useState<SavedTemple[] | null>(null);
  useEffect(() => {
    void load().then(setList);
  }, [load]);
  if (!list || list.length === 0) return null;
  return (
    <section className="card stack" aria-label="Season of temples">
      <h2>Season of temples</h2>
      <div className="temple-gallery">
        {[...list].reverse().map((t) => (
          <TempleThumb key={t.weekStart} t={t} />
        ))}
      </div>
    </section>
  );
}

function TempleThumb({ t }: { t: SavedTemple }) {
  const complete = ORDER.every((id) => t.pillars[id][0] >= t.pillars[id][1]);
  const label = `Week of ${fmtDate(t.weekStart).replace(/^\w+, /, '')}: ${ORDER.filter((id) => t.pillars[id][0] >= t.pillars[id][1]).length} of 6 pillars at target, series ${t.series.won ? 'won' : 'lost'} ${t.series.points} points`;
  return (
    <figure className={`temple-thumb ${complete ? 'complete' : ''}`} aria-label={label}>
      <svg viewBox="0 0 100 92" aria-hidden="true">
        <path className="veil" d="M8 78 C 8 30, 92 30, 92 78" />
        {ORDER.map((id, i) => {
          const [done, target] = t.pillars[id];
          const h = 10 + 38 * Math.min(1, done / Math.max(1, target));
          const x = 17 + i * 13.2;
          return <rect key={id} x={x - 3.5} y={76 - h} width={7} height={h} rx={1.5} style={{ fill: `var(--j-${id})` }} />;
        })}
        <rect className="base" x={10} y={76} width={80} height={6} rx={1.5} />
      </svg>
      <figcaption className="small">
        {fmtDate(t.weekStart).replace(/^\w+, /, '')}
        <span className="muted"> {t.series.won ? 'W' : 'L'} {t.series.points}</span>
      </figcaption>
    </figure>
  );
}
