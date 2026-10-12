import { RefreshCcw, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { develop, drawCover, SHOT_H, SHOT_W } from '../lib/film';
import { haptic } from '../lib/haptics';

type Facing = 'environment' | 'user';
type Phase = 'starting' | 'live' | 'second' | 'flash' | 'error';

/**
 * The daily camera (Eli, Oct 12): a BeReal double shot. One tap takes the main camera, then the other one a
 * moment later (a phone web app cannot run both at once), puts it small in the corner, and develops the shot
 * with the disposable look. A selfie is saved exactly as it was seen on screen (mirrored), never flipped.
 */
export function FilmCamera({ date, label, onShot, onClose, onFallback }: { date: string; label: string; onShot: (b: Blob) => void; onClose: () => void; onFallback: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [phase, setPhase] = useState<Phase>('starting');
  const [main, setMain] = useState<Facing>('environment');
  const [live, setLive] = useState<Facing>('environment');
  const [error, setError] = useState('');

  const stop = () => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  };

  const start = useCallback(async (facing: Facing) => {
    stop();
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('This browser has no camera access.');
    const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing }, width: { ideal: 1440 }, height: { ideal: 1920 } }, audio: false });
    stream.current = s;
    setLive(facing);
    const v = video.current!;
    v.srcObject = s;
    await v.play().catch(() => undefined);
    // Wait for the first real frame.
    for (let i = 0; i < 40 && !v.videoWidth; i++) await new Promise((r) => setTimeout(r, 50));
  }, []);

  useEffect(() => {
    let alive = true;
    start(main)
      .then(() => alive && setPhase('live'))
      .catch((e: unknown) => {
        if (!alive) return;
        setError(e instanceof Error && e.name === 'NotAllowedError' ? 'Camera access is off for this app. Turn it on in Settings, or use the phone camera.' : 'The camera did not start.');
        setPhase('error');
      });
    return () => {
      alive = false;
      stop();
    };
    // Starting again only when the main camera is flipped.
  }, [main, start]);

  const grab = (mirror: boolean): HTMLCanvasElement => {
    const c = document.createElement('canvas');
    c.width = SHOT_W;
    c.height = SHOT_H;
    drawCover(c.getContext('2d')!, video.current!, 0, 0, SHOT_W, SHOT_H, mirror);
    return c;
  };

  const shoot = async () => {
    haptic();
    const first = grab(live === 'user');
    const other: Facing = main === 'environment' ? 'user' : 'environment';
    setPhase('second');
    let inset: HTMLCanvasElement | null = null;
    try {
      await start(other);
      await new Promise((r) => setTimeout(r, 700));
      inset = grab(other === 'user');
    } catch {
      // One camera only (a laptop): the shot stands alone.
    }
    stop();
    haptic();
    setPhase('flash');
    onShot(await develop(first, inset, date));
  };

  return createPortal(
    <div className="film-camera" role="dialog" aria-modal="true" aria-label="Camera">
      <video ref={video} playsInline muted className={live === 'user' ? 'mirror' : ''} />
      <div className="film-top">
        <button className="film-icon" aria-label="Close the camera" onClick={onClose}>
          <X size={24} />
        </button>
        <span className="film-count">{label}</span>
        <span className="film-icon" aria-hidden="true" />
      </div>
      {phase === 'second' && <p className="film-hint">{main === 'environment' ? 'Now you. Hold still.' : 'Now the view.'}</p>}
      {phase === 'flash' && <div className="film-flash" aria-hidden="true" />}
      {phase === 'error' ? (
        <div className="film-error">
          <p>{error}</p>
          <button className="btn primary" onClick={onFallback}>
            Use the phone camera
          </button>
        </div>
      ) : (
        <div className="film-bottom">
          <span className="film-icon" aria-hidden="true" />
          <button className="film-shutter" aria-label="Take the photo" disabled={phase !== 'live'} onClick={() => void shoot()} />
          <button className="film-icon" aria-label="Switch cameras" disabled={phase !== 'live'} onClick={() => setMain(main === 'environment' ? 'user' : 'environment')}>
            <RefreshCcw size={24} />
          </button>
        </div>
      )}
    </div>,
    document.body,
  );
}
