// Part 14 test 5: late wake cuts flexible blocks in the order of Part 5 step 12.
import { describe, expect, test } from 'vitest';
import { planDay } from '../planDay';
import { at, byEvent, expectValidPlan, ofKind, one } from './fixtures';
import { lateWakeFloorOnly, lateWakeWithSocial, lateWakeWithWorkout } from './scenarios';

const ORDER = [/Misc block cut/, /General work moved below the line/, /moved to another day/, /Workout shortened/, /floor cut to 10 minutes/];
const position = (warnings: string[], re: RegExp) => warnings.findIndex((w) => re.test(w));

function expectCutOrder(warnings: string[]) {
  const seen = ORDER.map((re) => position(warnings, re)).filter((i) => i >= 0);
  expect(seen).toEqual([...seen].sort((a, b) => a - b));
}

describe('5. wake 9:00 AM with an 11:00 AM immovable event', () => {
  test('misc, general work, then social are cut, and the anchors and event remain', () => {
    const plan = planDay(lateWakeWithSocial());
    expectValidPlan(plan);
    expect(one(plan, 'anchor_cold_shower')).toMatchObject({ start: at(9, 5), end: at(9, 15) });
    expect(one(plan, 'anchor_walk').start).toBe(at(9, 15));
    expect(byEvent(plan, 'advising')).toMatchObject({ start: at(11), end: at(12) });
    expect(byEvent(plan, 'team')).toMatchObject({ start: at(17, 30), end: at(21, 30) });
    expect(ofKind(plan, 'misc')).toHaveLength(0);
    expect(byEvent(plan, 'game-night')).toBeUndefined();
    expect(plan.carryEvents.map((e) => e.id)).toEqual(['game-night']);
    expect(plan.belowTheLine.map((b) => b.taskId)).toContain('G');
    expect(plan.warnings.filter((w) => w.startsWith('Late start at 9:00 AM.'))).toEqual([
      'Late start at 9:00 AM. Misc block cut.',
      'Late start at 9:00 AM. General work moved below the line: Inbox cleanup.',
      'Late start at 9:00 AM. Game night moved to another day.',
    ]);
    const launch = plan.blocks.filter((b) => b.taskId === 'A');
    expect(launch.reduce((m, b) => m + b.end - b.start, 0)).toBeGreaterThanOrEqual(60);
  });

  test('when that is not enough, the workout shrinks to 30 minutes', () => {
    const plan = planDay(lateWakeWithWorkout());
    expectValidPlan(plan);
    const w = one(plan, 'workout');
    expect(w.end - w.start).toBe(30);
    expect(byEvent(plan, 'advising')).toMatchObject({ start: at(11), end: at(12) });
    expectCutOrder(plan.warnings);
    expect(position(plan.warnings, /Workout shortened to 30 minutes/)).toBeGreaterThan(position(plan.warnings, /Misc block cut/));
  });

  test('the floor is the last thing cut', () => {
    const plan = planDay(lateWakeFloorOnly());
    expectValidPlan(plan);
    const floor = one(plan, 'shs_floor');
    expect(floor.end - floor.start).toBe(10);
    expect(plan.warnings).toContain('Late start at 9:00 AM. Side Hustle Summit floor cut to 10 minutes.');
    expectCutOrder(plan.warnings);
  });

  test('cuts are only made when they make room', () => {
    // Nothing protected is short here, so no cut warnings even though the wake is late.
    const plan = planDay({ ...lateWakeWithSocial(), tasks: [], big3: [] });
    expect(plan.warnings.filter((w) => w.startsWith('Late start'))).toEqual([]);
    expect(ofKind(plan, 'misc')).toHaveLength(1);
  });
});
