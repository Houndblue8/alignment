import { ChevronRight, Plus } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { DATA_MODE } from '../data/repo';
import { supabase } from '../data/supabase';
import { fmtDate, fmtTime, fromHHMM, toHHMM } from '../lib/format';
import type { EventDef, EventKind, Place, RankKey } from '../planner';
import { useApp } from '../state/store';
import { Sheet } from '../ui/Sheet';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ORDER = [1, 2, 3, 4, 5, 6, 0];

function Group({ title, summary, children }: { title: string; summary?: string; children: ReactNode }) {
  return (
    <details className="collapse card">
      <summary>
        <span>
          <h2>{title}</h2>
          {summary && <span className="small muted">{summary}</span>}
        </span>
        <ChevronRight size={18} aria-hidden="true" />
      </summary>
      <div className="stack lg">{children}</div>
    </details>
  );
}

export function Settings() {
  const s = useApp((a) => a.s)!;
  const save = useApp((a) => a.saveSettings);
  const setCodeRed = useApp((a) => a.setCodeRed);
  const [editing, setEditing] = useState<EventDef | 'new' | null>(null);
  const [place, setPlace] = useState<Place | null>(null);
  const weekly = s.events.filter((e) => e.recurringWeekly);
  const oneTime = s.events.filter((e) => !e.recurringWeekly).sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));

  return (
    <>
      <div className="screen-head">
        <h1>Settings</h1>
      </div>

      <Group title="Schedule" summary={`${weekly.length} weekly, ${oneTime.length} one-time`}>
        {ORDER.map((wd) => {
          const list = weekly.filter((e) => e.weekday === wd).sort((a, b) => a.start - b.start);
          if (!list.length) return null;
          return (
            <div key={wd} className="stack">
              <span className="small muted">{WEEKDAYS[wd]}</span>
              {list.map((e) => (
                <EventRow key={e.id} e={e} onClick={() => setEditing(e)} />
              ))}
            </div>
          );
        })}
        <div className="stack">
          <span className="small muted">One-time</span>
          {oneTime.map((e) => (
            <EventRow key={e.id} e={e} onClick={() => setEditing(e)} />
          ))}
        </div>
        <button className="btn" onClick={() => setEditing('new')}>
          <Plus size={16} aria-hidden="true" /> Add event
        </button>
      </Group>

      <Group title="Places" summary="Drive times">
        {s.places.map((p) => (
          <button key={p.id} className="card row" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => setPlace(p)}>
            <span className="grow">{p.name}</span>
            <span className="small muted">
              {p.minutesFromHome} min home, {p.minutesFromCampus} min campus
            </span>
          </button>
        ))}
      </Group>

      <Group title="Sleep" summary={`Wake target ${fmtTime(s.settings.wakeTargetMin)}, ${s.settings.sleepHours} hours`}>
        <label className="label">
          Wake target
          <input className="field" type="time" step={300} defaultValue={toHHMM(s.settings.wakeTargetMin)} onBlur={(e) => {
            const m = fromHHMM(e.target.value);
            if (m !== null && m !== s.settings.wakeTargetMin) void save({ wakeTargetMin: m });
          }} />
        </label>
        <label className="label">
          Hours of sleep
          <input className="field" type="number" min={6} max={10} step={0.5} defaultValue={s.settings.sleepHours} onBlur={(e) => {
            const v = Number(e.target.value);
            if (v >= 6 && v <= 10 && v !== s.settings.sleepHours) void save({ sleepHours: v });
          }} />
        </label>
        <label className="label">
          Latest wake
          <input className="field" type="time" step={300} defaultValue={toHHMM(s.settings.latestWakeMin)} onBlur={(e) => {
            const m = fromHHMM(e.target.value);
            if (m !== null && m !== s.settings.latestWakeMin) void save({ latestWakeMin: m });
          }} />
        </label>
      </Group>

      <Group title="Practice block" summary={`Block ${s.settings.practiceBlock}`}>
        <div className="row" role="group" aria-label="Practice block">
          {(['A', 'B'] as const).map((b) => (
            <button key={b} className="chip" aria-pressed={s.settings.practiceBlock === b} onClick={() => save({ practiceBlock: b })}>
              Block {b}
            </button>
          ))}
        </div>
        <p className="small muted">A: Sunday 6 to 8 PM, Tuesday 8 to 9:30 PM. B: Sunday 8 to 10 PM, Tuesday 9:30 to 11 PM, Wednesday 9 to 11 PM at Grover.</p>
      </Group>

      <Group title="Code Red" summary={s.settings.codeRed ? (s.settings.codeRedLevel === 'severe' ? 'All in' : 'On') : 'Off'}>
        <div className="row wrap" role="group" aria-label="Code Red">
          <button className="chip" aria-pressed={!s.settings.codeRed} onClick={() => setCodeRed(false)}>
            Off
          </button>
          <button className="chip" aria-pressed={s.settings.codeRed && s.settings.codeRedLevel === 'standard'} onClick={() => setCodeRed(true, 'standard')}>
            On, practices stay
          </button>
          <button className="chip" aria-pressed={s.settings.codeRed && s.settings.codeRedLevel === 'severe'} onClick={() => setCodeRed(true, 'severe')}>
            All in
          </button>
        </div>
      </Group>

      <Group title="Outreach" summary={`${s.settings.outreachCount} calls or DMs`}>
        <label className="label">
          Outreach calls or DMs for the Side Hustle Summit floor
          <input className="field" type="number" min={1} max={100} defaultValue={s.settings.outreachCount} onBlur={(e) => {
            const v = Math.round(Number(e.target.value));
            if (v > 0 && v !== s.settings.outreachCount) void save({ outreachCount: v });
          }} />
        </label>
      </Group>

      <Group title="Theme" summary="Gold and Cream">
        <p className="small muted">Gold and Cream. Five more themes arrive in Phase 4.</p>
      </Group>

      <Group title="Account">
        {DATA_MODE === 'supabase' ? (
          <button className="btn danger" onClick={() => supabase.auth.signOut()}>
            Sign out
          </button>
        ) : (
          <p className="small muted">Local test mode: data stays in this browser.</p>
        )}
      </Group>

      {editing && <EventSheet initial={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {place && <PlaceSheet initial={place} onClose={() => setPlace(null)} />}
    </>
  );
}

