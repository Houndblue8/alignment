// Part 14 tests 1 to 4, with the morning routine from DECISIONS D2 and D3.
import { describe, expect, test } from 'vitest';
import { planDay } from '../planDay';
import { MON, SAT, TUE, at, byEvent, dayInput, expectValidPlan, ofKind, one, task } from './fixtures';

describe('1. wake 7:30, both anchors not yet', () => {
  const plan = planDay(dayInput(TUE, { wakeMin: at(7, 30) }));

  test('cold shower 7:35 to 7:45, walk 7:45 to 8:00, snack 8:00 to 8:10', () => {
    expectValidPlan(plan);
    expect(one(plan, 'anchor_cold_shower')).toMatchObject({ start: at(7, 35), end: at(7, 45), status: 'planned' });
    expect(one(plan, 'anchor_walk')).toMatchObject({ start: at(7, 45), end: at(8, 0) });
    expect(one(plan, 'breakfast')).toMatchObject({ start: at(8, 0), end: at(8, 10) });
  });

  test('nothing is scheduled before 7:30', () => {
    for (const b of plan.blocks) expect(b.start, b.id).toBeGreaterThanOrEqual(at(7, 30));
  });

  test('the walk expands to 30 minutes when there is slack', () => {
    const sat = planDay(dayInput(SAT, { wakeMin: at(7, 30) }));
    expect(one(sat, 'anchor_walk')).toMatchObject({ start: at(7, 45), end: at(8, 15) });
    expect(one(sat, 'breakfast')).toMatchObject({ start: at(8, 15), end: at(8, 25) });
  });

  test('the walk shrinks to 10 minutes when the next fixed item is tight', () => {
    const tight = planDay(dayInput(TUE, { wakeMin: at(8, 5) }));
    expectValidPlan(tight);
    expect(one(tight, 'anchor_walk')).toMatchObject({ start: at(8, 20), end: at(8, 30) });
    expect(byEvent(tight, 'bus-tue')).toMatchObject({ start: at(9), end: at(10, 20) });
  });

  test('anchors come from the wake time, never a fixed clock time', () => {
    for (const w of [at(5, 50), at(6, 30), at(7, 10), at(9, 45)]) {
      const p = planDay(dayInput(SAT, { wakeMin: w }));
      expect(one(p, 'anchor_cold_shower').start).toBe(w + 5);
      expect(one(p, 'anchor_walk').start).toBe(w + 15);
    }
  });
});

describe('2. wake 7:30, cold shower already done', () => {
  test('it is marked done at 7:35, never at 9:00', () => {
    const plan = planDay(
      dayInput(TUE, { wakeMin: at(7, 30), now: at(9), anchors: { coldShower: { done: true }, walk: { done: false } } }),
    );
    expectValidPlan(plan);
    expect(one(plan, 'anchor_cold_shower')).toMatchObject({ start: at(7, 35), end: at(7, 45), status: 'done' });
  });

  test('a time Eli gives is used instead', () => {
    const plan = planDay(
      dayInput(TUE, { wakeMin: at(7, 30), anchors: { coldShower: { done: true, startMin: at(7, 40) }, walk: { done: false } } }),
    );
    expect(one(plan, 'anchor_cold_shower')).toMatchObject({ start: at(7, 40), end: at(7, 50), status: 'done' });
    expect(one(plan, 'anchor_walk').start).toBe(at(7, 50));
  });

  test('both done: the walk is done right after the shower', () => {
    const plan = planDay(dayInput(TUE, { wakeMin: at(7, 30), anchors: { coldShower: { done: true }, walk: { done: true } } }));
    expect(one(plan, 'anchor_walk')).toMatchObject({ start: at(7, 45), end: at(8, 0), status: 'done' });
  });
});

describe('3. Monday, wake 6:30', () => {
  const plan = planDay(dayInput(MON, { tasks: [task('deep', { estimatedMinutes: 300 })], big3: ['deep'] }));
  const library = ofKind(plan, 'library_work');

  test('library starts no earlier than arrival and ends by 9:30 AM', () => {
    expectValidPlan(plan);
    const arrival = one(plan, 'breakfast').end + 18;
    expect(library.length).toBeGreaterThan(0);
    for (const b of library) {
      expect(b.start).toBeGreaterThanOrEqual(arrival);
      expect(b.end).toBeLessThanOrEqual(at(9, 30));
      expect(b.placeId).toBe('library');
    }
    expect(library.reduce((m, b) => m + b.end - b.start, 0)).toBeGreaterThanOrEqual(90);
  });

  test('D1 practice 9:45 to 11:45 AM is untouched', () => {
    expect(byEvent(plan, 'd1-mon')).toMatchObject({ start: at(9, 45), end: at(11, 45), kind: 'practice' });
  });
});

describe('4. Tuesday library before the 9:00 AM class', () => {
  test('under 30 minutes left: no library block and a note says why', () => {
    const plan = planDay(dayInput(TUE, { wakeMin: at(7, 45), tasks: [task('a')], big3: ['a'] }));
    expectValidPlan(plan);
    expect(ofKind(plan, 'library_work')).toHaveLength(0);
    expect(plan.notes.join(' ')).toMatch(/No library block before BUS 3302: only \d+ minutes left after the morning routine and the drive/);
  });

  test('wake 6:30: the library block fits before class', () => {
    const plan = planDay(dayInput(TUE, { wakeMin: at(6, 30), tasks: [task('a')], big3: ['a'] }));
    const library = ofKind(plan, 'library_work');
    expect(library.length).toBeGreaterThan(0);
    expect(Math.max(...library.map((b) => b.end))).toBeLessThanOrEqual(at(8, 55));
    expect(library[0]!.taskId).toBe('a');
  });

  test('the anchors are never shortened to force the library block', () => {
    const plan = planDay(dayInput(TUE, { wakeMin: at(7, 45) }));
    expect(one(plan, 'anchor_cold_shower').end - one(plan, 'anchor_cold_shower').start).toBe(10);
    expect(one(plan, 'anchor_walk').end - one(plan, 'anchor_walk').start).toBeGreaterThanOrEqual(10);
  });
});
