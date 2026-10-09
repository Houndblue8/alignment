// Part 14 test 6.
import { describe, expect, test } from 'vitest';
import { planDay } from '../planDay';
import { chooseWorkout, planWeek } from '../planWeek';
import type { DayPlan } from '../types';
import { EVENTS, FRI, MON, PLACES, SAT, SETTINGS, SUN, THU, TUE, WED, at, byEvent, dayInput, expectValidPlan, ofKind, one } from './fixtures';

const week = (start = MON, done = { field: 0, weights: 0 }): DayPlan[] =>
  planWeek({
    startDate: start,
    today: { wakeMin: at(6, 30), anchors: { coldShower: { done: false }, walk: { done: false } }, big3: [], mode: 'normal' },
    codeRed: false,
    eventDefs: EVENTS,
    tasks: [],
    places: PLACES,
    settings: SETTINGS,
    workoutsThisWeek: done,
  });

describe('6. workouts', () => {
  const plans = week();
  const workouts = plans.flatMap((p) => ofKind(p, 'workout'));

  test('the week reaches 3 field and 3 weight sessions', () => {
    plans.forEach(expectValidPlan);
    expect(workouts.filter((w) => w.id.endsWith(':field'))).toHaveLength(3);
    expect(workouts.filter((w) => w.id.endsWith(':weights'))).toHaveLength(3);
    expect(plans.map((p) => p.workoutPlaced)).toEqual(['weights', 'field', 'weights', 'field', 'weights', null, 'field']);
  });

  test('Tuesday and Thursday field sessions are after the 9:00 AM class', () => {
    for (const p of plans.filter((x) => x.date === TUE || x.date === THU)) {
      const w = one(p, 'workout');
      const cls = p.blocks.find((b) => b.eventId?.startsWith('bus-'))!;
      expect(w.start).toBeGreaterThanOrEqual(cls.end);
    }
  });

  test('a home shower follows every workout before any study or work block', () => {
    for (const p of plans) {
      for (const w of ofKind(p, 'workout')) {
        const shower = ofKind(p, 'shower').find((s) => s.start >= w.end);
        expect(shower, `${p.date} shower`).toBeDefined();
        expect(shower!.placeId).toBe('home');
        expect(shower!.end - shower!.start).toBe(20);
        const between = p.blocks.filter((b) => b.start >= w.end && b.start < shower!.start);
        expect(between.every((b) => b.kind === 'travel')).toBe(true);
      }
    }
  });

  test('Monday and Wednesday lifts fit between tax class and the 4:30 PM Zoom class, near 50 minutes', () => {
    for (const p of plans.filter((x) => x.date === MON || x.date === WED)) {
      const w = one(p, 'workout');
      expect(w.start).toBeGreaterThanOrEqual(byEvent(p, p.date === MON ? 'tax-mon' : 'tax-wed')!.end);
      expect(w.end).toBeLessThanOrEqual(at(16, 30));
      expect(w.end - w.start).toBe(50);
    }
  });

  test('Sunday field session around 1:00 PM', () => {
    expect(one(plans[6]!, 'workout')).toMatchObject({ start: at(13), end: at(14) });
  });

  test('a missed session is caught up later in the week (Saturday)', () => {
    const rest = week(THU, { field: 1, weights: 1 });
    const done = rest.map((p) => p.workoutPlaced);
    expect(done).toEqual(['field', 'weights', 'weights', 'field', 'weights', 'field', 'weights']);
    expect(rest[2]!.date).toBe(SAT);
  });

  test('chooseWorkout', () => {
    expect(chooseWorkout(MON, { field: 0, weights: 0 })).toBe('weights');
    expect(chooseWorkout(SAT, { field: 3, weights: 3 })).toBeNull();
    expect(chooseWorkout(SAT, { field: 2, weights: 2 })).toBe('weights');
    expect(chooseWorkout(SUN, { field: 3, weights: 2 })).toBe('weights');
    expect(chooseWorkout(FRI, { field: 3, weights: 3 })).toBeNull();
  });

  test('no workout on a trip day (concert)', () => {
    const p = planDay(dayInput('2026-10-22', { workout: 'field' }));
    expect(p.workoutPlaced).toBeNull();
    expect(p.notes).toContain('No workout today: Bryson Tiller concert trip to LA.');
  });

  test('no workout on a no-work day (day off)', () => {
    const p = planDay(dayInput('2026-10-25', { workout: 'field' }));
    expect(p.workoutPlaced).toBeNull();
    expect(p.notes).toContain('No work planned today: Day off.');
  });
});