function EventRow({ e, onClick }: { e: EventDef; onClick: () => void }) {
  return (
    <button className="card row" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={onClick}>
      <span className="grow clip">{e.title}</span>
      <span className="small muted">
        {e.recurringWeekly ? '' : `${fmtDate(e.date!)}, `}
        {e.allDay ? 'All day' : `${fmtTime(e.start)} to ${fmtTime(e.end)}`}
        {e.tentative ? ', when confirmed' : ''}
      </span>
    </button>
  );
}

const KINDS: EventKind[] = ['class', 'exam', 'practice', 'event', 'social'];
const RANKS: RankKey[] = ['trip', 'church', 'epic_large', 'retreat', 'tournament', 'club_practice', 'flag_football', 'school', 'client', 'shs', 'epic_small', 'workout', 'discipleship', 'social', 'general'];

function EventSheet({ initial, onClose }: { initial: EventDef | null; onClose: () => void }) {
  const s = useApp((a) => a.s)!;
  const saveEvent = useApp((a) => a.saveEvent);
  const deleteEvent = useApp((a) => a.deleteEvent);
  const [e, setE] = useState<EventDef>(
    initial ?? {
      id: crypto.randomUUID(),
      title: '',
      kind: 'event',
      start: 600,
      end: 660,
      location: 'campus',
      rankKey: 'general',
      immovable: false,
      overridableByCodeRed: true,
      recurringWeekly: false,
      date: useApp.getState().now.date,
    },
  );
  const valid = e.title.trim() && e.end > e.start && (e.recurringWeekly ? e.weekday !== undefined : !!e.date);
  return (
    <Sheet title={initial ? 'Edit event' : 'Add event'} onClose={onClose}>
      <label className="label">
        Title
        <input className="field" value={e.title} onChange={(x) => setE({ ...e, title: x.target.value })} />
      </label>
      <div className="row" role="group" aria-label="Repeats">
        <button className="chip" aria-pressed={e.recurringWeekly} onClick={() => setE({ ...e, recurringWeekly: true, weekday: e.weekday ?? 1 })}>
          Weekly
        </button>
        <button className="chip" aria-pressed={!e.recurringWeekly} onClick={() => setE({ ...e, recurringWeekly: false, date: e.date ?? useApp.getState().now.date })}>
          One time
        </button>
      </div>
      {e.recurringWeekly ? (
        <label className="label">
          Day
          <select className="field" value={e.weekday} onChange={(x) => setE({ ...e, weekday: Number(x.target.value) })}>
            {ORDER.map((wd) => (
              <option key={wd} value={wd}>
                {WEEKDAYS[wd]}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <label className="label">
          Date
          <input className="field" type="date" value={e.date ?? ''} onChange={(x) => setE({ ...e, date: x.target.value })} />
        </label>
      )}
      <div className="row">
        <label className="label grow">
          Start
          <input className="field" type="time" step={300} value={toHHMM(e.start)} onChange={(x) => setE({ ...e, start: fromHHMM(x.target.value) ?? e.start })} />
        </label>
        <label className="label grow">
          End
          <input className="field" type="time" step={300} value={toHHMM(Math.min(e.end, 1439))} onChange={(x) => setE({ ...e, end: fromHHMM(x.target.value) ?? e.end })} />
        </label>
      </div>
      <div className="row">
        <label className="label grow">
          Place
          <select className="field" value={e.location} onChange={(x) => setE({ ...e, location: x.target.value })}>
            {s.places.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
            <option value="other">Somewhere else</option>
          </select>
        </label>
        <label className="label grow">
          Kind
          <select className="field" value={e.kind} onChange={(x) => setE({ ...e, kind: x.target.value as EventKind })}>
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="label">
        Priority (rank ladder)
        <select className="field" value={e.rankKey} onChange={(x) => setE({ ...e, rankKey: x.target.value as RankKey })}>
          {RANKS.map((r) => (
            <option key={r} value={r}>
              {r.replace('_', ' ')}
            </option>
          ))}
        </select>
      </label>
      <label className="row small">
        <input type="checkbox" checked={e.immovable} onChange={(x) => setE({ ...e, immovable: x.target.checked })} /> Immovable
      </label>
      <label className="row small">
        <input type="checkbox" checked={!e.overridableByCodeRed} onChange={(x) => setE({ ...e, overridableByCodeRed: !x.target.checked })} /> Keep during Code Red
      </label>
      <div className="row">
        {initial && (
          <button
            className="btn danger"
            onClick={async () => {
              await deleteEvent(e.id);
              onClose();
            }}
          >
            Delete
          </button>
        )}
        <button
          className="btn primary grow"
          disabled={!valid}
          onClick={async () => {
            await saveEvent({ ...e, title: e.title.trim() });
            onClose();
          }}
        >
          Save
        </button>
      </div>
    </Sheet>
  );
}

function PlaceSheet({ initial, onClose }: { initial: Place; onClose: () => void }) {
  const savePlace = useApp((a) => a.savePlace);
  const [p, setP] = useState(initial);
  return (
    <Sheet title={p.name} onClose={onClose}>
      <label className="label">
        Minutes from home
        <input className="field" type="number" min={0} value={p.minutesFromHome} onChange={(e) => setP({ ...p, minutesFromHome: Number(e.target.value) })} />
      </label>
      <label className="label">
        Minutes from campus
        <input className="field" type="number" min={0} value={p.minutesFromCampus} onChange={(e) => setP({ ...p, minutesFromCampus: Number(e.target.value) })} />
      </label>
      <label className="label">
        Notes
        <textarea className="field" value={p.notes ?? ''} onChange={(e) => setP({ ...p, notes: e.target.value })} />
      </label>
      <button
        className="btn primary block"
        onClick={async () => {
          await savePlace(p);
          onClose();
        }}
      >
        Save
      </button>
    </Sheet>
  );
}
