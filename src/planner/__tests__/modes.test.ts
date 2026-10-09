// Part 14 test 8: Code Red and Lost Day.
import { describe, expect, test } from 'vitest';
import { planDay } from '../planDay';
import { MON, TUE, at, byEvent, dayInput, expectValidPlan, ofKind, one, task } from './fixtures';

describe('8. Code Red', () => {
  const plan = planDay(
    dayInput(TUE, {
      mode: 'codeRed',
      workout: 'field',
      tasks: [
        task('study', { title: 'Exam 2 practice set', journey: 'school', importance: 5, deadline: '2026-10-28', estimatedMinutes: 120 }),
        task('course', { title: 'Course module', journey: 'shs', importance: 5, estimatedMinutes: 90 }),
      ],
      big3: ['study', 'course'],
    }),
  );

  test('keeps the anchors, school items and immovable events', () => {
    expectValidPlan(plan);
    one(plan, 'anchor_cold_shower');
    one(plan, 'anchor_walk');
    expect(byEvent(plan, 'bus-tue')).toBeDefined();
    expect(plan.blocks.some((b) => b.taskId === 'study')).toBe(true);
  });

  test('pauses social events, non-school tasks, workouts and misc; practices keep running', () => {
    expect(byEvent(plan, 'club-a-tue')).toBeDefined();
    expect(byEvent(plan, 'dwts-tue')).toBeUndefined();
    expect(plan.blocks.some((b) => b.taskId === 'course')).toBe(false);
    expect(plan.belowTheLine).toContainEqual(expect.objectContaining({ taskId: 'course', reason: 'Paused by Code Red.' }));
    expect(plan.notes.join(' ')).toContain('Paused by Code Red: Dancing with the Stars.');
    expect(ofKind(plan, 'workout')).toHaveLength(0);
    expect(ofKind(plan, 'misc')).toHaveLength(0);
  });

  test('church and Epic large group keep running', () => {
    expect(byEvent(planDay(dayInput('2026-10-18', { mode: 'codeRed' })), 'church-sun')).toBeDefined();
    expect(byEvent(planDay(dayInput('2026-10-15', { mode: 'codeRed' })), 'epic-large-thu')).toBeDefined();
  });

  test('all in (severe) also pauses practices', () => {
    const severe = planDay(dayInput(TUE, { mode: 'codeRed', codeRedLevel: 'severe' }));
    expectValidPlan(severe);
    expect(byEvent(severe, 'club-a-tue')).toBeUndefined();
    expect(byEvent(planDay(dayInput(MON, { mode: 'codeRed', codeRedLevel: 'severe' })), 'flag-mon')).toBeUndefined();
    expect(byEvent(planDay(dayInput(MON, { mode: 'codeRed' })), 'flag-mon')).toBeDefined();
    expect(byEvent(severe, 'bus-tue')).toBeDefined();
  });

  test('the Side Hustle Summit floor drops to 10 minutes (D4)', () => {
    const floor = one(plan, 'shs_floor');
    expect(floor.end - floor.start).toBe(10);
  });
});

describe('8. Lost Day', () => {
  const plan = planDay(
    dayInput(MON, {
      mode: 'lostDay',
      now: at(13, 25),
      wakeMin: at(7),
      workout: 'weights',
      tasks: [task('big', { title: 'Course module', estimatedMinutes: 120 }), task('small', { title: 'Send invoice', estimatedMinutes: 20 })],
      big3: ['big', 'small'],
    }),
  );

  test('keeps immovable events and drops the rest', () => {
    expectValidPlan(plan);
    expect(byEvent(plan, 'tax-mon')).toMatchObject({ start: at(13, 30), end: at(14, 50) });
    expect(byEvent(plan, 'itp-mon')).toBeDefined();
    expect(byEvent(plan, 'epic-small-mon')).toBeUndefined();
    expect(byEvent(plan, 'flag-mon')).toBeUndefined();
  });

  test('lists the easiest salvage wins first', () => {
    expect(plan.notes[0]).toBe('Lost Day. Salvage wins, easiest first: Cold shower, Walk with God, Lunch, Send invoice, 30 minute workout.');
    expect(plan.blocks.some((b) => b.taskId === 'small')).toBe(true);
    expect(plan.blocks.some((b) => b.taskId === 'big')).toBe(false);
    const w = one(plan, 'workout');
    expect(w.end - w.start).toBe(30);
    expect(ofKind(plan, 'misc')).toHaveLength(0);
    expect(ofKind(plan, 'shs_floor')).toHaveLength(0);
  });

  test('nothing new is planned before now', () => {
    for (const b of plan.blocks.filter((x) => !x.eventId && x.kind !== 'travel')) expect(b.start).toBeGreaterThanOrEqual(at(13, 25));
  });
});
