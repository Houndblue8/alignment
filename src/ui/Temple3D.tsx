import { useEffect, useRef, useState } from 'react';
import type { Journey } from '../planner';
import type { FireState } from '../state/fire';
import type { BuildingState } from '../state/temple';
import { Building, buildingLabel } from './Building';
import type { TempleColors, TempleHandle, TempleState } from './temple/scene';
import { FireBuddy } from './FireBuddy';

function webglAvailable(): boolean {
  // Automated test browsers draw WebGL in software; they get the flat drawing so tests stay fast.
  if (navigator.webdriver) return false;
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

function readColors(): TempleColors {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  return {
    stone: v('--card', '#ffffff'),
    accent: v('--accent', '#b8892b'),
    muted: v('--muted', '#7a6f5a'),
    pillars: {
      faith: v('--j-faith', '#7a5c9e'),
      body: v('--j-body', '#b5653a'),
      sport: v('--j-sport', '#3f7d5a'),
      school: v('--j-school', '#3c6e91'),
      shs: v('--j-shs', '#b8892b'),
      life: v('--j-life', '#c2577a'),
    },
  };
}

/**
 * The building in 3D: drag to turn it, tap a column or the fire. three.js loads only here, after first paint.
 * Without WebGL (or if it fails to load) the flat drawing stands in.
 */
export function Temple3D({
  b,
  fire,
  theme,
  onPillar,
  onFire,
  still = false,
  fireOnly = false,
}: {
  b: BuildingState;
  fire: FireState;
  theme: string;
  onPillar?: (id: Journey) => void;
  onFire?: () => void;
  /** Home: shown, not handled (no dragging or tapping). */
  still?: boolean;
  /** Just the 3D fire, no temple (the Lost Day page). */
  fireOnly?: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const handle = useRef<TempleHandle | null>(null);
  const [failed, setFailed] = useState(() => typeof window === 'undefined' || !webglAvailable());
  const cb = useRef({ onPillar, onFire });
  cb.current = { onPillar, onFire };
  const state: TempleState = {
    foundation: b.foundation,
    pillars: b.pillars.map((p) => ({ id: p.id, rise: p.ratio, today: p.today })),
    buddies: b.torches.items.map((i) => ({ pillar: i.pillar, done: i.done })),
    fire: fire.value,
    level: fire.level,
  };
  const latest = useRef(state);
  latest.current = state;

  useEffect(() => {
    if (failed || !canvas.current) return;
    let alive = true;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    import('./temple/scene')
      .then(({ createTemple }) => {
        if (!alive || !canvas.current) return;
        handle.current = createTemple(canvas.current, {
          reducedMotion: reduced,
          still,
          fireOnly,
          onPillar: (id) => cb.current.onPillar?.(id),
          onFire: () => cb.current.onFire?.(),
        });
        handle.current.update(latest.current, readColors());
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
      handle.current?.dispose();
      handle.current = null;
    };
  }, [failed, still, fireOnly]);

  const key = JSON.stringify(state);
  useEffect(() => {
    handle.current?.update(latest.current, readColors());
  }, [key, theme]);

  if (failed) return fireOnly ? <FireBuddy level={fire.level} value={fire.value} label={buildingLabel(b, fire)} /> : <Building b={b} fire={fire} compact={still} />;
  return (
    <div className={`temple fire-${fire.level} ${still ? 'still' : ''} ${fireOnly ? 'fire-only' : ''}`} role="img" aria-label={buildingLabel(b, fire)} data-testid="temple">
      <canvas ref={canvas} />
    </div>
  );
}
