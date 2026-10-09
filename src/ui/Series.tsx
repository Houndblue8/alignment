import type { DayResult } from '../data/model';
import { addDays, scoreWeek } from '../planner';

const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const WORD: Record<DayResult, string> = { win: 'Win', half: 'Half win', loss: 'Loss' };

/** Seven circles for Monday to Sunday: Win, Half, Loss, or empty for upcoming. */
export function WeekCircles({ start, results, today }: { start: string; results: (DayResult | null)[]; today: string }) {
  return (
    <div className="row between" role="list" aria-label="Results this week">
      {results.map((r, i) => {
        const date = addDays(start, i);
        const label = `${LETTERS[i]} ${r ? WORD[r] : date === today ? 'today' : 'upcoming'}`;
        return (
          <div key={date} role="listitem" className="stack" style={{ justifyItems: 'center', gap: 4 }} aria-label={label}>
            <span className={`result ${r ?? ''} ${date === today ? 'today' : ''}`} aria-hidden="true">
              {r === 'win' ? 'W' : r === 'half' ? 'H' : r === 'loss' ? 'L' : ''}
            </span>
            <span className="small muted" aria-hidden="true">
              {LETTERS[i]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Seven segments filled by points, with a marker at 4 (the score that wins the series). */
export function SeriesBar({ results }: { results: (DayResult | null)[] }) {
  const { points, label } = scoreWeek(results);
  return (
    <div className="stack">
      <div className="series" role="img" aria-label={`Series: ${points} of 4 needed`}>
        {Array.from({ length: 7 }, (_, i) => (
          <span key={i} className={`seg ${points >= i + 1 ? 'on' : points > i ? 'halfon' : ''}`} />
        ))}
        <span className="mark" aria-hidden="true" />
      </div>
      <div className="row between small muted">
        <span>{points} of 4</span>
        <span>{points >= 4 ? label : results.every((r) => r !== null) ? 'Lost' : 'In play'}</span>
      </div>
    </div>
  );
}
