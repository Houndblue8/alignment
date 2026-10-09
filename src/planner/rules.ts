// Planner rule constants. Source: the brief and DECISIONS.md. Change rules here, not in code.
import type { RankKey, WorkoutType } from './types';

export const RULES = {
  bufferMin: 5,
  coldShowerOffset: 5,
  coldShowerMin: 10,
  walkDefault: 15,
  walkMin: 10,
  walkMax: 30,
  /** Minutes of room beyond the default walk before the walk starts to expand. */
  walkSlack: 60,
  snackMin: 10,
  /** No snack is planned when the day (re)starts at or after this time. */
  snackLatest: 660,
  /** Anchors plus snack with the default walk (D2, D3). */
  morningRoutineMin: 40,
  lunch: { from: 660, to: 870, len: 30, fallbackLen: 15, lastResortTo: 960 },
  dinner: { from: 1050, to: 1200, min: 30, max: 45, lastResortFrom: 1020, lastResortTo: 1290 },
  misc: { min: 30, max: 45, preferFrom: 900 },
  workout: { min: 30, shrinkFloor: 45, default: 60, preferFrom: 780, nearClass: 30 },
  homeShowerMin: 20,
  libraryMin: 30,
  /** Minutes to get ready between a library block and a practice (Monday D1: library until 9:30 for 9:45). */
  practicePrep: 15,
  /** Waking more than this many minutes after the expected wake counts as a late wake. */
  lateWakeGrace: 15,
  /** Minutes each Big 3 item should get today before flexible items are cut to make room. */
  big3Session: 60,
  chunkMin: 25,
  /** A task that already got time today and has less than this left is treated as covered (estimates are rough). */
  absorbUnder: 15,
  chunkMax: 90,
  winddownMin: 30,
  bedAfterLastMin: 45,
  shsFloorMin: 30,
  shsFloorMinimal: 10,
  defaultTravelMin: 15,
  examWindowDays: 7,
} as const;

/** Priority ladder, highest first (Appendix B). Church sits with the top tier. */
export const RANK: Record<RankKey, number> = {
  trip: 1,
  church: 1,
  epic_large: 1,
  retreat: 1,
  tournament: 1,
  club_practice: 2,
  flag_football: 3,
  school: 4,
  client: 5,
  shs: 6,
  epic_small: 7,
  workout: 8,
  discipleship: 9,
  social: 10,
  general: 11,
};

/** Default workout per weekday (0 = Sunday). Saturday is off unless the week needs a catch-up. */
export const WORKOUT_BY_WEEKDAY: (WorkoutType | null)[] = ['field', 'weights', 'field', 'weights', 'field', 'weights', null];

export const WEEKLY_TARGET: Record<WorkoutType, number> = { field: 3, weights: 3 };
