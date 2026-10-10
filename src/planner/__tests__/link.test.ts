// Big 3 items that already are something on the day, and meals that are already planned (Oct 10 feedback).
import { describe, expect, test } from 'vitest';
import { linkTarget, mealIn, sameThing } from '../link';
import { planDay } from '../planDay';
import type { Block, EventInstance } from '../types';
import { SAT, at, dayInput, expectValidPlan, ofKind, task } from './fixtures';

describe('same thing, different words', () => {
  test.each([
    ['Lift', 'Lifts'],
    ['Tax memo', 'tax memo.'],
    ['Discipleship workshop', 'Disciplship workshop'],
    ['D Ship Workshop', 'Discipleship workshop'],
    ['Intentional Dinner', 'Dinner and intentional hangout with Epic people'],
    ['Outreach DMs', 'outreach dm'],
    ['Finish the tax memo', 'tax memo finish'],
  ])('%s = %s', (a, b) => expect(sameThing(a, b)).toBe(true));

  test.each([
    ['Tax', 'Tax class'],
    ['Tax memo', 'Tax class'],
    ['Lift', 'Life plan'],
    ['Study for midterm', 'Tax Midterm II'],
    ['Call mom', 'Call Isaac'],
  ])('%s is not %s', (a, b) => expect(sameThing(a, b)).toBe(false));

  test('meal words', () => {
    expect(mealIn('Dinner and intentional hangout')).toBe('dinner');
    expect(mealIn('Lunch with Sam')).toBe('lunch');
    expect(mealIn('Study at Whole Foods')).toBeNull();
  });
});

const manual = (id: string, title: string, start: number, end: number, placeId: string | null = null): Block => ({
  id: `${SAT}:misc:${id}`,
  date: SAT,
  start,
  end,
  kind: 'misc',
  title,
  placeId,
  taskId: null,
  eventId: null,
  status: 'planned',
  pinned: false,
  source: 'manual',
  howto: null,
});

const workshop: EventInstance = {
  id: 'workshop',
  title: 'Discipleship workshop',
  kind: 'event',
  start: at(10, 30),
  end: at(12),
  location: 'home',
  rankKey: 'general',
  rank: 9,
  immovable: false,
  overridableByCodeRed: true,
  allDay: false,
  noWork: false,
  away: false,
};

describe('Big 3 items link to what is already planned', () => {
  // Eli's Oct 10: Big 3 was "D Ship Workshop", "Intentional Dinner" and "Lift"; the talk box added the
  // workshop event and "Dinner and intentional hangout with Epic people".
  const tasks = [
    task('dship', { title: 'D Ship Workshop' }),
    task('dinner', { title: 'Intentional Dinner' }),
    task('lift', { title: 'Lift' }),
  ];
  const base = dayInput(SAT, { tasks, big3: ['dship', 'dinner', 'lift'], workout: 'weights' });
  const plan = planDay({
    ...base,
    events: [...base.events, workshop],
    pinned: [manual('hangout', 'Dinner and intentional hangout with Epic people', at(17, 30), at(20))],
  });

  test('no separate work blocks for things that already happen', () => {
    expectValidPlan(plan);
    expect(plan.blocks.filter((b) => b.kind === 'work' || b.kind === 'library_work')).toEqual([]);
    expect(plan.warnings.filter((w) => w.includes('Big 3'))).toEqual([]);
  });

  test('each item marks its block', () => {
    expect(plan.blocks.find((b) => b.taskId === 'dship')?.title).toBe('Discipleship workshop');
    expect(plan.blocks.find((b) => b.taskId === 'dinner')?.title).toBe('Dinner and intentional hangout with Epic people');
    expect(plan.blocks.find((b) => b.taskId === 'lift')?.kind).toBe('workout');
  });

  test('one dinner: the planned hangout is dinner', () => {
    expect(ofKind(plan, 'meal').filter((b) => b.id.endsWith(':dinner'))).toEqual([]);
    expect(plan.notes).toContain('Dinner is Dinner and intentional hangout with Epic people at 5:30 PM.');
  });

  test('a real work task still gets work time', () => {
    const p = planDay(dayInput(SAT, { tasks: [task('memo', { title: 'Tax memo' })], big3: ['memo'] }));
    expect(p.blocks.some((b) => b.kind === 'work' && b.taskId === 'memo')).toBe(true);
  });

  test('a block that is already this task stays its target; another task cannot take it', () => {
    const b = { ...manual('x', 'Dinner with Sam', at(18), at(19)), taskId: 'one' };
    expect(linkTarget('Dinner', [b], new Set(), 'one')?.id).toBe(b.id);
    expect(linkTarget('Dinner', [b], new Set(), 'two')).toBeNull();
  });
});

describe('a workout checked off early is kept', () => {
  test('replanning after the workout is done never places a second one', () => {
    const first = planDay(dayInput(SAT, { workout: 'weights' }));
    const w = first.blocks.find((b) => b.kind === 'workout')!;
    const again = planDay(dayInput(SAT, { workout: 'weights', now: at(9), pinned: [{ ...w, status: 'done', taskId: 'lift' }] }));
    expectValidPlan(again);
    const workouts = again.blocks.filter((b) => b.kind === 'workout');
    expect(workouts).toHaveLength(1);
    expect(workouts[0]).toMatchObject({ status: 'done', taskId: 'lift', start: w.start });
    expect(again.blocks.filter((b) => b.kind === 'shower')).toHaveLength(1);
  });
});
