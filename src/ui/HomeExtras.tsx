import { Copy, Hourglass } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { TaskRow } from '../data/model';
import { DATA_MODE } from '../data/repo';
import { addDays } from '../planner';
import { needsDecision } from '../planner';
import { useApp } from '../state/store';
import { Sheet } from './Sheet';

/** One line from the coach, cached per day (Appendix A). */
export function CoachLine() {
  const line = useApp((a) => a.coachLine);
  const load = useApp((a) => a.loadCoachLine);
  useEffect(() => {
    if (DATA_MODE === 'supabase' || window.__alignmentAI?.coach) void load();
  }, [load]);
  if (!line) return null;
  return (
    <section className="card coach" aria-label="Coach">
      <p>{line}</p>
    </section>
  );
}

const AWAY_TWO =
  'Three to five years from now, you will either be glad you stayed or sick that you let fear talk you out of the life you wanted. Which one gets decided today. One 5 minute block. Open the app.';

/** After 2 days away: the brief's message and one 5 minute start. After 5: a firm reset offer. */
export function AwayMessage() {
  const away = useApp((a) => a.awayDays);
  const s = useApp((a) => a.s)!;
  const startLostDay = useApp((a) => a.startLostDay);
  const [hidden, setHidden] = useState(false);
  if (hidden || away < 2) return null;
  const open = s.tasks.filter((t) => t.status === 'open').sort((a, b) => a.estimatedMinutes - b.estimatedMinutes);
  const first = open[0];
  if (away >= 5) {
    return (
      <section className="card pad stack" role="note">
        <p>
          {away} days away. That stretch is over and it does not decide who you are. Today decides the next one. Reset with a Lost Day: two small wins and today counts.
        </p>
        <div className="row wrap">
          <button className="btn primary" onClick={() => startLostDay(`Back after ${away} days away`).then(() => setHidden(true))}>
            Lost Day reset
          </button>
          <button className="btn" onClick={() => setHidden(true)}>
            Not now
          </button>
        </div>
      </section>
    );
  }
  return (
    <section className="card pad stack" role="note">
      <p>{AWAY_TWO}</p>
      {first && (
        <p className="row">
          <Hourglass size={16} aria-hidden="true" />
          <span>
            5 minute start: {first.title}
            {first.steps?.[0] ? `. ${first.steps[0].text}` : ''}
          </span>
        </p>
      )}
      <button className="btn" style={{ justifySelf: 'start' }} onClick={() => setHidden(true)}>
        Got it
      </button>
    </section>
  );
}

/** Tasks pushed 3 or more times get a decision: do it today, schedule it, delegate, or drop it. */
export function Decisions() {
  const tasks = useApp((a) => a.s!.tasks);
  const [open, setOpen] = useState<TaskRow | null>(null);
  const due = tasks.filter((t) => t.status === 'open' && needsDecision(t));
  if (!due.length) return null;
  return (
    <>
      {due.slice(0, 2).map((t) => (
        <section key={t.id} className="card row" aria-label="Decision needed">
          <span className="grow">
            {t.title} has been pushed {t.deferralCount} times. Decide what happens to it.
          </span>
          <button className="btn" onClick={() => setOpen(t)}>
            Decide
          </button>
        </section>
      ))}
      {open && <DecisionSheet task={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function DecisionSheet({ task, onClose }: { task: TaskRow; onClose: () => void }) {
  const decide = useApp((a) => a.decideTask);
  const busy = useApp((a) => a.busy);
  const today = useApp((a) => a.now.date);
  const [date, setDate] = useState(addDays(today, 1));
  const [draft, setDraft] = useState<string | null | undefined>(undefined);
  const act = async (choice: 'today' | 'schedule' | 'drop') => {
    await decide(task.id, choice, date);
    onClose();
  };
  return (
    <Sheet title={task.title} onClose={onClose}>
      {draft === undefined ? (
        <>
          <p className="muted">Pushed {task.deferralCount} times. Pick one.</p>
          <button className="btn block" onClick={() => act('today')} disabled={busy}>
            Do it today (top of the Big 3)
          </button>
          <div className="row">
            <input className="field grow" type="date" value={date} min={today} onChange={(e) => setDate(e.target.value)} aria-label="Schedule for" />
            <button className="btn" onClick={() => act('schedule')} disabled={busy}>
              Schedule it
            </button>
          </div>
          <button
            className="btn block"
            disabled={busy}
            onClick={async () => {
              const r = await decide(task.id, 'delegate');
              if (r) setDraft(r.draft);
            }}
          >
            {busy ? 'Preparing' : 'Delegate (steps and a draft written for you)'}
          </button>
          <button className="btn block danger" onClick={() => act('drop')} disabled={busy}>
            Drop it
          </button>
        </>
      ) : (
        <>
          <p>Ready. The steps are on the task, so you only execute.</p>
          {draft && (
            <div className="card stack">
              <span className="small muted">Draft message</span>
              <p style={{ whiteSpace: 'pre-wrap' }}>{draft}</p>
              <button className="btn" style={{ justifySelf: 'start' }} onClick={() => navigator.clipboard?.writeText(draft)}>
                <Copy size={16} aria-hidden="true" /> Copy draft
              </button>
            </div>
          )}
          <button className="btn primary block" onClick={onClose}>
            Done
          </button>
        </>
      )}
    </Sheet>
  );
}
