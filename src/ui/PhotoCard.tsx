import { Camera, Images, RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { haptic } from '../lib/haptics';
import { useApp } from '../state/store';

/** Today's photo (Appendix E 1): any time of day, one photo and one line. */
export function PhotoCard() {
  const s = useApp((a) => a.s)!;
  const date = useApp((a) => a.now.date);
  const addPhoto = useApp((a) => a.addPhoto);
  const urlsFor = useApp((a) => a.photoUrls);
  const askQuestion = useApp((a) => a.captionQuestion);
  const busy = useApp((a) => a.busy);
  const today = s.photos.find((p) => p.date === date);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [question, setQuestion] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const card = useRef<HTMLElement>(null);
  const { search } = useLocation();

  useEffect(() => {
    if (search.includes('photo=1')) card.current?.scrollIntoView({ block: 'center' });
  }, [search]);
  useEffect(() => {
    if (today) void urlsFor([today.storagePath]).then((m) => setUrl(m[today.storagePath] ?? ''));
  }, [today, urlsFor]);
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  const pick = (f: File | undefined) => {
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setCaption('');
    void askQuestion().then(setQuestion);
  };

  return (
    <section className="card stack" aria-label="Today's photo" ref={card}>
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} data-testid="photo-input" />
      {file && preview ? (
        <form
          className="stack"
          onSubmit={async (e) => {
            e.preventDefault();
            haptic();
            await addPhoto(file, caption);
            setFile(null);
            setPreview(null);
          }}
        >
          <img src={preview} alt="Today's photo preview" className="photo-preview" />
          {question && <p className="small muted">{question}</p>}
          <label className="label">
            One line about today
            <input className="field" value={caption} maxLength={140} onChange={(e) => setCaption(e.target.value)} placeholder="What this day was" />
          </label>
          <div className="row">
            <button type="button" className="btn ghost" onClick={() => (setFile(null), setPreview(null))}>
              Cancel
            </button>
            <button className="btn primary grow" disabled={busy || !caption.trim()}>
              {busy ? 'Saving' : 'Save photo'}
            </button>
          </div>
        </form>
      ) : today ? (
        <div className="row" style={{ alignItems: 'center' }}>
          {url ? <img src={url} alt={today.caption || "Today's photo"} className="photo-thumb" /> : <span className="photo-thumb empty" />}
          <span className="grow stack" style={{ gap: 2 }}>
            <span className="small muted">Today's photo</span>
            <span className="clamp2">{today.caption}</span>
          </span>
          <button className="icon-btn" aria-label="Replace today's photo" onClick={() => input.current?.click()}>
            <RefreshCw size={18} />
          </button>
        </div>
      ) : (
        <div className="row">
          <Camera size={22} aria-hidden="true" />
          <span className="grow">Today's photo is still open. Any moment works.</span>
          <button className="btn primary" onClick={() => input.current?.click()}>
            Add
          </button>
        </div>
      )}
      <Link to="/memory" className="small muted row" style={{ textDecoration: 'none' }}>
        <Images size={14} aria-hidden="true" /> Memory
      </Link>
    </section>
  );
}
