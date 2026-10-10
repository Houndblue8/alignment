import { Check, Flame, Plus, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { JOURNEYS, journeyLabel } from '../data/model';
import { haptic } from '../lib/haptics';
import { journeyStyle } from '../lib/format';
import { addDays, weekStart, type Journey } from '../planner';
import { fireFor, LEVEL_NAME, type FireState } from '../state/fire';
import { pillarHistory, pillarSteps } from '../state/pillars';
import { buildingFor, buildingLine, seenOn, UNIT, weekTemple } from '../state/temple';
import { dayOf } from '../state/planning';
import { useApp } from '../state/store';
import { SHORT } from './Building';
import { Temple3D } from './Temple3D';
import { Sheet } from './Sheet';
import { JOURNEY_ICON } from './icons';

/** Starter ideas for a small step, per pillar. Eli can type anything. */
const IDEAS: Record<Journey, string[]> = {
  faith: ['Read a chapter', 'Prayed for someone', 'Texted someone from Epic'],
  body: ['Stretched 10 minutes', 'Drank enough water', 'Extra walk'],
  sport: ['Film or skill work', 'Mobility for the game', 'Reps on my own'],
  school: ['Reviewed notes', 'Went to office hours', 'Finished a problem set'],
  shs: ['Sent outreach', 'Followed up with a client', 'Worked on the offer'],
  life: ['Called family', 'Checked in on a friend', 'Invited someone to eat'],
};

/** Top of Today: the temple and its fire, the pillars, the coach line, and this morning's 1% from last night. */
export function FocusHero() {
  const s = useApp((a) => a.s)!;
  const now = useApp((a) => a.now);
  const [pillar, setPillar] = useState<Journey | null>(null);
  const [fireOpen, setFireOpen] = useState(false);
  const b = useMemo(() => buildingFor(s, now.date, now), [s, now]);
  const fire = useMemo(() => fireFor(s, now), [s, now]);
  const kaizen = s.days[addDays(now.date, -1)]?.kaizen;
  return (
    <section className="card pad focus" aria-label="Focus">
      <Temple3D b={b} fire={fire} theme={s.settings.theme} onPillar={setPillar} onFire={() => setFireOpen(true)} />
      <FireMeter fire={fire} onOpen={() => setFireOpen(true)} />
      <div className="pillar-chips" role="group" aria-label="Pillars">
        {b.pillars.map((p) => {
          const Icon = JOURNEY_ICON[p.id];
          return (
            <button
              key={p.id}
              className={`pillar-chip ${p.steps > 0 ? 'risen' : ''}`}
              style={journeyStyle(p.id)}
              aria-label={`${p.label}: ${p.steps} ${p.steps === 1 ? 'step' : 'steps'} today`}
              onClick={() => setPillar(p.id)}
            >
              <Icon size={16} aria-hidden="true" />
              <span>{SHORT[p.id]}</span>
              <span className="count" aria-hidden="true">
                {p.steps}
              </span>
            </button>
          );
        })}
      </div>
      <p className="focus-line" data-testid="focus-line">
        {buildingLine(b)}
      </p>
      {kaizen && (
        <p className="kaizen-today small" data-testid="kaizen-today">
          <span className="muted">Today's 1%: </span>
          {kaizen}
        </p>
      )}
      {pillar && <PillarSheet pillar={pillar} onClose={() => setPillar(null)} />}
      {fireOpen && <FireSheet fire={fire} onClose={() => setFireOpen(false)} />}
    </section>
  );
}

/** The fire's name and strength. Over 100 percent only on a refiner's day. */
function FireMeter({ fire, onOpen }: { fire: FireState; onOpen: () => void }) {
  const pct = Math.round(fire.value * 100);
  return (
    <button className={`fire-meter ${fire.level}`} onClick={onOpen} aria-label={`The fire: ${LEVEL_NAME[fire.level]}, ${pct} percent. Open`} data-testid="fire-meter">
      <Flame size={18} aria-hidden="true" className="fire-icon" />
      <span className="fire-name">{LEVEL_NAME[fire.level]}</span>
      <span className="fire-bar" aria-hidden="true">
        <span style={{ width: `${Math.min(100, (fire.value / 1.25) * 100)}%` }} />
      </span>
      <span className="small muted" aria-hidden="true">
        {pct}%
      </span>
    </button>
  );
}

function FireSheet({ fire, onClose }: { fire: FireState; onClose: () => void }) {
  const t = fire.today;
  const max = Math.max(1.25, ...fire.trail);
  return (
    <Sheet title="The fire" onClose={onClose}>
      <p className={`fire-title ${fire.level}`}>
        <Flame size={20} aria-hidden="true" /> {LEVEL_NAME[fire.level]}, {Math.round(fire.value * 100)}%
      </p>
      <p>{fire.line}</p>
      <div className="stack">
        <span className="small muted">Last {fire.trail.length} days</span>
        <div className="fire-trail" aria-label={`Fire over the last ${fire.trail.length} days`}>
          {fire.trail.map((v, i) => (
            <span key={i} className={v > 1 ? 'over' : ''} style={{ height: `${Math.max(6, (v / max) * 100)}%` }} />
          ))}
        </div>
      </div>
      <div className="stack">
        <span className="small muted">Today so far</span>
        <Meter label="Faith" value={t.faith} />
        <Meter label="The rest of life" value={t.life} />
      </div>
      <p className="small muted">
        Faith feeds it most: the walk with God, time in the Word, prayer, Epic, church, and the Spirit check. Then the cold shower, the three torches of
        your Big 3, the other pillars, and how your mind and heart are. It carries from day to day and never goes out. On a day where everything else
        breaks down but your faith holds, it burns brighter than ever.
      </p>
    </Sheet>
  );
}

function Meter({ label, value }: { label: string; value: number }) {
  return (
    <div className="row">
      <span className="small" style={{ width: 120 }}>
        {label}
      </span>
      <span className="fire-bar grow" aria-hidden="true">
        <span style={{ width: `${Math.round(value * 100)}%` }} />
      </span>
      <span className="small muted">{Math.round(value * 100)}%</span>
    </div>
  );
}

const SCALE = [1, 2, 3, 4, 5];
const INNER_ROWS: { key: 'mind' | 'heart' | 'spirit'; label: string; hint: string }[] = [
  { key: 'mind', label: 'Mind', hint: 'Clear and steady?' },
  { key: 'heart', label: 'Heart', hint: 'At peace, or carrying something?' },
  { key: 'spirit', label: 'Spirit', hint: 'Close to God today?' },
];

/** From 5 PM: Mind, Heart, Spirit, 1 to 5. Ten seconds. It feeds the fire. */
export function InnerCheckCard() {
  const s = useApp((a) => a.s)!;
  const now = useApp((a) => a.now);
  const setInner = useApp((a) => a.setInner);
  const saved = dayOf(s, now.date).inner ?? null;
  const [v, setV] = useState({ mind: saved?.mind ?? 0, heart: saved?.heart ?? 0, spirit: saved?.spirit ?? 0, note: saved?.note ?? '' });
  const [editing, setEditing] = useState(!saved);
  if (now.min < 17 * 60) return null;
  return (
    <section className="card stack" aria-label="Tonight's check">
      <p className="section-label">Tonight's check</p>
      <ShowedUp />
      {editing ? (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            haptic();
            void setInner({ mind: v.mind, heart: v.heart, spirit: v.spirit, note: v.note });
            setEditing(false);
          }}
        >
          {INNER_ROWS.map((r) => (
            <div key={r.key} className="stack" style={{ gap: 4 }}>
              <span>
                {r.label} <span className="small muted">{r.hint}</span>
              </span>
              <div className="row scale" role="radiogroup" aria-label={r.label}>
                {SCALE.map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={v[r.key] === n}
                    aria-label={`${r.label} ${n}`}
                    className="chip"
                    onClick={() => setV({ ...v, [r.key]: n })}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <input className="field" value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} maxLength={160} placeholder="One line, if you want" aria-label="One line" />
          <button type="submit" className="btn primary" disabled={!v.mind || !v.heart || !v.spirit}>
            Save tonight's check
          </button>
        </form>
      ) : (
        <div className="row">
          <p className="grow small">
            Mind {v.mind}, Heart {v.heart}, Spirit {v.spirit}
            {v.note.trim() ? `. ${v.note.trim()}` : ''}
          </p>
          <button className="btn ghost" onClick={() => setEditing(true)}>
            Edit
          </button>
        </div>
      )}
    </section>
  );
}

function PillarSheet({ pillar, onClose }: { pillar: Journey; onClose: () => void }) {
  const s = useApp((a) => a.s)!;
  const now = useApp((a) => a.now);
  const logStep = useApp((a) => a.logStep);
  const removeStep = useApp((a) => a.removeStep);
  const [text, setText] = useState('');
  const steps = pillarSteps(s, now.date, now)[pillar];
  const history = pillarHistory(s, now)[pillar];
  const week = weekTemple(s, weekStart(now.date), now).pillars.find((p) => p.id === pillar)!;
  const Icon = JOURNEY_ICON[pillar];
  const save = (t: string) => {
    if (!t.trim()) return;
    haptic();
    void logStep(pillar, t);
    setText('');
  };
  return (
    <Sheet title={journeyLabel(pillar)} onClose={onClose}>
      <div className="stack" style={journeyStyle(pillar)}>
        <div className="row">
          <Icon size={22} aria-hidden="true" className="journey-icon" />
          <p className="grow">
            <strong>
              {week.done} of {week.target}
            </strong>{' '}
            <span className="muted">{UNIT[pillar]} this week</span>
          </p>
        </div>
        <div className="pillar-week" aria-label={`This week, Monday to Sunday: ${week.days.filter(Boolean).length} days`}>
          {week.days.map((on, i) => (
            <span key={i} className={on ? 'on' : ''} title={DAYS[i]} />
          ))}
        </div>
      </div>
      <ul className="stack" style={{ margin: 0, padding: 0, listStyle: 'none' }} aria-label="Steps today">
        {steps.length === 0 && <li className="small muted">No step yet today. One small step adds a stone.</li>}
        {steps.map((st) => (
          <li key={`${st.source}:${st.text}`} className="row card journey" style={journeyStyle(pillar)}>
            <span className="grow clip">{st.text}</span>
            {st.source === 'logged' ? (
              <button className="icon-btn" aria-label={`Remove ${st.text}`} onClick={() => removeStep(st.index!)}>
                <X size={16} />
              </button>
            ) : (
              <span className="small muted">from your day</span>
            )}
          </li>
        ))}
      </ul>
      <div className="stack" style={{ gap: 6 }}>
        <span className="small muted">Tap one you did</span>
        <div className="row wrap">
          {IDEAS[pillar].map((idea) => (
            <button key={idea} className="chip" onClick={() => save(idea)}>
              {idea}
            </button>
          ))}
        </div>
      </div>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          save(text);
        }}
      >
        <input className="field grow" value={text} onChange={(e) => setText(e.target.value)} placeholder="Or type your own" aria-label="Log a step" maxLength={120} enterKeyHint="done" />
        <button type="submit" className="btn primary" disabled={!text.trim()}>
          <Plus size={16} aria-hidden="true" /> Log
        </button>
      </form>
      <span className="small muted">Rose on {history.last30} of the last 30 days.</span>
    </Sheet>
  );
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** From 5 PM: one thing to do 1% better tomorrow. It shows on tomorrow's building. */
export function KaizenCard() {
  const s = useApp((a) => a.s)!;
  const now = useApp((a) => a.now);
  const setKaizen = useApp((a) => a.setKaizen);
  const saved = dayOf(s, now.date).kaizen ?? '';
  const [text, setText] = useState(saved);
  const [editing, setEditing] = useState(!saved);
  if (now.min < 17 * 60) return null;
  return (
    <section className="card stack" aria-label="One percent better">
      <p className="section-label">Kaizen</p>
      {editing ? (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            void setKaizen(text);
            setEditing(false);
          }}
        >
          <label className="label">
            One thing to do 1% better tomorrow
            <input className="field" value={text} onChange={(e) => setText(e.target.value)} maxLength={140} placeholder="Phone stays out of the bedroom" />
          </label>
          <button type="submit" className="btn" disabled={!text.trim()}>
            Save for tomorrow
          </button>
        </form>
      ) : (
        <div className="row">
          <p className="grow">{saved}</p>
          <button className="btn ghost" onClick={() => setEditing(true)}>
            Edit
          </button>
        </div>
      )}
    </section>
  );
}

