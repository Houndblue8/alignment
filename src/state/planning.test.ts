import { describe, expect, test } from 'vitest';
import { emptyDay, type Snapshot, type TaskRow } from '../data/model';
import { seedSnapshot } from '../data/seedData';
import type { Block } from '../planner';
import { anchorStreaks, buildWeek, fillBig3, finalizePast, quoteFor, resultFor, suggestAgain, todayProgress, workoutsBefore } from './planning';

const task = (id: string, over: Partial<TaskRow> = {}): TaskRow => ({
  id,
  title: id,
  journey: 'shs',
  importance: 3,
  deadline: null,
  estimatedMinutes: 60,
  deferralCount: 0,
  workType: 'deep',
  createdAt: '2026-10-01',
  status: 'open',
  notes: '',
  completedAt: null,
  ...over,
});

const block = (id: string, date: string, over: Partial<Block> = {}): Block => ({
  id: `${date}:work:${id}`,
  date,
  start: 600,
  end: 660,
  kind: 'work',
  title: id,
  placeId: 'library',
  taskId: id,
  eventId: null,
  status: 'planned',
  pinned: false,
  source: 'planner',
  howto: null,
  ...over,
});

function snap(over: Partial<Snapshot> = {}): Snapshot {
  return { ...seedSnapshot(), ...over };
}

describe('Big 3 fill', () => {
  const s = snap({ tasks: [task('a', { importance: 5 }), task('b', { importance: 4 }), task('c', { importance: 3 }), task('d', { importance: 2 })] });

  test('fills empty slots with suggestions and keeps locked picks', () => {
    expect(fillBig3(s, '2026-10-12', [])).toEqual([
      { taskId: 'a', locked: false, accepted: false },
      { taskId: 'b', locked: false, accepted: false },
      { taskId: 'c', locked: false, accepted: false },
    ]);
    expect(fillBig3(s, '2026-10-12', [{ taskId: 'd', locked: true, accepted: true }]).map((i) => i.taskId)).toEqual(['d', 'a', 'b']);
  });

  test('Suggest again replaces only unaccepted suggestions', () => {
    const next = suggestAgain(s, '2026-10-12', [
      { taskId: 'a', locked: true, accepted: true },
      { taskId: 'b', locked: false, accepted: false },
      { taskId: 'c', locked: false, accepted: false },
    ]);
    expect(next[0]).toEqual({ taskId: 'a', locked: true, accepted: true });
    expect(next.map((i) => i.taskId)).not.toContain('b');
  });
});

describe('finalizing past days', () => {
  test('scores a day and counts a deferral for planned, unfinished work', () => {
    const d = '2026-10-12';
    const s = snap({
      tasks: [task('a'), task('b', { status: 'done', completedAt: '2026-10-12T20:00:00Z' })],
      days: { [d]: { ...emptyDay(d), checkinDone: true, coldShower: { done: true }, walk: { done: true }, big3: [{ taskId: 'b', locked: true, accepted: true }] } },
      blocks: [block('a', d)],
    });
    const fin = finalizePast(s, '2026-10-13');
    expect(fin.days.map((x) => [x.date, x.result])).toEqual([[d, 'win']]);
    expect(fin.taskIds).toEqual(['a']);
  });

  test('a missing day in the current week counts as a loss', () => {
    const s = snap({ days: { '2026-10-12': { ...emptyDay('2026-10-12'), result: 'win' } } });
    expect(finalizePast(s, '2026-10-14').days.map((x) => [x.date, x.result])).toEqual([['2026-10-13', 'loss']]);
  });

  test('Half win: Lost Day with a reason and two salvage items', () => {
    const d = '2026-10-12';
    const s = snap({
      days: { [d]: { ...emptyDay(d), walk: { done: true }, lostDay: true, lostDayReason: 'Sick' } },
      blocks: [block('m', d, { id: `${d}:meal:lunch`, kind: 'meal', taskId: null, status: 'done' })],
    });
    expect(resultFor(s, d)).toBe('half');
  });
});

describe('home numbers', () => {
  test('streaks, progress and quote by situation', () => {
    const s = snap({
      days: {
        '2026-10-11': { ...emptyDay('2026-10-11'), coldShower: { done: true }, walk: { done: true }, result: 'loss' },
        '2026-10-12': { ...emptyDay('2026-10-12'), coldShower: { done: true } },
      },
    });
    expect(anchorStreaks(s, '2026-10-12')).toEqual({ coldShower: 2, walk: 1 });
    expect(todayProgress(s, '2026-10-12')).toEqual({ done: 1, total: 2 });
    expect(quoteFor(s, '2026-10-12')!.tags).toContain('regret');
    expect(quoteFor(snap(), '2026-10-12')!.tags).toContain('general');
  });

  test('workouts this week count planned sessions that were not skipped', () => {
    const s = snap({
      blocks: [
        block('w1', '2026-10-12', { id: '2026-10-12:workout:weights', kind: 'workout', taskId: null }),
        block('w2', '2026-10-13', { id: '2026-10-13:workout:field', kind: 'workout', taskId: null, status: 'skipped' }),
        block('w3', '2026-10-05', { id: '2026-10-05:workout:weights', kind: 'workout', taskId: null }),
      ],
    });
    expect(workoutsBefore(s, '2026-10-14')).toEqual({ field: 0, weights: 1 });
  });
});

describe('buildWeek', () => {
  test('plans 7 days from the seed and keeps done blocks today', () => {
    const d = '2026-10-12';
    const s = snap({ days: { [d]: { ...emptyDay(d), wakeMin: 450, checkinDone: true, coldShower: { done: true } } } });
    const w = buildWeek(s, { date: d, min: 600 });
    expect(w.dates).toHaveLength(7);
    expect(w.blocks.find((b) => b.id === `${d}:anchor_cold_shower:1`)).toMatchObject({ start: 455, status: 'done' });
    expect(w.days[0]!.plan.bedtime?.bedMin).toBe(1395);
  });
});
