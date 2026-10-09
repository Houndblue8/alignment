// Evenings are free (DECISIONS D10) and cuts only follow a late wake.
import { describe, expect, test } from 'vitest';
import { planDay } from '../planDay';
import { isPacificDst, sunsetMin } from '../time';
import { FRI, MON, SAT, at, dayInput, expectValidPlan, task } from './fixtures';
import { lateWakeWithWorkout } from './scenarios';

describe('sunset in San Luis Obispo', () => {
  test('matches published times within 5 minutes', () => {
    expect(Math.abs(sunsetMin('2026-10-12') - at(18, 33))).toBeLessThanOrEqual(5);
    expect(Math.abs(sunsetMin('2026-12-21') - at(16, 54))).toBeLessThanOrEqual(5);
    expect(Math.abs(sunsetMin('2026-06-21') - at(20, 22))).toBeLessThanOrEqual(5);
  });

  test('daylight saving time boundaries (2026: Mar 8 to Nov 1)', () => {
    expect(isPacificDst('2026-03-07')).toBe(false);
    expect(isPacificDst('2026-03-08')).toBe(true);
    expect(isPacificDst('2026-10-31')).toBe(true);
    expect(isPacificDst('2026-11-01')).toBe(false);
  });
});

describe('evenings are free', () => {
  const big = task('big', { title: 'Course module', estimatedMinutes: 600 });

  test('no work or study after sunset', () => {
    for (const date of [MON, FRI, SAT]) {
      const plan = planDay(dayInput(date, { tasks: [big], big3: ['big'] }));
      expectValidPlan(plan);
      const sunset = sunsetMin(date);
      for (const b of plan.blocks.filter((x) => x.kind === 'work' || x.kind === 'library_work' || x.kind === 'shs_floor')) {
        expect(b.end, `${date} ${b.id}`).toBeLessThanOrEqual(sunset);
      }
      expect(plan.notes.some((n) => n.startsWith('Evening is free after sunset'))).toBe(true);
    }
  });

  test('coffee shops are never planned at night', () => {
    const plan = planDay(dayInput(SAT, { tasks: [big], big3: ['big'] }));
    const shops = plan.blocks.filter((b) => b.placeId === 'scouts' || b.placeId === 'public_market');
    expect(shops.length).toBeGreaterThan(0);
    for (const b of shops) expect(b.end).toBeLessThanOrEqual(sunsetMin(SAT));
  });

  test('something due tomorrow may run after sunset, at home or the library', () => {
    const due = task('due', { title: 'Problem set', journey: 'school', deadline: '2026-10-18', estimatedMinutes: 900 });
    const plan = planDay(dayInput(SAT, { tasks: [due], big3: ['due'] }));
    expectValidPlan(plan);
    const late = plan.blocks.filter((b) => b.taskId === 'due' && b.end > sunsetMin(SAT));
    expect(late.length).toBeGreaterThan(0);
    for (const b of late) expect(['home', 'library']).toContain(b.placeId);
  });
});

describe('cuts only follow a late wake', () => {
  test('waking at the expected time cuts nothing even when the day is full', () => {
    const plan = planDay({ ...lateWakeWithWorkout(), expectedWakeMin: at(9) });
    expect(plan.warnings.filter((w) => w.startsWith('Late start'))).toEqual([]);
  });

  test('waking well after the expected time allows the cuts', () => {
    const plan = planDay({ ...lateWakeWithWorkout(), expectedWakeMin: at(7) });
    expect(plan.warnings.some((w) => w.startsWith('Late start at 9:00 AM.'))).toBe(true);
  });
});
