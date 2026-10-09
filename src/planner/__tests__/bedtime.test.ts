// Part 14 test 9, with DECISIONS D1.
import { describe, expect, test } from 'vitest';
import { computeBedtime, latestFeasibleWake } from '../bedtime';
import { planDay } from '../planDay';
import { planWeek } from '../planWeek';
import { EVENTS, MON, PLACES, SETTINGS, TUE, at, dayInput } from './fixtures';

const base = { wakeTargetMin: 390, sleepHours: 8, latestWakeMin: 540 };
const nineAmClass = { start: at(9), travel: 18, title: 'BUS 3302' };

describe('9. bedtime', () => {
  test('normal day: bed 10:30 PM, wake 6:30 AM, 8 hours', () => {
    expect(computeBedtime({ ...base, lastCommitmentEnd: at(20), tomorrowFirst: nineAmClass })).toEqual({
      bedMin: at(22, 30),
      wakeMin: at(6, 30),
      targetWakeMin: at(6, 30),
      sleepMinutes: 480,
      warning: null,
    });
  });

  test('late evening event: bed 45 minutes after it, wake later to keep 8 hours (D1)', () => {
    const b = computeBedtime({ ...base, lastCommitmentEnd: at(22, 30), tomorrowFirst: nineAmClass });
    expect(b).toMatchObject({ bedMin: at(23, 15), wakeMin: at(7, 15), sleepMinutes: 480, warning: null });
  });

  test('early class: wake is capped by the morning routine and the drive, with a short-sleep warning', () => {
    const early = { start: at(7), travel: 18, title: 'Lab' };
    expect(latestFeasibleWake(early.start, early.travel)).toBe(at(5, 55));
    const b = computeBedtime({ ...base, lastCommitmentEnd: at(21, 30), tomorrowFirst: early });
    expect(b).toMatchObject({ bedMin: at(22, 15), wakeMin: at(5, 55), targetWakeMin: at(5, 55), sleepMinutes: 460 });
    expect(b.warning).toBe('Sleep tonight comes out to 7 hours 40 minutes, short of 8 hours. Lab tomorrow needs the early start.');
  });

  test('early class with an early night: full sleep, no warning', () => {
    const b = computeBedtime({ ...base, lastCommitmentEnd: at(19), tomorrowFirst: { start: at(7), travel: 18 } });
    expect(b).toMatchObject({ bedMin: at(21, 55), wakeMin: at(5, 55), sleepMinutes: 480, warning: null });
  });

  test('wake is never after 9:00 AM', () => {
    const b = computeBedtime({ ...base, lastCommitmentEnd: 1470, tomorrowFirst: null });
    expect(b).toMatchObject({ bedMin: 1515, wakeMin: at(9), sleepMinutes: 465 });
    expect(b.warning).toBe('Sleep tonight comes out to 7 hours 45 minutes, short of 8 hours. Tomorrow needs the early start.');
    expect(computeBedtime({ ...base, lastCommitmentEnd: at(23, 59), tomorrowFirst: null }).wakeMin).toBeLessThanOrEqual(at(9));
  });

  test('a free evening: bed at the ideal time', () => {
    expect(computeBedtime({ ...base, lastCommitmentEnd: null, tomorrowFirst: null })).toMatchObject({ bedMin: at(22, 30), wakeMin: at(6, 30) });
  });

  test('Monday flag football: bed 11:15 PM, Tuesday wake 7:15 AM (Part 13)', () => {
    const mon = planDay(dayInput(MON));
    expect(mon.bedtime).toMatchObject({ bedMin: at(23, 15), wakeMin: at(7, 15), warning: null });
    const bed = mon.blocks.find((b) => b.kind === 'bed')!;
    expect(bed.start).toBe(at(23, 15));
    const winddown = mon.blocks.find((b) => b.kind === 'winddown')!;
    expect(winddown.end).toBe(at(23, 15));
    const week = planWeek({
      startDate: MON,
      today: { wakeMin: at(6, 30), anchors: { coldShower: { done: false }, walk: { done: false } }, big3: [], mode: 'normal' },
      codeRed: false,
      eventDefs: EVENTS,
      tasks: [],
      places: PLACES,
      settings: SETTINGS,
      workoutsThisWeek: { field: 0, weights: 0 },
      days: 2,
    });
    expect(week[1]!.date).toBe(TUE);
    expect(week[1]!.wakeMin).toBe(at(7, 15));
  });
});
