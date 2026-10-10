import { Check, MessageSquare, Mic, MicOff, Send, Undo2, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSpeech } from '../speech/useSpeech';
import { useApp } from '../state/store';
import { Sheet } from './Sheet';

let draft = '';

/** The talk box: reachable from every screen (floating button, or Ctrl or Cmd plus K). */
export function TalkBox() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <>
      <button className="talk-fab" aria-label="Open the talk box (Ctrl or Cmd plus K)" onClick={() => setOpen(true)}>
        <MessageSquare size={24} aria-hidden="true" />
      </button>
      {open && <TalkSheet onClose={() => setOpen(false)} />}
    </>
  );
}

function TalkSheet({ onClose }: { onClose: () => void }) {
  const dump = useApp((a) => a.dump);
  const busy = useApp((a) => a.busy);
  const card = useApp((a) => a.lastDump);
  const dismiss = useApp((a) => a.dismissDump);
  const [text, setTextState] = useState(draft);
  const [error, setError] = useState<string | null>(null);
  const textRef = useRef(text);
  const setText = useCallback((v: string) => {
    textRef.current = v;
    draft = v;
    setTextState(v);
  }, []);
  const speech = useSpeech(() => textRef.current, setText);

  async function send() {
    if (speech.listening) speech.stop();
    setError(null);
    dismiss();
    const r = await dump(textRef.current);
    if (r.ok) setText('');
    else if (r.message) setError(r.message);
  }

  return (
    <Sheet title="Talk" onClose={onClose}>
      <label className="sr-only" htmlFor="talk-input">
        Tell Alignment what changed
      </label>
      <textarea
        id="talk-input"
        className="field talk-input"
        rows={4}
        placeholder="Woke up at 7:30. Move my library block to 1 PM. Add: tax memo due Friday."
        value={text}
        onChange={(e) => {
          // Typing always works; it ends a voice session so the two never fight over the text.
          if (speech.listening) speech.stop();
          setText(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void send();
        }}
        data-testid="talk-input"
      />
      <div className="row">
        {speech.supported && (
          <button
            className={`icon-btn mic ${speech.listening ? 'on' : ''}`}
            aria-label={speech.listening ? 'Stop voice input' : 'Start voice input'}
            aria-pressed={speech.listening}
            onClick={speech.toggle}
          >
            {speech.listening ? <MicOff size={22} /> : <Mic size={22} />}
          </button>
        )}
        <span className="grow small muted">{speech.listening ? 'Listening' : ''}</span>
        <button className="btn primary" disabled={busy || !text.trim()} onClick={send}>
          <Send size={16} aria-hidden="true" /> {busy ? 'Working' : 'Send'}
        </button>
      </div>
      {speech.error && <p className="banner small">{speech.error}</p>}
      {error && (
        <p className="banner warn" role="alert">
          {error}
        </p>
      )}
      {card && <ResultCard />}
    </Sheet>
  );
}

function ResultCard() {
  const card = useApp((a) => a.lastDump)!;
  const undo = useApp((a) => a.undoDump);
  const busy = useApp((a) => a.busy);
  return (
    <section className="card stack" aria-label="Result" data-testid="result-card">
      {card.undone ? (
        <p className="muted">Undone. Nothing from that message is applied.</p>
      ) : (
        <>
          {card.done.length > 0 && (
            <ul className="stack" style={{ listStyle: 'none', padding: 0, margin: 0 }} aria-label="Done">
              {card.done.map((d) => (
                <li key={d} className="row" style={{ alignItems: 'flex-start' }}>
                  <Check size={16} aria-hidden="true" style={{ marginTop: 4, flex: 'none' }} />
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          )}
          {card.cantDo.length > 0 && (
            <div className="stack">
              <span className="small muted">Couldn't do</span>
              <ul className="stack" style={{ listStyle: 'none', padding: 0, margin: 0 }} aria-label="Couldn't do">
                {card.cantDo.map((c) => (
                  <li key={c.text} className="row small" style={{ alignItems: 'flex-start' }}>
                    <X size={14} aria-hidden="true" style={{ marginTop: 3, flex: 'none' }} />
                    <span>
                      "{c.text}": {c.reason}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {card.reshaped && (
            <p className="small muted" data-testid="reshaped">
              {card.reshaped}
            </p>
          )}
          {card.question && <p className="banner">{card.question}</p>}
          {card.done.length === 0 && card.cantDo.length === 0 && !card.question && <p className="muted">Nothing needed to change.</p>}
          <button className="btn" onClick={undo} disabled={busy} style={{ justifySelf: 'start' }}>
            <Undo2 size={16} aria-hidden="true" /> Undo
          </button>
        </>
      )}
    </section>
  );
}
