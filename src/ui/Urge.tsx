import { BatteryLow, Footprints, Hourglass, Sparkles, Wind } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { haptic } from '../lib/haptics';
import { shortDuration } from '../lib/format';
import { anchorStreaks, seasonRecord } from '../state/planning';
import { useApp } from '../state/store';
import { avoidingPick, boredKinds, firstStep, lightestPick, type BoredKind } from '../state/urge';
import { Sheet } from './Sheet';

/** One button for the moment the day wobbles: bored, avoiding, or tired (Appendix E 5). */
export function UrgeButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="urge-btn" onClick={() => setOpen(true)}>
        <Wind size={16} aria-hidden="true" /> Bored, avoiding, or tired?
      </button>
      {open && <UrgeSheet onClose={() => setOpen(false)} />}
    </>
  );
}

type Path = null | 'bored' | 'avoiding' | 'tired';

function UrgeSheet({ onClose }: { onClose: () => void }) {
  const [path, setPath] = useState<Path>(null);
  return (
    <Sheet title={path === 'bored' ? 'Bored' : path === 'avoiding' ? 'Avoiding' : path === 'tired' ? 'Tired' : 'Which one is it?'} onClose={onClose}>
      {path === null && (
        <div className="stack urge-choices">
          <button className="urge-choice" onClick={() => setPath('bored')}>
            <Sparkles size={22} aria-hidden="true" />
            <span>
              <strong>Bored</strong>
              <span className="small muted">Something to remember why</span>
            </span>
          </button>
          <button className="urge-choice" onClick={() => setPath('avoiding')}>
            <Hourglass size={22} aria-hidden="true" />
            <span>
              <strong>Avoiding</strong>
              <span className="small muted">Shrink it to a 5 minute start</span>
            </span>
          </button>
          <button className="urge-choice" onClick={() => setPath('tired')}>
            <BatteryLow size={22} aria-hidden="true" />
            <span>
              <strong>Tired</strong>
              <span className="small muted">A short walk or the lightest thing</span>
            </span>
          </button>
        </div>
      )}
      {path === 'bored' && <Bored onDone={onClose} />}
      {path === 'avoiding' && <Avoiding onDone={onClose} />}
      {path === 'tired' && <Tired onDone={onClose} />}
    </Sheet>
  );
}

function Bored({ onDone }: { onDone: () => void }) {
  const s = useApp((a) => a.s)!;
  const now = useApp((a) => a.now);
  const urlsFor = useApp((a) => a.photoUrls);
  const kinds = useMemo(() => boredKinds(s), [s]);
  const [k, setK] = useState(() => Math.floor(Math.random() * kinds.length));
  const [pick, setPick] = useState(() => Math.random());
  const [url, setUrl] = useState('');
  const kind: BoredKind = kinds[k % kinds.length]!;
  const photo = s.photos.length ? s.photos[Math.floor(pick * s.photos.length)]! : null;
  const quote = s.quotes.length ? s.quotes[Math.floor(pick * s.quotes.length)]! : null;
  useEffect(() => {
    if (kind === 'photo' && photo) void urlsFor([photo.storagePath]).then((u) => setUrl(u[photo.storagePath] ?? ''));
  }, [kind, photo, urlsFor]);
  const season = seasonRecord(s, now.date);
  const streaks = anchorStreaks(s, now.date);
  return (
    <div className="stack" data-testid="urge-bored">
      {kind === 'photo' && photo && (
        <figure className="urge-photo">
          {url && <img src={url} alt={photo.caption} />}
          <figcaption>{photo.caption}</figcaption>
        </figure>
      )}
      {kind === 'season' && (
        <div className="stack">
          <p className="big" style={{ textAlign: 'center' }}>
            {season.won}-{season.lost}
          </p>
          <p style={{ textAlign: 'center' }}>Your season. Cold shower streak {streaks.coldShower}, walk streak {streaks.walk}.</p>
          <p className="small muted" style={{ textAlign: 'center' }}>
            Boredom is a door. Walk through it toward something that builds you.
          </p>
        </div>
      )}
      {kind === 'quote' && quote && <blockquote className="urge-quote">{quote.text}</blockquote>}
      <div className="row">
        <button
          className="btn"
          onClick={() => {
            setK(k + 1);
            setPick(Math.random());
          }}
        >
          Another
        </button>
        <button className="btn primary grow" onClick={onDone}>
          Back to it
        </button>
      </div>
    </div>
  );
}

