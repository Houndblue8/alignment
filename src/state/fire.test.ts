import { describe, expect, test } from 'vitest';
import { emptyDay, type DayRecord, type Snapshot, type TaskRow } from '../data/model';
import { seedSnapshot } from '../data/seedData';
import { addDays } from '../planner';
import { EMBER, REFINER_HEAT, dayHeat, fireFor } from './fire';

const D = '2026-10-12';
const task = (id: string): TaskRow =>
  ({ id, title: id, journey: 'school', importance: 3, estimatedMinutes: 60, deadline: null, workType: 'deep', deferralCount: 0, status: 'open', notes: '', completedAt: null, createdAt: '2026-10-01' }) as TaskRow;

const big3 = (n: number, done: number) => Array.from({ length: n }, (_, i) => ({ taskId: `t${i}`, locked: true, accepted: true, done: i < done }));

/** A full day: both anchors, all three torches, three other pillars, faith steps, a good night check. */
const strong = (date: string): DayRecord => ({
  ...emptyDay(date),
  checkinDone: true,
  coldShower: { done: true },
  walk: { done: true },
  big3: big3(3, 3),
  steps: [
    { pillar: 'faith', text: 'Read Romans 8' },
    { pillar: 'faith', text: 'Prayed for Josh' },
    { pillar: 'sport', text: 'Reps' },
    { pillar: 'shs', text: 'Outreach' },
    { pillar: 'life', text: 'Called mom' },
  ],
  inner: { mind: 4, heart: 4, spirit: 5 },
});

/** Everything breaks down but faith holds: the walk, prayer, a verse, Spirit 5; Mind and Heart low; no torches. */
const refined = (date: string): DayRecord => ({
  ...emptyDay(date),
  checkinDone: true,
  walk: { done: true },
  big3: big3(3, 0),
  steps: [
    { pillar: 'faith', text: 'Prayed through it' },
    { pillar: 'faith', text: 'Psalm 34' },
  ],
  inner: { mind: 2, heart: 1, spirit: 5 },
});

function snap(days: DayRecord[]): Snapshot {
  return { ...seedSnapshot(), days: Object.fromEntries(days.map((d) => [d.date, d])), blocks: [], tasks: ['t0', 't1', 't2'].map(task) };
}

const night = (date: string) => ({ date, min: 22 * 60 });

describe('the fire', () => {
  test('faith feeds it most; a full day burns hot', () => {
    const h = dayHeat(snap([strong(D)]), D, night(D));
    expect(h.faith).toBe(1);
    expect(h.life).toBeGreaterThan(0.8);
    expect(h.refiner).toBe(false);
    expect(h.heat).toBeGreaterThan(0.9);
  });

  test('everything breaks down but faith holds: a refiner\'s day, hotter than any ordinary day', () => {
    const h = dayHeat(snap([refined(D)]), D, night(D));
    expect(h.refiner).toBe(true);
    expect(h.heat).toBe(REFINER_HEAT);
    expect(h.heat).toBeGreaterThan(dayHeat(snap([strong(D)]), D, night(D)).heat);
    const f = fireFor(snap([strong(addDays(D, -1)), refined(D)]), night(D));
    expect(f.level).toBe('refiner');
    expect(f.value).toBeGreaterThan(1);
    expect(f.line).toMatch(/brighter than ever/);
  });

  test('a broken day without faith is not a refiner\'s day', () => {
    const d = { ...refined(D), walk: { done: false }, steps: [], inner: { mind: 2, heart: 1, spirit: 1 } };
    const h = dayHeat(snap([d]), D, night(D));
    expect(h.refiner).toBe(false);
    expect(h.heat).toBeLessThan(0.15);
  });

  test('an early morning never looks like a broken day', () => {
    const d = { ...refined(D), inner: null };
    expect(dayHeat(snap([d]), D, { date: D, min: 7 * 60 }).refiner).toBe(false);
    expect(dayHeat(snap([d]), D, night(D)).refiner).toBe(true);
  });

  test('the ember never dies, and it carries from day to day', () => {
    const empty = Array.from({ length: 20 }, (_, i) => ({ ...emptyDay(addDays(D, -20 + i)), checkinDone: true }));
    const cold = fireFor(snap(empty), { date: D, min: 600 });
    expect(cold.value).toBeCloseTo(EMBER, 5);
    expect(cold.level).toBe('ember');
    const week = Array.from({ length: 7 }, (_, i) => strong(addDays(D, -7 + i)));
    const warm = fireFor(snap(week), { date: D, min: 420 });
    expect(warm.level).toBe('bright');
    // Overnight it settles a little, never resets.
    expect(warm.value).toBeGreaterThan(0.8);
    expect(warm.trail).toHaveLength(8);
  });

  test('an unanswered night check is not counted as a low one', () => {
    const answered = { ...strong(D), inner: { mind: 3, heart: 3, spirit: 3 } };
    const silent = { ...strong(D), inner: null };
    expect(dayHeat(snap([silent]), D, night(D)).faith).toBe(1);
    expect(dayHeat(snap([answered]), D, night(D)).faith).toBeLessThan(1);
  });
});
