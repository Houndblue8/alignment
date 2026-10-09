// Scoring (Appendix B section 8).
import { addDays } from './time';

export type DayResult = 'win' | 'half' | 'loss';

export interface DayScoreInput {
  coldShowerDone: boolean;
  walkDone: boolean;
  /** Done flags of the Big 3 Eli chose that day (may be fewer than 3). */
  big3Done: boolean[];
  lostDay: boolean;
  lostDayReason: string | null;
  salvageCompleted: number;
}

export function scoreDay(d: DayScoreInput): DayResult {
  if (d.coldShowerDone && d.walkDone && d.big3Done.every(Boolean)) return 'win';
  if (d.lostDay && (d.lostDayReason ?? '').trim().length > 0 && d.salvageCompleted >= 2) return 'half';
  return 'loss';
}

export const MAX_HALF_WINS_PER_WEEK = 2;
export const SERIES_TO_WIN = 4;

export type SeriesLabel = 'Sweep' | 'Dominant' | 'Solid' | 'Won' | 'Lost';

/** Weekly series: win = 1, half = 0.5 (at most 2 count), 4 or more wins the series. */
export function scoreWeek(results: (DayResult | null)[]): { points: number; won: boolean; label: SeriesLabel } {
  const wins = results.filter((r) => r === 'win').length;
  const halves = Math.min(MAX_HALF_WINS_PER_WEEK, results.filter((r) => r === 'half').length);
  const points = wins + halves * 0.5;
  const label: SeriesLabel = points >= 7 ? 'Sweep' : points >= 6 ? 'Dominant' : points >= 5 ? 'Solid' : points >= 4 ? 'Won' : 'Lost';
  return { points, won: points >= SERIES_TO_WIN, label };
}

/**
 * Consecutive days, counting back from `today`, on which `done(date)` is true.
 * If today is not done yet it does not break the streak: counting starts from yesterday.
 */
export function streak(today: string, done: (date: string) => boolean): number {
  let d = done(today) ? today : addDays(today, -1);
  let n = 0;
  while (n < 3660 && done(d)) {
    n += 1;
    d = addDays(d, -1);
  }
  return n;
}
