import { Check, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Big3Item } from '../data/model';
import { fromHHMM, journeyStyle, shortDuration, toHHMM } from '../lib/format';
import { haptic } from '../lib/haptics';
import { addDays, rankTasks } from '../planner';
import { dayOf, fillBig3 } from '../state/planning';
import { useApp } from '../state/store';
import { AnchorButton } from '../ui/AnchorButton';
import { CloseOut, canCloseOut, hasOpenItems } from '../ui/CloseOut';
import { HeroMedia } from '../ui/HeroMedia';
import { NewTaskForm } from '../ui/Big3';
import { Sheet } from '../ui/Sheet';

const CHIPS: [string, number][] = [
  ['6:30', 390],
  ['7:00', 420],
  ['7:30', 450],
  ['8:00', 480],
];

export function CheckIn() {
  const s = useApp((a) => a.s)!;
  const now = useApp((a) => a.now);
  const checkIn = useApp((a) => a.checkIn);
  const createTask = useApp((a) => a.createTask);
  const busy = useApp((a) => a.busy);
  const navigate = useNavigate();
  const nowRounded = Math.floor(now.min / 5) * 5;
  const [wake, setWake] = useState<number | null>(nowRounded);
  const [cold, setCold] = useState(false);
  const [walk, setWalk] = useState(false);
  const [creating, setCreating] = useState(false);

  // Start from yesterday's carried picks plus suggestions; Eli taps to keep or swap.
  const initial = useMemo(() => fillBig3(s, now.date, dayOf(s, now.date).big3), [s, now.date]);
  const [picked, setPicked] = useState<string[]>(() => initial.map((i) => i.taskId));
  const open = rankTasks(
    s.tasks.filter((t) => t.status === 'open'),
    now.date,
  ).slice(0, 8);
  // Yesterday stays open until it is closed out here, so a night without check-offs is not a lost day.
  const yesterday = addDays(now.date, -1);
  const [showYesterday] = useState(() => canCloseOut(s, yesterday, now.date) && hasOpenItems(s, yesterday));
  const toggle = (id: string) =>
    setPicked((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (cur.length >= 3) return cur;
      haptic();
      return [...cur, id];
    });

  return (
    <main className="fullscreen">
      <HeroMedia name="checkin" />
      {showYesterday && <CloseOut date={yesterday} title="Close out yesterday" />}
      <div className="stack">
        <p className="small muted">Morning check-in</p>
        <h1 className="big">What time did you wake up?</h1>
        {now.min >= 14 * 60 && <p className="muted">The rest of the day will be built from now.</p>}
      </div>

      <label>
        <span className="sr-only">Wake time</span>
        <input className="time-input" type="time" step={300} value={wake === null ? '' : toHHMM(wake)} onChange={(e) => setWake(fromHHMM(e.target.value))} />
      </label>
      <div className="row wrap" role="group" aria-label="Quick wake times">
        {CHIPS.map(([label, min]) => (
          <button key={label} type="button" className="chip" aria-pressed={wake === min} onClick={() => setWake(min)}>
            {label}
          </button>
        ))}
        <button type="button" className="chip" aria-pressed={wake === nowRounded} onClick={() => setWake(nowRounded)}>
          Just now
        </button>
      </div>

      <div className="anchors">
        <AnchorButton kind="coldShower" done={cold} onToggle={setCold} />
        <AnchorButton kind="walk" done={walk} onToggle={setWalk} />
      </div>

      <section className="stack" aria-labelledby="ci-big3">
        <div className="row between">
          <h2 id="ci-big3">Today's Big 3</h2>
          <span className="small muted">{picked.length} of 3</span>
        </div>
        <p className="small muted">The day is built around these.</p>
        {open.map((t) => {
          const on = picked.includes(t.id);
          return (
            <button
              key={t.id}
              type="button"
              className="card journey row"
              style={{ ...journeyStyle(t.journey), textAlign: 'left', cursor: 'pointer' }}
              aria-pressed={on}
              onClick={() => toggle(t.id)}
            >
              <span className={`check ${on ? 'on' : ''}`} aria-hidden="true">
                {on && <Check size={16} strokeWidth={3} />}
              </span>
              <span className="grow clip">{t.title}</span>
              <span className="chip">{shortDuration(t.estimatedMinutes)}</span>
            </button>
          );
        })}
        {open.length === 0 && <p className="small muted">No open tasks yet. Add your first one.</p>}
        <button type="button" className="btn" onClick={() => setCreating(true)} disabled={picked.length >= 3}>
          <Plus size={16} aria-hidden="true" /> New task
        </button>
      </section>

      <button
        className="btn primary block"
        disabled={wake === null || busy}
        onClick={async () => {
          if (wake === null) return;
          const big3: Big3Item[] = picked.map((taskId) => ({ taskId, locked: true, accepted: true }));
          await checkIn({ wakeMin: wake, coldShowerDone: cold, walkDone: walk, big3 });
          navigate('/', { replace: true });
        }}
      >
        {busy ? 'Building' : 'Build my day'}
      </button>

      {creating && (
        <Sheet title="New task" onClose={() => setCreating(false)}>
          <NewTaskForm
            onCancel={() => setCreating(false)}
            onSave={async (t) => {
              const id = await createTask(t);
              setPicked((cur) => (cur.length < 3 ? [...cur, id] : cur));
              setCreating(false);
            }}
          />
        </Sheet>
      )}
    </main>
  );
}
