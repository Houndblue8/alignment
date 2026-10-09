import { ArrowDown, ArrowUp, Check, Pencil, Plus, RefreshCw, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { JOURNEYS, type Big3Item, type TaskRow } from '../data/model';
import { journeyStyle, shortDuration } from '../lib/format';
import type { Journey, WorkType } from '../planner';
import { dayOf, isTaskDone } from '../state/planning';
import { useApp } from '../state/store';
import { Sheet } from './Sheet';

export function Big3Section() {
  const s = useApp((a) => a.s)!;
  const date = useApp((a) => a.now.date);
  const setTaskDone = useApp((a) => a.setTaskDone);
  const accept = useApp((a) => a.acceptSuggestion);
  const [editing, setEditing] = useState(false);
  const items = dayOf(s, date).big3;
  const task = (id: string) => s.tasks.find((t) => t.id === id);

  return (
    <section className="stack" aria-labelledby="big3-h">
      <div className="row between">
        <h2 id="big3-h">Big 3</h2>
        <button className="btn ghost" onClick={() => setEditing(true)}>
          <Pencil size={16} aria-hidden="true" /> Edit
        </button>
      </div>
      {items.length === 0 && <p className="muted small">No Big 3 yet. Tap Edit to pick or add a task.</p>}
      {items.map((i) => {
        const t = task(i.taskId);
        if (!t) return null;
        const done = isTaskDone(s, t.id);
        const suggested = !i.locked && !i.accepted;
        return (
          <div key={i.taskId} className="card journey" style={journeyStyle(t.journey)} data-testid="big3-item">
            <div className="row">
              <button
                className="check"
                role="checkbox"
                aria-checked={done}
                aria-label={`${t.title} done`}
                onClick={() => setTaskDone(t.id, !done)}
              >
                {done && <Check size={16} strokeWidth={3} />}
              </button>
              <span className="grow clip">{t.title}</span>
              <span className="chip">{shortDuration(t.estimatedMinutes)}</span>
            </div>
            {suggested && (
              <div className="row between">
                <span className="small muted">Suggested</span>
                <button className="btn" onClick={() => accept(t.id)}>
                  Accept
                </button>
              </div>
            )}
          </div>
        );
      })}
      {items.length > 0 && items.length < 3 && (
        <p className="small muted">{items.length === 1 ? 'One item' : 'Two items'} in the Big 3 today. The Win counts these.</p>
      )}
      {editing && <Big3Editor initial={items} onClose={() => setEditing(false)} />}
    </section>
  );
}

function Big3Editor({ initial, onClose }: { initial: Big3Item[]; onClose: () => void }) {
  const s = useApp((a) => a.s)!;
  const setBig3 = useApp((a) => a.setBig3);
  const suggestAgain = useApp((a) => a.suggestAgain);
  const createTask = useApp((a) => a.createTask);
  const [items, setItems] = useState<Big3Item[]>(initial);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const open = useMemo(() => s.tasks.filter((t) => t.status === 'open'), [s.tasks]);
  const title = (id: string) => s.tasks.find((t) => t.id === id)?.title ?? 'Removed task';
  const matches = open.filter((t) => !items.some((i) => i.taskId === t.id) && t.title.toLowerCase().includes(query.trim().toLowerCase()));

  const move = (idx: number, by: number) => {
    const next = [...items];
    const [x] = next.splice(idx, 1);
    next.splice(idx + by, 0, x!);
    setItems(next);
  };
  const add = (taskId: string) => setItems((cur) => (cur.length >= 3 ? cur : [...cur, { taskId, locked: true, accepted: true }]));

  return (
    <Sheet title="Edit Big 3" onClose={onClose}>
      <ol className="stack" style={{ padding: 0, margin: 0, listStyle: 'none' }} aria-label="Big 3 order">
        {items.map((i, idx) => (
          <li key={i.taskId} className="card">
            <div className="row">
              <span className="grow clip">{title(i.taskId)}</span>
              <button className="icon-btn" aria-label={`Move ${title(i.taskId)} up`} disabled={idx === 0} onClick={() => move(idx, -1)}>
                <ArrowUp size={18} />
              </button>
              <button className="icon-btn" aria-label={`Move ${title(i.taskId)} down`} disabled={idx === items.length - 1} onClick={() => move(idx, 1)}>
                <ArrowDown size={18} />
              </button>
              <button className="icon-btn" aria-label={`Remove ${title(i.taskId)}`} onClick={() => setItems(items.filter((x) => x.taskId !== i.taskId))}>
                <X size={18} />
              </button>
            </div>
          </li>
        ))}
        {items.length === 0 && <li className="muted small">Empty. Add from your tasks below.</li>}
      </ol>

      <label className="label">
        Add a task
        <input className="field" type="search" placeholder="Search your tasks" value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      <div className="stack" style={{ maxHeight: 220, overflow: 'auto' }}>
        {matches.map((t) => (
          <div key={t.id} className="row card journey" style={journeyStyle(t.journey)}>
            <span className="grow clip">{t.title}</span>
            <button className="btn" disabled={items.length >= 3} onClick={() => add(t.id)} aria-label={`Add ${t.title}`}>
              <Plus size={16} aria-hidden="true" /> Add
            </button>
          </div>
        ))}
        {matches.length === 0 && <p className="small muted">No matching open tasks.</p>}
      </div>

      {creating ? (
        <NewTaskForm
          onCancel={() => setCreating(false)}
          onSave={async (t) => {
            const id = await createTask(t);
            add(id);
            setCreating(false);
          }}
        />
      ) : (
        <button className="btn" onClick={() => setCreating(true)}>
          <Plus size={16} aria-hidden="true" /> New task
        </button>
      )}

      <div className="row wrap">
        <button
          className="btn"
          onClick={async () => {
            await suggestAgain();
            onClose();
          }}
        >
          <RefreshCw size={16} aria-hidden="true" /> Suggest again
        </button>
        <button
          className="btn primary grow"
          onClick={async () => {
            await setBig3(items);
            onClose();
          }}
        >
          Save Big 3
        </button>
      </div>
    </Sheet>
  );
}

export function NewTaskForm({
  onSave,
  onCancel,
}: {
  onSave: (t: Pick<TaskRow, 'title' | 'journey' | 'importance' | 'estimatedMinutes' | 'deadline' | 'workType'>) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState('');
  const [journey, setJourney] = useState<Journey>('shs');
  const [importance, setImportance] = useState(3);
  const [minutes, setMinutes] = useState(45);
  const [deadline, setDeadline] = useState('');
  const [workType, setWorkType] = useState<WorkType>('deep');
  return (
    <form
      className="card stack"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        onSave({ title: title.trim(), journey, importance, estimatedMinutes: Math.max(5, minutes), deadline: deadline || null, workType });
      }}
    >
      <label className="label">
        Task
        <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="What needs doing" />
      </label>
      <div className="row wrap">
        <label className="label grow">
          Journey
          <select className="field" value={journey} onChange={(e) => setJourney(e.target.value as Journey)}>
            {JOURNEYS.map((j) => (
              <option key={j.id} value={j.id}>
                {j.label}
              </option>
            ))}
          </select>
        </label>
        <label className="label grow">
          Kind of work
          <select className="field" value={workType} onChange={(e) => setWorkType(e.target.value as WorkType)}>
            <option value="deep">Deep</option>
            <option value="easy">Easy</option>
            <option value="errand">Errand</option>
          </select>
        </label>
      </div>
      <div className="label">
        Importance
        <div className="row" role="group" aria-label="Importance">
          {[1, 2, 3, 4, 5].map((n) => (
            <button type="button" key={n} className="chip" aria-pressed={importance === n} onClick={() => setImportance(n)}>
              {n}
            </button>
          ))}
        </div>
      </div>
      <div className="row wrap">
        <label className="label grow">
          Minutes
          <input className="field" type="number" min={5} step={5} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} />
        </label>
        <label className="label grow">
          Deadline (optional)
          <input className="field" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </label>
      </div>
      <div className="row">
        <button type="button" className="btn ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn primary grow">
          Create task
        </button>
      </div>
    </form>
  );
}
