import { X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { develop, drawCover, SHOT_H, SHOT_W } from '../lib/film';
import { haptic } from '../lib/haptics';

type Phase = 'starting' | 'selfie' | 'countdown' | 'flash' | 'error';

/** Native 4:3 frames: the full width of each lens, never a cropped (zoomed in) mode. */
const FRAME = { width: { ideal: 1920 }, height: { ideal: 1440 } };
const COUNTDOWN = 3;

/**
 * The back camera to use: the ultra wide lens (the 0.5x) when the phone has one, found by its label
 * ("Back Ultra Wide Camera" on iPhone). Labels are only readable once camera access is granted.
 */
async function wideBackCamera(): Promise<MediaTrackConstraints> {
  try {
    const cams = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
    const wide = cams.find((d) => /ultra ?wide/i.test(d.label));
    if (wide) return { deviceId: { exact: wide.deviceId }, ...FRAME };
  } catch {
    // Fall back to whatever back camera the phone picks.
  }
  return { facingMode: { ideal: 'environment' }, ...FRAME };
}

/**
 * The daily camera (Eli, Oct 12): the selfie first at 1x, then a 3 second countdown and the back camera on
 * its 0.5x ultra wide lens. The view becomes the big picture with the selfie small in the corner (BeReal),
 * developed with the disposable look. The selfie is saved exactly as seen (mirrored), never flipped.
 * test: a trial shot that is shown, not saved.
 */
export function FilmCamera({ date, label, test = false, onShot, onClose, onFallback }: { date: string; label: string; test?: boolean; onShot: (b: Blob) => void; onClose: () => void; onFallback: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [phase, setPhase] = useState<Phase>('starting');
  const [mirror, setMirror] = useState(true);
  const [count, setCount] = useState(COUNTDOWN);
  const [error, setError] = useState('');

  const stop = () => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  };

  const start = async (constraints: MediaTrackConstraints, selfie: boolean) => {
    stop();
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('This browser has no camera access.');
    const s = await navigator.mediaDevices.getUserMedia({ video: constraints, audio: false });
    stream.current = s;
    setMirror(selfie);
    const v = video.current!;
    v.srcObject = s;
    await v.play().catch(() => undefined);
    for (let i = 0; i < 40 && !v.videoWidth; i++) await new Promise((r) => setTimeout(r, 50));
  };

  useEffect(() => {
    let alive = true;
    start({ facingMode: { ideal: 'user' }, ...FRAME }, true)
      .then(() => alive && setPhase('selfie'))
      .catch((e: unknown) => {
        if (!alive) return;
        setError(e instanceof Error && e.name === 'NotAllowedError' ? 'Camera access is off for this app. Turn it on in Settings, or use the phone camera.' : 'The camera did not start.');
        setPhase('error');
      });
    return () => {
      alive = false;
      stop();
    };
  }, []);

  const grab = (mirrored: boolean): HTMLCanvasElement => {
    const c = document.createElement('canvas');
    c.width = SHOT_W;
    c.height = SHOT_H;
    drawCover(c.getContext('2d')!, video.current!, 0, 0, SHOT_W, SHOT_H, mirrored);
    return c;
  };

  const shoot = async () => {
    haptic();
    const selfie = grab(true);
    setPhase('countdown');
    setCount(COUNTDOWN);
    let view: HTMLCanvasElement | null = null;
    try {
      await start(await wideBackCamera(), false);
      for (let k = COUNTDOWN; k > 0; k--) {
        setCount(k);
        await new Promise((r) => setTimeout(r, 1000));
      }
      view = grab(false);
    } catch {
      // No back camera (a laptop): the selfie stands alone.
    }
    stop();
    haptic();
    setPhase('flash');
    onShot(await develop(view ?? selfie, view ? selfie : null, date));
  };

  return createPortal(
    <div className="film-camera" role="dialog" aria-modal="true" aria-label="Camera">
      {/* A little digital camera: the viewfinder in the middle of the body, the shutter under it. */}
      <div className="digicam">
        <div className="film-top">
          <button className="film-icon" aria-label="Close the camera" onClick={onClose}>
            <X size={22} />
          </button>
          <span className="film-count">{test ? 'Test shot, not saved' : label}</span>
          <span className="digicam-led" aria-hidden="true" />
        </div>
        <div className="digicam-screen">
          <video ref={video} playsInline muted className={mirror ? 'mirror' : ''} />
          {phase === 'countdown' && (
            <div className="film-countdown" aria-live="assertive">
              <span className="film-number">{count}</span>
            </div>
          )}
          {phase === 'flash' && <div className="film-flash" aria-hidden="true" />}
          {phase === 'error' && (
            <div className="film-error">
              <p>{error}</p>
              <button className="btn primary" onClick={onFallback}>
                Use the phone camera
              </button>
            </div>
          )}
        </div>
        <p className="film-hint">
          {phase === 'countdown' ? 'Point it at what is in front of you' : phase === 'selfie' ? `You first. Then the view in ${COUNTDOWN}.` : test ? 'Test shots are not saved' : 'Alignment'}
        </p>
        <div className="film-bottom">
          <span className="digicam-grip" aria-hidden="true" />
          <button className="film-shutter" aria-label="Take the photo" disabled={phase !== 'selfie'} onClick={() => void shoot()} />
          <span className="digicam-grip" aria-hidden="true" />
        </div>
      </div>
    </div>,
    document.body,
  );
}
