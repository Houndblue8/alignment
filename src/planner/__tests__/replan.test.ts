// Part 14 test 10.
import { describe, expect, test } from 'vitest';
import { diffBlocks } from '../diff';
import { planDay } from '../planDay';
import { keptForReplan, replan } from '../replan';
import type { Block } from '../types';
import { TUE, at, byEvent, dayInput, expectValidPlan, task } from './fixtures';

const input = dayInput(TUE, {
  tasks: [task('a', { title: 'Course module', estimatedMinutes: 120 }), task('b', { title: 'Invoices', estimatedMinutes: 45, workType: 'easy' })],
  big3: ['a', 'b'],
  workout: 'field',
});
const original = planDay(input);

const manual: Block = {
  id: `${TUE}:misc:call`,
  date: TUE,
  start: at(14),
  end: at(14, 30),
  kind: 'misc',
  title: 'Call Mom',
  placeId: 'home',
  taskId: null,
  eventId: null,
  status: 'planned',
  pinned: false,
  source: 'manual',
  howto: null,
};

// The morning happened: anchors and snack done, the first library chunk pinned by hand.
const existing: Block[] = original.blocks.map((b) => {
  if (b.kind === 'anchor_cold_shower' || b.kind === 'anchor_walk' || b.kind === 'breakfast') return { ...b, status: 'done' };
  if (b.kind === 'library_work') return { ...b, pinned: true };
  return b;
});
existing.push(manual);

const { pinned: _p, now: _n, ...rest } = input;
const replanInput = {
  ...rest,
  anchors: { coldShower: { done: true }, walk: { done: true } },
  existing,
};

describe('10. replan(now)', () => {
  const next = replan(replanInput, at(10, 12));

  test('keeps done, pinned and manual blocks exactly', () => {
    expectValidPlan(next);
    for (const kept of existing.filter((b) => b.status === 'done' || b.pinned || b.source === 'manual')) {
      expect(next.blocks.find((b) => b.id === kept.id)).toEqual(kept);
    }
  });

  test('rebuilds only after ceil5(now)', () => {
    const keptIds = new Set(keptForReplan(existing, at(10, 15)).map((b) => b.id));
    for (const b of next.blocks) {
      if (keptIds.has(b.id) || b.eventId || b.kind === 'travel') continue;
      expect(b.start, b.id).toBeGreaterThanOrEqual(at(10, 15));
    }
    expect(byEvent(next, 'bus-tue')).toMatchObject({ start: at(9), end: at(10, 20) });
  });

  test('the field session moves to make room for the manual block', () => {
    const d = diffBlocks(original.blocks, next.blocks);
    expect(d.added.map((c) => c.id)).toContain(manual.id);
    expect(next.blocks.some((b) => b.kind === 'workout')).toBe(true);
  });

  test('needs no AI and is deterministic', () => {
    expect(replan(replanInput, at(10, 12))).toEqual(next);
  });

  test('a missed planned block is planned again, not kept', () => {
    const missed = existing.map((b) => (b.kind === 'anchor_walk' ? { ...b, status: 'planned' as const } : b));
    const again = replan({ ...replanInput, anchors: { coldShower: { done: true }, walk: { done: false } }, existing: missed }, at(10, 40));
    const walk = again.blocks.find((b) => b.kind === 'anchor_walk')!;
    expect(walk.start).toBeGreaterThanOrEqual(at(10, 40));
  });

  test('replanning with no changes reports nothing changed', () => {
    const same = planDay(input);
    expect(diffBlocks(original.blocks, same.blocks).count).toBe(0);
  });
});
