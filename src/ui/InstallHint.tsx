import { Download, Share, X } from 'lucide-react';
import { useEffect, useState } from 'react';

const KEY = 'alignment.installHintDismissed';

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
}

const standalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
const isIos = () => /iPhone|iPad|iPod/i.test(navigator.userAgent);
const dismissed = () => {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
};

/** First-visit install hint: an Install button where the browser offers one, instructions on iPhone. */
export function InstallHint() {
  const [evt, setEvt] = useState<InstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState(() => standalone() || dismissed());
  useEffect(() => {
    const on = (e: Event) => {
      e.preventDefault();
      setEvt(e as InstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', on);
    return () => window.removeEventListener('beforeinstallprompt', on);
  }, []);
  const close = () => {
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      // Hidden for this visit only.
    }
    setHidden(true);
  };
  if (hidden || (!evt && !isIos())) return null;
  return (
    <section className="card row" aria-label="Install the app">
      {evt ? <Download size={20} aria-hidden="true" /> : <Share size={20} aria-hidden="true" />}
      <span className="grow small">
        {evt ? 'Install Alignment for a full-screen app with its own icon.' : 'Install: tap Share, then Add to Home Screen.'}
      </span>
      {evt && (
        <button
          className="btn primary"
          onClick={async () => {
            await evt.prompt();
            close();
          }}
        >
          Install
        </button>
      )}
      <button className="icon-btn" aria-label="Dismiss" onClick={close}>
        <X size={18} />
      </button>
    </section>
  );
}
