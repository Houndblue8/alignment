// Part 14 test 11.
import { describe, expect, test } from 'vitest';
import { planWeek, type WeekInput } from '../planWeek';
import type { Task } from '../types';
import { EVENTS, MON, PLACES, SETTINGS, TUE, WED, at, expectValidPlan, task } from './fixtures';

const week = (over: Partial<WeekInput> = {}, tasks: Task[] = []) =>
  planWeek({
    startDate: MON,
    today: { wakeMin: at(6, 30), anchors: { coldShower: { done: false }, walk: { done: false } }, big3: [], mode: 'normal' },
    codeRed: false,
    eventDefs: EVENTS,
    tasks,
    places: PLACES,
    settings: SETTINGS,
    workoutsThisWeek: { field: 0, weights: 0 },
    ...over,
  });

const dwts = (plans: ReturnType<typeof week>) => plans.flatMap((p) => p.blocks.filter((b) => b.eventId === 'dwts-tue').map((b) => ({ date: p.date, b })));

describe('11. social events are moved, never deleted', () => {
  test('Dancing with the Stars moves from Tuesday (after practice) to Wednesday night', () => {
    const plans = week();
    plans.forEach(expectValidPlan);
    const shows = dwts(plans);
    expect(shows).toHaveLength(1);
    expect(shows[0]!.date).toBe(WED);
    expect(shows[0]!.b.start).toBeGreaterThanOrEqual(at(17));
  });

  test('also with practice block B', () => {
    const plans = week({ settings: { ...SETTINGS, practiceBlock: 'B' } });
    plans.forEach(expectValidPlan);
    expect(dwts(plans)).toHaveLength(1);
  });

  test('when it cannot fit inside the planned days, it is kept and named in a warning', () => {
    const plans = week({ startDate: TUE, days: 1 });
    expect(dwts(plans)).toHaveLength(0);
    expect(plans[0]!.warnings.join(' ')).toContain('Moved past Tuesday, Oct 13: Dancing with the Stars.');
  });
});

describe('11. tasks that cannot fit before their deadline', () => {
  test('produce a warning that names the task', () => {
    const plans = week({}, [task('huge', { title: 'Rebuild the website', deadline: TUE, estimatedMinutes: 2000 })]);
    const tue = plans[1]!;
    expect(tue.warnings.some((w) => w.startsWith('Rebuild the website does not fit before its deadline.'))).toBe(true);
    expect(plans[0]!.warnings.some((w) => w.startsWith('Rebuild the website'))).toBe(false);
  });

  test('a task without a deadline goes below the line, then carries forward', () => {
    const plans = week({ days: 2 }, [
      task('a', { importance: 5, estimatedMinutes: 600 }),
      task('later', { title: 'Organize photos', importance: 1, estimatedMinutes: 60 }),
    ]);
    const below = plans.flatMap((p) => p.belowTheLine.filter((b) => b.taskId === 'later'));
    expect(below.length).toBeGreaterThan(0);
    expect(below[0]!.reason).toBe('No free time left today.');
  });

  test('unfinished minutes carry into the next day', () => {
    const plans = week({ days: 2 }, [task('a', { importance: 5, estimatedMinutes: 400 })]);
    const day1 = plans[0]!.blocks.filter((b) => b.taskId === 'a').reduce((m, b) => m + b.end - b.start, 0);
    const day2 = plans[1]!.blocks.filter((b) => b.taskId === 'a').reduce((m, b) => m + b.end - b.start, 0);
    expect(day1).toBeGreaterThan(0);
    expect(day2).toBeGreaterThan(0);
    expect(day1 + day2).toBeLessThanOrEqual(400);
  });
});
