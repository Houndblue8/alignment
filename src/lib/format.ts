import type { CSSProperties } from 'react';
import type { BlockKind, Journey } from '../planner';

export { fmtTime, fmtDate, fmtDuration } from '../planner';

/** 450 -> "07:30" for <input type="time">. */
export const toHHMM = (min: number): string => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/** "07:30" -> 450. */
export function fromHHMM(v: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(v);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** 75 -> "1h 15m", 30 -> "30m". */
export function shortDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** Style that sets the journey color variable used by dots and card edges. */
export const journeyStyle = (j: Journey | null | undefined): CSSProperties =>
  (j ? { ['--jc' as string]: `var(--j-${j})` } : {}) as CSSProperties;

/** Journey color for blocks that are not tasks. */
export function kindJourney(kind: BlockKind): Journey | null {
  switch (kind) {
    case 'anchor_cold_shower':
    case 'anchor_walk':
      return 'faith';
    case 'workout':
    case 'shower':
      return 'body';
    case 'practice':
      return 'sport';
    case 'class':
    case 'library_work':
      return 'school';
    case 'shs_floor':
      return 'shs';
    case 'event':
      return 'life';
    default:
      return null;
  }
}
