import { Check, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { haptic } from '../lib/haptics';
import { fireFor } from '../state/fire';
import { focusIdeas } from '../state/lostDay';
import { dayOf } from '../state/planning';
import { useApp } from '../state/store';
import { AnchorButton } from '../ui/AnchorButton';
import { buildingFor } from '../state/temple';
import { Temple3D } from '../ui/Temple3D';
import { FireMeter, FireSheet, InnerCheckCard } from '../ui/Focus';
import { PhotoCard } from '../ui/PhotoCard';

/** Pick the one faith focus: a faith event still ahead today, a quiet way back to Him, or his own words. */
function FocusPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const s = useApp((a) => a.s)!;
  const now = useApp((a) => a.now);
  const ideas = focusIdeas(s, now);
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="stack" style={{ gap: 6 }} role="group" aria-label="Focus ideas">
        {ideas.map((i) => (
          <button key={i} type="button" className={`focus-idea ${value === i ? 'on' : ''}`} aria-pressed={value === i} onClick={() => onChange(i)}>
            {i}
          </button>
        ))}
      </div>
      <input
        className="field"
        value={ideas.includes(value) ? '' : value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={120}
        placeholder="Or in your own words"
        aria-label="Your own focus"
      />
    </div>
  );
}

/** Starting a Lost Day: what happened, and the one thing to give the rest of today to. */
export function LostDayStart() {
  const start = useApp((a) => a.startLostDay);
  const busy = useApp((a) => a.busy);
  const on = useApp((a) => dayOf(a.s!, a.now.date).lostDay);
  const navigate = useNavigate();
  const [reason, setReason] = useState('');
  const [focus, setFocus] = useState('');
  if (on) return <LostDayPage />;
  return (
    <div className="lost-day stack lg">
      <div className="stack" style={{ gap: 6 }}>
        <p className="section-label">Lost Day</p>
        <h1>The day got away. It is not over.</h1>
        <p className="muted">
          Your Big 3 is set aside. Give the rest of today to one thing with God. Do it, keep the foundation, and surrender the day to Him before bed:
          that lights the purple fire.
        </p>
      </div>
      <label className="label">
        What happened? <span className="small muted">One line, if you want</span>
        <input className="field" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={140} placeholder="Did not study at all" />
      </label>
      <div className="stack" style={{ gap: 6 }}>
        <span>Your one focus before the day ends</span>
        <FocusPicker value={focus} onChange={setFocus} />
      </div>
      <button
        className="btn primary block"
        disabled={!focus.trim() || busy}
        onClick={async () => {
          haptic();
          await start(reason, focus);
          navigate('/', { replace: true });
        }}
      >
        Start Lost Day
      </button>
      <Link to="/today" className="btn ghost">
        Not now
      </Link>
    </div>
  );
}

/**
 * The Lost Day page (it takes over Home): the fire, the one focus, the foundation, and the surrender before bed.
 * The evening check and the photo join it at night.
 */
export function LostDayPage() {
  const s = useApp((a) => a.s)!;
  const now = useApp((a) => a.now);
  const setFocus = useApp((a) => a.setLostFocus);
  const setAnchor = useApp((a) => a.setAnchor);
  const rec = dayOf(s, now.date);
  const f = rec.lostFocus ?? { text: '', done: false, big3: [] };
  const fire = fireFor(s, now);
  const building = buildingFor(s, now.date, now);
  const [fireOpen, setFireOpen] = useState(false);
  const [pick, setPick] = useState('');
  const [surrender, setSurrender] = useState(f.surrender ?? '');
  const [editing, setEditing] = useState(!f.surrender);
  const night = now.min >= 17 * 60;
  return (
    <div className={`lost-day stack lg ${fire.level === 'purple' ? 'is-purple' : ''}`} data-testid="lost-day">
      <p className="section-label" style={{ textAlign: 'center' }}>
        Lost Day
      </p>
      <Temple3D b={building} fire={fire} theme={s.settings.theme} fireOnly onFire={() => setFireOpen(true)} />
      <FireMeter fire={fire} onOpen={() => setFireOpen(true)} />
      <p className="lost-line" data-testid="lost-line">
        {fire.line}
      </p>

      <section className="card stack lost-focus" aria-label="The one thing">
        <p className="section-label">The one thing</p>
        {f.text ? (
          <button
            className={`focus-check ${f.done ? 'is-done' : ''}`}
            role="checkbox"
            aria-checked={f.done}
            onClick={() => {
              if (!f.done) haptic();
              void setFocus({ done: !f.done });
            }}
          >
            <span className="check" aria-hidden="true">
              {f.done && <Check size={18} strokeWidth={3} />}
            </span>
            <span className="grow">{f.text}</span>
          </button>
        ) : (
          <>
            <FocusPicker value={pick} onChange={setPick} />
            <button className="btn primary" disabled={!pick.trim()} onClick={() => void setFocus({ text: pick.trim() })}>
              This is my one thing
            </button>
          </>
        )}
        <blockquote className="lost-verse">
          Casting all your care upon him; for he careth for you. <span className="small muted">1 Peter 5:7</span>
        </blockquote>
      </section>

      <div className="stack" style={{ gap: 6 }}>
        <p className="section-label">Foundation</p>
        <div className="anchors">
          <AnchorButton kind="water" done={rec.water.done} onToggle={(d) => setAnchor('water', d)} />
          <AnchorButton kind="coldShower" done={rec.coldShower.done} onToggle={(d) => setAnchor('coldShower', d)} />
          <AnchorButton kind="walk" done={rec.walk.done} onToggle={(d) => setAnchor('walk', d)} />
        </div>
      </div>

      <section className="card stack" aria-label="Surrender">
        <p className="section-label">Before bed: surrender</p>
        {editing ? (
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              haptic();
              void setFocus({ surrender });
              setEditing(false);
            }}
          >
            <label className="label">
              What are you giving to God tonight? The worries, the struggle, the day itself.
              <textarea className="field" rows={3} value={surrender} onChange={(e) => setSurrender(e.target.value)} maxLength={400} />
            </label>
            <button className="btn primary" disabled={!surrender.trim()}>
              I give it to Him
            </button>
          </form>
        ) : (
          <div className="row">
            <p className="grow">{f.surrender}</p>
            <button className="btn ghost" onClick={() => setEditing(true)}>
              Edit
            </button>
          </div>
        )}
      </section>

      {night && <InnerCheckCard />}
      {night && !s.photos.some((p) => p.date === now.date) && <PhotoCard />}

      <Link to="/today" className="row card" style={{ textDecoration: 'none', color: 'inherit' }}>
        <span className="grow">The rest of today</span>
        <ChevronRight size={18} aria-hidden="true" />
      </Link>
      {fireOpen && <FireSheet fire={fire} onClose={() => setFireOpen(false)} />}
    </div>
  );
}
