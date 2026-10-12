import { Camera, Images, RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { developFile } from '../lib/film';
import { haptic } from '../lib/haptics';
import { monthName } from '../state/recap';
import { developsLabel, rollSize, shotNumber } from '../state/roll';
import { useApp } from '../state/store';
import { FilmCamera } from './FilmCamera';

/** A little film canister: the shot is on the roll, out of sight until the month develops. */
export function Canister({ size = 44 }: { size?: number }) {
  return (
    <svg className="canister" width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <rect x="10" y="8" width="24" height="34" rx="4" />
      <rect className="cap" x="8" y="5" width="28" height="6" rx="2" />
      <rect className="cap" x="8" y="39" width="28" height="6" rx="2" />
      <rect className="label" x="10" y="18" width="24" height="12" />
      <path className="leader" d="M34 22 h8 v8 h-8" />
    </svg>
  );
}

/**
 * Today's photo (Appendix E 1, Eli's Oct 12 changes): any time of day, one shot and one line. The camera is a
 * BeReal double shot with the disposable look, and the shot goes on the month's roll: hidden until the
 * month is over, then the recap develops it.
 */
export function PhotoCard() {
  const s = useApp((a) => a.s)!;
  const date = useApp((a) => a.now.date);
  const addPhoto = useApp((a) => a.addPhoto);
  const askQuestion = useApp((a) => a.captionQuestion);
  const busy = useApp((a) => a.busy);
  const today = s.photos.find((p) => p.date === date);
  const [camera, setCamera] = useState(false);
  const [shot, setShot] = useState<Blob | null>(null);
  const [caption, setCaption] = useState('');
  const [question, setQuestion] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const card = useRef<HTMLElement>(null);
  const { search } = useLocation();
  const month = date.slice(0, 7);
  const n = today ? shotNumber(s.photos, date) : shotNumber(s.photos, date) + 1;
  const label = `Shot ${n} of ${rollSize(month)}`;

  useEffect(() => {
    if (search.includes('photo=1')) card.current?.scrollIntoView({ block: 'center' });
  }, [search]);

  const took = (b: Blob) => {
    setCamera(false);
    setShot(b);
    setCaption(today?.caption ?? '');
    void askQuestion().then(setQuestion);
  };

  return (
    <section className="card stack" aria-label="Today's photo" ref={card}>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) took(await developFile(f, date));
        }}
        data-testid="photo-input"
      />
      {camera && (
        <FilmCamera
          date={date}
          label={label}
          onShot={took}
          onClose={() => setCamera(false)}
          onFallback={() => {
            setCamera(false);
            input.current?.click();
          }}
        />
      )}
      {shot ? (
        <form
          className="stack"
          onSubmit={async (e) => {
            e.preventDefault();
            haptic();
            await addPhoto(shot, caption);
            setShot(null);
          }}
        >
          <div className="row roll-line">
            <Canister />
            <span className="grow">
              <strong>Click.</strong> {label} is on the {monthName(month).split(' ')[0]} roll.
              <span className="small muted" style={{ display: 'block' }}>
                It develops {developsLabel(month)}.
              </span>
            </span>
          </div>
          {question && <p className="small muted">{question}</p>}
          <label className="label">
            One line about today
            <input className="field" value={caption} maxLength={140} onChange={(e) => setCaption(e.target.value)} placeholder="What this day was" />
          </label>
          <div className="row">
            <button type="button" className="btn ghost" onClick={() => setCamera(true)}>
              Retake
            </button>
            <button className="btn primary grow" disabled={busy || !caption.trim()}>
              {busy ? 'Saving' : 'Save to the roll'}
            </button>
          </div>
        </form>
      ) : today ? (
        <div className="row roll-line">
          <Canister />
          <span className="grow stack" style={{ gap: 2 }}>
            <span className="small muted">
              Shot {shotNumber(s.photos, date)} of {rollSize(month)} on the roll. Develops {developsLabel(month)}.
            </span>
            <span className="clamp2">{today.caption}</span>
          </span>
          <button className="icon-btn" aria-label="Retake today's photo" onClick={() => setCamera(true)}>
            <RefreshCw size={18} />
          </button>
        </div>
      ) : (
        <div className="stack">
          <div className="row">
            <Camera size={22} aria-hidden="true" />
            <span className="grow">Today's photo is still open. Any moment works.</span>
            <button className="btn primary" onClick={() => setCamera(true)}>
              Open camera
            </button>
          </div>
          <button className="btn ghost small" style={{ justifySelf: 'start', paddingLeft: 0 }} onClick={() => input.current?.click()}>
            Or pick from your photos
          </button>
        </div>
      )}
      <Link to="/memory" className="small muted row" style={{ textDecoration: 'none' }}>
        <Images size={14} aria-hidden="true" /> Memory
      </Link>
    </section>
  );
}
