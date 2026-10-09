// Part 5 step 1 (fixed layer) and Part 13 conflicts.
import { describe, expect, test } from 'vitest';
import { confirmTentative, toInstance } from '../expand';
import { planDay } from '../planDay';
import { rankTasks } from '../priority';
import type { EventDef } from '../types';
import { EVENTS, FRI, MON, at, byEvent, dayInput, expectValidPlan, one, task } from './fixtures';

const def = (id: string): EventDef => EVENTS.find((e) => e.id === id)!;

describe('fixed layer', () => {
  test('when two fixed events overlap, the lower-ranked one is dropped with a warning', () => {
    const clash: EventDef = { ...def('epic-small-mon'), id: 'film', title: 'Film session', start: at(9, 30), end: at(10, 30), location: 'campus' };
    const plan = planDay(dayInput(MON, { events: [...dayInput(MON).events, toInstance(clash)] }));
    expectValidPlan(plan);
    expect(byEvent(plan, 'd1-mon')).toBeDefined();
    expect(byEvent(plan, 'film')).toBeUndefined();
    expect(plan.warnings).toContain('Film session overlaps D1 practice and was dropped for today.');
  });

  test('Nov 4: the midterm ends 10 minutes before the Zoom class at home, so the app warns', () => {
    const plan = planDay(dayInput('2026-11-04'));
    expectValidPlan(plan);
    expect(byEvent(plan, 'tax-midterm2-2026-11-04')).toMatchObject({ start: at(15), end: at(16, 20) });
    expect(byEvent(plan, 'tax-wed')).toBeUndefined();
    expect(plan.warnings).toContain(
      'Only 10 minutes between Tax Midterm II and ITP 3303 (Zoom, camera on), and the drive takes 18. Expect to join ITP 3303 (Zoom, camera on) about 8 minutes late.',
    );
  });

  test('Oct 28: the exam replaces the 12:00 class and the lift still follows tax class', () => {
    const plan = planDay(dayInput('2026-10-28', { workout: 'weights' }));
    expectValidPlan(plan);
    expect(byEvent(plan, 'acct-exam2-2026-10-28')).toMatchObject({ start: at(12), end: at(13, 20), kind: 'class' });
    expect(byEvent(plan, 'acct2-wed')).toBeUndefined();
    expect(byEvent(plan, 'tax-wed')).toMatchObject({ start: at(13, 30), end: at(14, 50) });
    expect(one(plan, 'workout').start).toBe(at(14, 55));
  });

  test('retreat days: away, no work, weekly events off', () => {
    const plan = planDay(dayInput('2026-10-23', { tasks: [task('a')], big3: ['a'] }));
    expectValidPlan(plan);
    expect(byEvent(plan, 'isaac-fri')).toBeUndefined();
    expect(plan.blocks.some((b) => b.taskId === 'a')).toBe(false);
    expect(plan.notes).toContain('No work planned today: Epic fall retreat.');
  });

  test('Oct 22: blocked from 9:00 AM for the concert, with a work session before leaving', () => {
    const plan = planDay(dayInput('2026-10-22', { tasks: [task('a', { estimatedMinutes: 120 })], big3: ['a'] }));
    expectValidPlan(plan);
    expect(byEvent(plan, 'bryson-tiller-2026-10-22')).toMatchObject({ start: at(9), end: 1440 });
    expect(byEvent(plan, 'bus-thu')).toBeUndefined();
    expect(byEvent(plan, 'epic-large-thu')).toBeUndefined();
    const work = plan.blocks.filter((b) => b.taskId === 'a');
    expect(work.length).toBeGreaterThan(0);
    for (const b of work) expect(b.end).toBeLessThanOrEqual(at(9));
    expect(plan.notes).toContain('Lunch happens during Bryson Tiller concert trip to LA.');
    expect(plan.notes).toContain('Dinner happens during Bryson Tiller concert trip to LA.');
    expect(plan.warnings.filter((w) => /lunch|dinner/i.test(w))).toEqual([]);
  });

  test('discipleship with Isaac is never planned until confirmed for a date', () => {
    expect(byEvent(planDay(dayInput(FRI)), 'isaac-fri')).toBeUndefined();
    const confirmed = confirmTentative(def('isaac-fri'), FRI, at(10), at(11));
    expect(confirmed).toMatchObject({ id: `isaac-fri-${FRI}`, date: FRI, start: at(10), end: at(11), recurringWeekly: false });
    expect(confirmed.tentative).toBeUndefined();
    const plan = planDay(dayInput(FRI, { events: [...dayInput(FRI).events, toInstance(confirmed)] }));
    expect(byEvent(plan, `isaac-fri-${FRI}`)).toMatchObject({ start: at(10), end: at(11) });
  });

  test('events before the wake time are noted, not planned', () => {
    const plan = planDay(dayInput('2026-10-18', { wakeMin: at(9, 45) }));
    expect(byEvent(plan, 'church-sun')).toBeUndefined();
    expect(plan.notes).toContain('Church at 8:00 AM was before your wake time.');
  });

  test("a task's steps become the block's how-to", () => {
    const t = task('a', { steps: [{ text: 'Open the draft', guess: false }, { text: 'Write the intro', guess: true }] });
    const plan = planDay(dayInput(FRI, { tasks: [t], big3: ['a'] }));
    expect(plan.blocks.find((b) => b.taskId === 'a')!.howto).toEqual(['Open the draft', 'Write the intro']);
  });

  test('ranking: on equal scores a task with a deadline comes before one without', () => {
    const none = task('a', { importance: 3 });
    const far = task('b', { importance: 3, deadline: '2026-11-30' });
    expect(rankTasks([none, far], MON).map((x) => x.id)).toEqual(['b', 'a']);
    expect(rankTasks([far, none], MON).map((x) => x.id)).toEqual(['b', 'a']);
  });
});
