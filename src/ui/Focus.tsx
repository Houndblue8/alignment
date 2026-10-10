import { Plus, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { journeyLabel } from '../data/model';
import { haptic } from '../lib/haptics';
import { journeyStyle } from '../lib/format';
import { addDays, type Journey } from '../planner';
import { buildingFor, buildingLine, pillarHistory, pillarSteps } from '../state/pillars';
import { dayOf } from '../state/planning';
import { useApp } from '../state/store';
import { Building } from './Building';
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

/** Top of Today: the building, the coach line, and this morning's 1% from last night. */
export function FocusHero() {
  const s = useApp((a) => a.s)!;
  const now = useApp((a) => a.now);
  const [pillar, setPillar] = useState<Journey | null>(null);
  const b = useMemo(() => buildingFor(s, now.date, now), [s, now]);
  const kaizen = s.days[addDays(now.date, -1)]?.kaizen;
  return (
    <section className="card pad focus" aria-label="Focus">
      <Building b={b} onPillar={setPillar} />
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
  const Icon = JOURNEY_ICON[pillar];
  const save = (t: string) => {
    if (!t.trim()) return;
    haptic();
    void logStep(pillar, t);
    setText('');
  };
  return (
    <Sheet title={journeyLabel(pillar)} onClose={onClose}>
      <div className="row" style={journeyStyle(pillar)}>
        <Icon size={22} aria-hidden="true" className="journey-icon" />
        <p className="grow small muted">
          {steps.length === 0 ? 'No step yet today. One small step raises the pillar.' : `${steps.length} ${steps.length === 1 ? 'step' : 'steps'} today.`}
        </p>
      </div>
      <ul className="stack" style={{ margin: 0, padding: 0, listStyle: 'none' }} aria-label="Steps today">
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
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          save(text);
        }}
      >
        <input className="field grow" value={text} onChange={(e) => setText(e.target.value)} placeholder="A small step you took" aria-label="Log a step" maxLength={120} />
        <button type="submit" className="btn primary" disabled={!text.trim()}>
          <Plus size={16} aria-hidden="true" /> Log
        </button>
      </form>
      <div className="row wrap">
        {IDEAS[pillar].map((idea) => (
          <button key={idea} className="chip" onClick={() => save(idea)}>
            {idea}
          </button>
        ))}
      </div>
      <div className="stack" style={journeyStyle(pillar)}>
        <span className="small muted">Last 7 days</span>
        <div className="pillar-week" aria-label={`Rose on ${history.week.filter(Boolean).length} of the last 7 days`}>
          {history.week.map((on, i) => (
            <span key={i} className={on ? 'on' : ''} />
          ))}
        </div>
        <span className="small muted">Rose on {history.last30} of the last 30 days.</span>
      </div>
    </Sheet>
  );
}

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
