// Part 14 test 12, plus a sweep that checks every rule on many inputs.
import { describe, expect, test } from 'vitest';
import { planDay } from '../planDay';
import { planWeek } from '../planWeek';
import { addDays } from '../time';
import type { Mode, Task } from '../types';
import { EVENTS, MON, PLACES, SETTINGS, at, dayInput, expectValidPlan, task } from './fixtures';

const tasks: Task[] = [
  task('memo', { title: 'Tax research memo', journey: 'school', importance: 4, deadline: '2026-10-16', estimatedMinutes: 180 }),
  task('course', { title: 'Course module 2', importance: 5, estimatedMinutes: 240 }),
  task('email', { title: 'Reply to clients', estimatedMinutes: 30, workType: 'easy' }),
  task('laundry', { title: 'Laundry', journey: 'life', importance: 2, estimatedMinutes: 45, workType: 'errand' }),
];

const weekInput = (start: string, codeRed = false) => ({
  startDate: start,
  today: { wakeMin: at(6, 30), anchors: { coldShower: { done: false }, walk: { done: false } }, big3: ['memo', 'course', 'email'], mode: 'normal' as Mode },
  codeRed,
  eventDefs: EVENTS,
  tasks,
  places: PLACES,
  settings: SETTINGS,
  workoutsThisWeek: { field: 0, weights: 0 },
});

describe('12. determinism', () => {
  test('the same input twice gives identical output', () => {
    expect(planWeek(weekInput(MON))).toEqual(planWeek(weekInput(MON)));
    const d = dayInput(MON, { tasks, big3: ['memo'] });
    expect(planDay(d)).toEqual(planDay(structuredClone(d)));
  });

  test('block ids are date:kind:ref', () => {
    const p = planDay(dayInput(MON, { tasks, big3: ['memo'] }));
    const ids = p.blocks.map((b) => b.id);
    expect(ids).toContain('2026-10-12:anchor_cold_shower:1');
    expect(ids).toContain('2026-10-12:practice:d1-mon');
    expect(ids).toContain('2026-10-12:library_work:memo');
  });

  test('the planner does not change its input', () => {
    const d = dayInput(MON, { tasks, big3: ['memo'] });
    const copy = structuredClone(d);
    planDay(d);
    expect(d).toEqual(copy);
  });
});

describe('every rule holds across wake times, days and modes', () => {
  const wakes = Array.from({ length: 21 }, (_, i) => at(6) + i * 15); // 6:00 to 11:00
  const modes: Mode[] = ['normal', 'codeRed', 'lostDay'];
  for (let d = 0; d < 21; d++) {
    const date = addDays(MON, d);
    test(date, () => {
      for (const mode of modes) {
        for (const wakeMin of wakes) {
          const plan = planDay(
            dayInput(date, { wakeMin, mode, tasks, big3: ['memo', 'course', 'email'], workout: 'weights', now: mode === 'lostDay' ? wakeMin + 120 : null }),
          );
          expectValidPlan(plan);
          // Anchors are always planned, unless the whole day is already taken (then a warning says so).
          const shower = plan.blocks.some((b) => b.kind === 'anchor_cold_shower');
          expect(shower || plan.warnings.includes('No room for the cold shower today.')).toBe(true);
        }
      }
    });
  }

  test('three weeks in a row, normal and Code Red', () => {
    for (const start of [MON, addDays(MON, 7), addDays(MON, 14), addDays(MON, 21)]) {
      planWeek(weekInput(start)).forEach(expectValidPlan);
      planWeek(weekInput(start, true)).forEach(expectValidPlan);
    }
  });
});
