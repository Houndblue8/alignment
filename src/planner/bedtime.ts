// Bedtime and wake recommendation (Part 6 as changed by DECISIONS D1).
import { RULES } from './rules';
import { floor5, fmtDuration } from './time';
import type { Bedtime } from './types';

export interface BedtimeInput {
  /** End of today's last fixed commitment, minutes from today's midnight (may exceed 1440). */
  lastCommitmentEnd: number | null;
  /** Tomorrow's first fixed commitment and the drive to it from home. */
  tomorrowFirst: { start: number; travel: number; title?: string } | null;
  wakeTargetMin: number;
  sleepHours: number;
  latestWakeMin: number;
}

/** Latest wake that still fits the morning routine and the drive before a commitment. */
export function latestFeasibleWake(start: number, travelMin: number): number {
  return floor5(start - travelMin - RULES.morningRoutineMin - RULES.bufferMin);
}

/**
 * bedMin is in today's minutes (1380 = 11:00 PM, 1470 = 12:30 AM). wakeMin is tomorrow's minutes.
 * Wake = bed + sleep, but never later than 9:00 AM or the latest feasible wake for tomorrow.
 * Wake is never earlier than the target unless a commitment forces it.
 */
export function computeBedtime(input: BedtimeInput): Bedtime {
  const sleep = input.sleepHours * 60;
  const cap = Math.min(
    input.latestWakeMin,
    input.tomorrowFirst ? latestFeasibleWake(input.tomorrowFirst.start, input.tomorrowFirst.travel) : input.latestWakeMin,
  );
  const target = Math.min(input.wakeTargetMin, cap);
  const idealBed = target + 1440 - sleep;
  const earliestBed = input.lastCommitmentEnd === null ? 0 : input.lastCommitmentEnd + RULES.bedAfterLastMin;
  const bed = Math.max(idealBed, earliestBed);
  const wake = Math.min(bed + sleep - 1440, cap);
  const sleepMinutes = wake + 1440 - bed;
  let warning: string | null = null;
  if (sleepMinutes < sleep) {
    const why = input.tomorrowFirst?.title ? `${input.tomorrowFirst.title} tomorrow needs the early start.` : 'Tomorrow needs the early start.';
    warning = `Sleep tonight comes out to ${fmtDuration(sleepMinutes)}, short of ${input.sleepHours} hours. ${why}`;
  }
  return { bedMin: bed, wakeMin: wake, targetWakeMin: target, sleepMinutes, warning };
}
