// Speech to text for the talk box (Part 8 step 10).
// The box shows the text from before the mic was tapped, then ONE copy of what has been said so far.
// On every result the spoken part is rebuilt from the full results list (finished phrases, then the latest
// unfinished one) and replaces the previous spoken part. Nothing is ever appended per event.
// Android Chrome repeats results in continuous mode, so there: continuous is off, only finished phrases are
// kept, and listening restarts until Eli taps stop. One recognition session at a time.
import { useCallback, useEffect, useRef, useState } from 'react';

interface SpeechResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechEventLike {
  results: ArrayLike<SpeechResultLike>;
}
export interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type Ctor = new () => RecognitionLike;

function recognitionCtor(): Ctor | null {
  const w = window as unknown as { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const join = (...parts: string[]) => parts.map((p) => p.trim()).filter(Boolean).join(' ');

export function isAndroid(): boolean {
  return /Android/i.test(navigator.userAgent);
}

export function useSpeech(getText: () => string, setText: (v: string) => void) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<RecognitionLike | null>(null);
  const stopping = useRef(false);
  const base = useRef('');
  /** Android: finished phrases from earlier sessions. */
  const committed = useRef('');
  const supported = typeof window !== 'undefined' && recognitionCtor() !== null;

  const cleanup = useCallback(() => {
    if (rec.current) {
      rec.current.onresult = null;
      rec.current.onend = null;
      rec.current.onerror = null;
    }
    rec.current = null;
    setListening(false);
  }, []);

  const begin = useCallback(() => {
    const C = recognitionCtor();
    if (!C) return;
    const android = isAndroid();
    const r = new C();
    r.lang = 'en-US';
    r.interimResults = true;
    r.continuous = !android;
    let sessionFinals = '';
    r.onresult = (e) => {
      let finals = '';
      let interim = '';
      for (let i = 0; i < e.results.length; i++) {
        const res = e.results[i]!;
        const t = res[0].transcript;
        if (res.isFinal) finals = join(finals, t);
        else interim = t; // only the latest unfinished phrase
      }
      sessionFinals = finals;
      const spoken = android ? join(committed.current, finals, interim) : join(finals, interim);
      setText(join(base.current, spoken));
    };
    r.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        stopping.current = true;
        setError('Microphone access is blocked. Allow it in your browser settings, or type instead.');
      } else if (e.error !== 'no-speech' && e.error !== 'aborted') {
        setError('Voice input stopped. Tap the mic to try again, or type.');
      }
    };
    r.onend = () => {
      if (android) committed.current = join(committed.current, sessionFinals);
      if (android && !stopping.current) {
        // Keep listening until Eli taps stop.
        try {
          r.start();
          return;
        } catch {
          // Fall through to cleanup.
        }
      }
      cleanup();
    };
    rec.current = r;
    try {
      r.start();
      setListening(true);
    } catch {
      setError('Voice input could not start. Type instead.');
      cleanup();
    }
  }, [cleanup, setText]);

  const start = useCallback(() => {
    if (rec.current) return; // one session at a time
    setError(null);
    stopping.current = false;
    base.current = getText();
    committed.current = '';
    begin();
  }, [begin, getText]);

  const stop = useCallback(() => {
    stopping.current = true;
    rec.current?.stop();
  }, []);

  useEffect(
    () => () => {
      stopping.current = true;
      rec.current?.abort();
      cleanup();
    },
    [cleanup],
  );

  return { supported, listening, error, start, stop, toggle: () => (rec.current ? stop() : start()) };
}