function Avoiding({ onDone }: { onDone: () => void }) {
  const s = useApp((a) => a.s)!;
  const today = useApp((a) => a.now.date);
  const task = avoidingPick(s, today);
  const [timing, setTiming] = useState(false);
  if (!task) return <p className="muted">Nothing on your list to avoid. That is its own kind of win.</p>;
  return (
    <div className="stack" data-testid="urge-avoiding">
      <div className="card stack">
        <strong>{task.title}</strong>
        <span className="small muted">{task.deferralCount ? `Pushed off ${task.deferralCount} ${task.deferralCount === 1 ? 'time' : 'times'}.` : 'The one you keep circling.'}</span>
      </div>
      <p>
        <span className="small muted">5 minute start: </span>
        {firstStep(task)}
      </p>
      {timing ? (
        <Timer minutes={5} doneText="You started. That was the hard part. Keep going, or stop here with no guilt." onDone={onDone} />
      ) : (
        <button className="btn primary" onClick={() => setTiming(true)}>
          Start 5 minutes
        </button>
      )}
    </div>
  );
}

function Tired({ onDone }: { onDone: () => void }) {
  const s = useApp((a) => a.s)!;
  const today = useApp((a) => a.now.date);
  const logStep = useApp((a) => a.logStep);
  const light = lightestPick(s, today);
  const [timing, setTiming] = useState<null | 'walk' | 'task'>(null);
  if (timing === 'walk')
    return (
      <Timer
        minutes={10}
        doneText="Good. Breathe once more, then pick the lightest thing."
        onDone={() => {
          void logStep('body', 'Short walk');
          onDone();
        }}
      />
    );
  if (timing === 'task' && light) return <Timer minutes={5} doneText={`You started ${light.title}. Keep going, or rest with a clear mind.`} onDone={onDone} />;
  return (
    <div className="stack" data-testid="urge-tired">
      <button className="urge-choice" onClick={() => setTiming('walk')}>
        <Footprints size={22} aria-hidden="true" />
        <span>
          <strong>A 10 minute walk</strong>
          <span className="small muted">No phone. Pray, or just breathe.</span>
        </span>
      </button>
      {light && (
        <button className="urge-choice" onClick={() => setTiming('task')}>
          <Hourglass size={22} aria-hidden="true" />
          <span>
            <strong>{light.title}</strong>
            <span className="small muted">
              The lightest thing on your list ({shortDuration(light.estimatedMinutes)}). Just 5 minutes of it: {firstStep(light)}
            </span>
          </span>
        </button>
      )}
    </div>
  );
}

/** A plain countdown. Ends with a buzz and a line. */
function Timer({ minutes, doneText, onDone }: { minutes: number; doneText: string; onDone: () => void }) {
  const [end] = useState(() => Date.now() + minutes * 60_000);
  const [left, setLeft] = useState(minutes * 60);
  useEffect(() => {
    const id = setInterval(() => {
      const l = Math.max(0, Math.round((end - Date.now()) / 1000));
      setLeft(l);
      if (l === 0) {
        haptic();
        clearInterval(id);
      }
    }, 500);
    return () => clearInterval(id);
  }, [end]);
  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, '0');
  return (
    <div className="stack" style={{ justifyItems: 'center', textAlign: 'center' }} data-testid="urge-timer">
      <p className="big" aria-live="polite">
        {mm}:{ss}
      </p>
      {left === 0 ? <p>{doneText}</p> : <p className="small muted">Stay with it. That is all.</p>}
      <button className="btn primary" onClick={onDone}>
        {left === 0 ? 'Done' : 'Stop here'}
      </button>
    </div>
  );
}
