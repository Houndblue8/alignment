import { Check, Flame, Pencil, Plus, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { JOURNEYS, journeyLabel } from '../data/model';
import { haptic } from '../lib/haptics';
import { journeyStyle } from '../lib/format';
import { addDays, fmtDate, weekStart, type Journey } from '../planner';
import { fireFor, fireLog, LEVEL_NAME, type DayFire, type FirePart, type FireState } from '../state/fire';
import { pillarHistory, pillarSteps, type Step } from '../state/pillars';
import { buildingFor, buildingLine, needOn, seenOn, UNIT, weekTemple } from '../state/temple';
import { dayOf } from '../state/planning';
import { useApp } from '../state/store';
import { SHORT } from './Building';
import { Big3Section } from './Big3';
import { Temple3D } from './Temple3D';
import { Sheet } from './Sheet';
import { JOURNEY_ICON } from './icons';

/** Starter ideas for a small step, per pillar. Eli can type anything. */
const IDEAS: Record<Journey, string[]> = {
  faith: ['Read a chapter', 'Prayed for someone', 'Texted someone from Epic'],
  body: ['Did laundry', 'Cleaned my room', 'Meal prep', 'Ran an errand', 'In bed on time'],
  sport: ['Extra workout', 'Skill work or film', 'Mobility and stretching', 'Shots on my own'],
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
      {/* The Big 3 right under the fire: check one and watch its little flame hop in. */}
      <div className="focus-big3">
        <Big3Section />
      </div>
      <div className="pillar-chips" role="group" aria-label="Pillars">
        {b.pillars.map((p) => {
          const Icon = JOURNEY_ICON[p.id];
          const need = needOn(p.id, now.date);
          return (
            <button
              key={p.id}
              className={`pillar-chip ${p.steps >= need ? 'risen' : ''}`}
              style={journeyStyle(p.id)}
              aria-label={`${p.label}: ${p.steps} ${p.steps === 1 ? 'step' : 'steps'} today`}
              onClick={() => setPillar(p.id)}
            >
              <Icon size={16} aria-hidden="true" />
              <span>{SHORT[p.id]}</span>
              <span className="count" aria-hidden="true">
                {need > 1 ? `${Math.min(p.steps, need)}/${need}` : p.steps}
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

/** The fire's name and today's percent. */
export function FireMeter({ fire, onOpen }: { fire: FireState; onOpen: () => void }) {
  return (
    <button className={`fire-meter ${fire.level}`} onClick={onOpen} aria-label={`The fire: ${LEVEL_NAME[fire.level]}, ${fire.pct} percent. Open`} data-testid="fire-meter">
      <Flame size={18} aria-hidden="true" className="fire-icon" />
      <span className="fire-name">{LEVEL_NAME[fire.level]}</span>
      <span className="fire-bar" aria-hidden="true">
        <span style={{ width: `${fire.pct}%` }} />
      </span>
      <span className="small muted" aria-hidden="true">
        {fire.pct}%
      </span>
    </button>
  );
}

const DAY_LETTER = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** Seven little flames, Monday to Sunday, each the color its day reached. */
export function FireWeek({ days, label }: { days: (DayFire | null)[]; label: string }) {
  return (
    <div className="fire-week" role="list" aria-label={label}>
      {days.map((d, i) => (
        <span
          key={i}
          role="listitem"
          className={`fire-day ${d ? d.level : 'none'}`}
          aria-label={d ? `${DAYS[i]}: ${LEVEL_NAME[d.level]}, ${d.pct} percent` : `${DAYS[i]}: not yet`}
        >
          <Flame size={Math.round(12 + (d ? d.pct / 100 : 0) * 12)} aria-hidden="true" />
          <span className="small muted" aria-hidden="true">
            {DAY_LETTER[i]}
          </span>
        </span>
      ))}
    </div>
  );
}

export function FireSheet({ fire, onClose }: { fire: FireState; onClose: () => void }) {
  const s = useApp((a) => a.s)!;
  const now = useApp((a) => a.now);
  const t = fire.today;
  const log = useMemo(() => fireLog(s, now), [s, now]);
  return (
    <Sheet title="The fire" onClose={onClose}>
      <p className={`fire-title ${fire.level}`}>
        <Flame size={20} aria-hidden="true" /> {LEVEL_NAME[fire.level]}, {fire.pct}%
      </p>
      <p>{fire.line}</p>
      <div className="stack">
        <Meter label={t.foundation.label} part={t.foundation} />
        <Meter label={t.work.label} part={t.work} />
        <Meter label={t.faith.label} part={t.faith} />
      </div>
      <ul className="fire-pieces" aria-label="What feeds it today">
        {t.pieces.map((p, i) => (
          <li key={i} className={p.done ? 'done' : ''}>
            <span className="check-dot" aria-hidden="true">
              {p.done && <Check size={12} strokeWidth={3} />}
            </span>
            <span className="grow">{p.label}</span>
            <span className="small muted">+{Math.round(p.pts)}</span>
          </li>
        ))}
      </ul>
      <div className="stack" style={{ gap: 6 }}>
        <span className="small muted">The log</span>
        {log.map((w, i) => (
          <div key={w.weekStart} className="fire-log-row">
            <span className="small" style={{ width: 74 }}>
              {i === 0 ? 'This week' : `Week of ${fmtDate(w.weekStart).replace(/^\w+, /, '')}`}
            </span>
            <FireWeek days={w.days} label={i === 0 ? 'This week' : `Week of ${w.weekStart}`} />
            <span className="small muted">{w.avg}%</span>
          </div>
        ))}
      </div>
      <p className="small muted">
        Foundation 30 (water, cold shower, the walk), the Big 3 50, faith 20. Everything without faith tops out at 80. The last 20 is steps toward God:
        prayer, serving, His Word, Epic, church, sharing His love, or the night tap. All of it is a blue fire. A Lost Day given to Him (the one focus,
        the foundation, and a surrender before bed) is a purple fire. Ember under 25, Flame to 49, Blaze to 79, Burning bright to 99.
      </p>
    </Sheet>
  );
}

function Meter({ label, part }: { label: string; part: FirePart }) {
  return (
    <div className="row">
      <span className="small" style={{ width: 110 }}>
        {label}
      </span>
      <span className="fire-bar grow" aria-hidden="true">
        <span style={{ width: `${Math.round((part.pts / part.max) * 100)}%` }} />
      </span>
      <span className="small muted" style={{ width: 52, textAlign: 'right' }}>
        {Math.round(part.pts)} of {part.max}
      </span>
    </div>
  );
}

const SCALE = [1, 2, 3, 4, 5];
const INNER_ROWS: { key: 'mind' | 'heart' | 'spirit'; label: string; hint: string }[] = [
  { key: 'mind', label: 'Mind', hint: 'Clear and steady?' },
  { key: 'heart', label: 'Heart', hint: 'At peace, or carrying something?' },
  { key: 'spirit', label: 'Spirit', hint: 'Close to God today?' },
];

/**
 * From 5 PM: the night check. Mind, Heart, Spirit (1 to 5), "I drew closer to God today" (it fills the faith
 * part of the fire), one line, and the kaizen line: one thing to do 1% better tomorrow.
 */
export function InnerCheckCard({ always = false }: { always?: boolean }) {
  const s = useApp((a) => a.s)!;
  const now = useApp((a) => a.now);
  const setInner = useApp((a) => a.setInner);
  const rec = dayOf(s, now.date);
  const saved = rec.inner ?? null;
  const [v, setV] = useState({ mind: saved?.mind ?? 0, heart: saved?.heart ?? 0, spirit: saved?.spirit ?? 0, note: saved?.note ?? '', closer: !!saved?.closer, kaizen: rec.kaizen ?? '' });
  const [editing, setEditing] = useState(!saved);
  if (!always && now.min < 17 * 60) return null;
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
            void setInner({ mind: v.mind, heart: v.heart, spirit: v.spirit, note: v.note, closer: v.closer || undefined }, v.kaizen);
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
          <button type="button" className={`closer-tap ${v.closer ? 'on' : ''}`} aria-pressed={v.closer} onClick={() => (!v.closer && haptic(), setV({ ...v, closer: !v.closer }))}>
            <Flame size={18} aria-hidden="true" />
            <span className="grow">I drew closer to God today</span>
            {v.closer && <Check size={16} strokeWidth={3} aria-hidden="true" />}
          </button>
          <input className="field" value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} maxLength={160} placeholder="One line, if you want" aria-label="One line" />
          <label className="label">
            Kaizen: one thing to do 1% better tomorrow
            <input className="field" value={v.kaizen} onChange={(e) => setV({ ...v, kaizen: e.target.value })} maxLength={140} placeholder="Phone stays out of the bedroom" />
          </label>
          <button type="submit" className="btn primary" disabled={!v.mind || !v.heart || !v.spirit}>
            Save tonight's check
          </button>
        </form>
      ) : (
        <div className="row">
          <div className="grow stack" style={{ gap: 4 }}>
            <p className="small">
              Mind {v.mind}, Heart {v.heart}, Spirit {v.spirit}
              {v.closer ? '. Drew closer to God' : ''}
              {v.note.trim() ? `. ${v.note.trim()}` : ''}
            </p>
            {v.kaizen.trim() && (
              <p className="small" data-testid="kaizen-saved">
                <span className="muted">Tomorrow's 1%: </span>
                {v.kaizen.trim()}
              </p>
            )}
          </div>
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
        {needOn(pillar, now.date) > 1 && (
          <li className="small muted">
            Counts today at {needOn(pillar, now.date)} steps{pillar === 'faith' ? ': the walk and one more' : ': the water, the cold shower and one more'}.
          </li>
        )}
        {steps.length === 0 && <li className="small muted">No step yet today. One small step adds a stone.</li>}
        {steps.map((st) => (
          <StepRow key={st.key} step={st} pillar={pillar} />
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

/**
 * One item in a pillar. Edit: move it to another pillar or take it out. For something the app saw, choose
 * Just today, or Always (remembered as a rule, listed in Settings). A step you logged just moves or goes.
 */
function StepRow({ step, pillar }: { step: Step; pillar: Journey }) {
  const editStep = useApp((a) => a.editStep);
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<Journey | null | undefined>(undefined);
  const logged = step.source === 'logged';
  const apply = (to: Journey | null, scope: 'today' | 'always') => {
    haptic();
    void editStep(step.key, step.text, to, scope);
    setOpen(false);
    setTarget(undefined);
  };
  const choose = (to: Journey | null) => (logged ? apply(to, 'today') : setTarget(to));
  return (
    <li className="card journey stack step-row" style={journeyStyle(pillar)}>
      <div className="row">
        <span className="grow clip">{step.text}</span>
        <span className="small muted">{logged ? 'logged' : 'from your day'}</span>
        <button className="icon-btn" aria-label={`Edit ${step.text}`} aria-expanded={open} onClick={() => (setOpen(!open), setTarget(undefined))}>
          <Pencil size={16} />
        </button>
      </div>
      {open && target === undefined && (
        <div className="stack" style={{ gap: 6 }}>
          <span className="small muted">Move to</span>
          <div className="row wrap">
            {JOURNEYS.filter((j) => j.id !== pillar).map((j) => (
              <button key={j.id} className="chip" style={journeyStyle(j.id)} onClick={() => choose(j.id)}>
                {SHORT[j.id]}
              </button>
            ))}
          </div>
          <button className="btn ghost small danger-text" style={{ justifySelf: 'start', paddingLeft: 0 }} onClick={() => choose(null)}>
            <X size={14} aria-hidden="true" /> Take it out of {journeyLabel(pillar)}
          </button>
        </div>
      )}
      {open && target !== undefined && (
        <div className="stack" style={{ gap: 6 }}>
          <span className="small">
            {target ? `Count "${step.text}" in ${journeyLabel(target)}` : `Stop counting "${step.text}"`}
          </span>
          <div className="row">
            <button className="btn grow" onClick={() => apply(target, 'today')}>
              Just today
            </button>
            <button className="btn primary grow" onClick={() => apply(target, 'always')}>
              Always
            </button>
          </div>
        </div>
      )}
    </li>
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