/** Which pillars you showed up for today. What the app already saw is checked; tap what it could not see. */
function ShowedUp() {
  const s = useApp((a) => a.s)!;
  const now = useApp((a) => a.now);
  const toggle = useApp((a) => a.toggleShowedUp);
  const seen = seenOn(s, now.date, now);
  const tapped = new Set(dayOf(s, now.date).showedUp ?? []);
  return (
    <div className="stack" style={{ gap: 6 }}>
      <span>
        You showed up for <span className="small muted">Tap what the app could not see.</span>
      </span>
      <div className="pillar-chips" role="group" aria-label="Showed up for">
        {JOURNEYS.map((j) => {
          const auto = seen[j.id];
          const on = auto || tapped.has(j.id);
          const Icon = JOURNEY_ICON[j.id];
          return (
            <button
              key={j.id}
              type="button"
              className={`pillar-chip ${on ? 'risen' : ''}`}
              style={journeyStyle(j.id)}
              aria-pressed={on}
              aria-label={`${j.label}${auto ? ', seen today' : ''}`}
              disabled={auto}
              onClick={() => {
                if (!on) haptic();
                void toggle(j.id);
              }}
            >
              <Icon size={16} aria-hidden="true" />
              <span>{SHORT[j.id]}</span>
              {on && <Check size={12} strokeWidth={3} className="count" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
