import { Check } from 'lucide-react';
import { haptic } from '../lib/haptics';
import { addDays, fmtDate } from '../planner';
import { dayOf, isItemDone } from '../state/planning';
import { useApp } from '../state/store';

const WORD = { win: 'Win', half: 'Half win', loss: 'Loss' } as const;

/** A past day is open for late check-offs for 7 days, once it was lived in the app. */
export function canCloseOut(s: NonNullable<ReturnType<typeof useApp.getState>['s']>, date: string, today: string): boolean {
  return date < today && date >= addDays(today, -7) && !!s.days[date]?.checkinDone;
}

/** True when the day still has an anchor or a Big 3 item unchecked. */
export function hasOpenItems(s: NonNullable<ReturnType<typeof useApp.getState>['s']>, date: string): boolean {
  const rec = dayOf(s, date);
  return !rec.coldShower.done || !rec.walk.done || rec.big3.some((i) => !isItemDone(s, i));
}

/**
 * Check off what got done on a past day (forgot to close out that night). The day is scored again
 * right away. Only the anchors and the Big 3 count toward the score, so only they are here.
 */
export function CloseOut({ date, title }: { date: string; title?: string }) {
  const s = useApp((a) => a.s)!;
  const setPastBig3 = useApp((a) => a.setPastBig3);
  const setTaskDone = useApp((a) => a.setTaskDone);
  const setPastAnchor = useApp((a) => a.setPastAnchor);
  const rec = dayOf(s, date);
  const row = (label: string, done: boolean, onToggle: () => void) => (
    <div className="row" key={label}>
      <button
        className="check"
        role="checkbox"
        aria-checked={done}
        aria-label={`${label} done`}
        onClick={() => {
          if (!done) haptic();
          onToggle();
        }}
      >
        {done && <Check size={16} strokeWidth={3} />}
      </button>
      <span className="grow clip">{label}</span>
    </div>
  );
  return (
    <section className="card stack" aria-label={title ?? `Close out ${fmtDate(date)}`}>
      <div className="row between">
        <h2>{title ?? 'Close out this day'}</h2>
        {rec.result && <span className="chip" data-testid="closeout-result">{WORD[rec.result]}</span>}
      </div>
      <p className="small muted">Forgot to check things off? Mark what you did. The day is scored again.</p>
      {row('Cold shower', rec.coldShower.done, () => void setPastAnchor(date, 'coldShower', !rec.coldShower.done))}
      {row('Walk with God', rec.walk.done, () => void setPastAnchor(date, 'walk', !rec.walk.done))}
      {rec.big3.map((i) => {
        const t = s.tasks.find((x) => x.id === i.taskId);
        if (!t) return null;
        const done = isItemDone(s, i);
        return (
          <div className="stack" key={t.id}>
            {row(t.title, done, () => void setPastBig3(date, t.id, !done))}
            {done && t.status === 'open' && (
              <div className="row wrap closeout-finish">
                <span className="small muted grow">Finished for good, or does it repeat?</span>
                <button className="btn" onClick={() => void setTaskDone(t.id, true, date)}>
                  Finished
                </button>
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
