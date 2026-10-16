import { describe, expect, test } from 'vitest';
import { emptyDay, type DayRecord, type Snapshot, type TaskRow } from '../data/model';
import { seedSnapshot } from '../data/seedData';
import { addDays } from '../planner';
import { dayFire, EMBER, fireFor, fireLog, levelFor } from './fire';

// Saturday Oct 17: the first day with the water anchor.
const D = '2026-10-17';
const task = (id: string): TaskRow =>
  ({ id, title: id, journey: 'school', importance: 3, estimatedMinutes: 60, deadline: null, workType: 'deep', deferralCount: 0, status: 'open', notes: '', completedAt: null, createdAt: '2026-10-01' }) as TaskRow;

const big3 = (n: number, done: number) => Array.from({ length: n }, (_, i) => ({ taskId: `t${i}`, locked: true, accepted: true, done: i < done }));

/** Everything worldly done: the three anchors and all of the Big 3. No faith beyond the walk. */
const worldly = (date: string, over: Partial<DayRecord> = {}): DayRecord => ({
  ...emptyDay(date),
  checkinDone: true,
  water: { done: true },
  coldShower: { done: true },
  walk: { done: true },
  big3: big3(3, 3),
  ...over,
});

function snap(days: DayRecord[]): Snapshot {
  return { ...seedSnapshot(), settings: { ...seedSnapshot().settings, statsFrom: '2026-10-12' }, days: Object.fromEntries(days.map((d) => [d.date, d])), blocks: [], tasks: ['t0', 't1', 't2'].map(task) };
}

const night = (date: string) => ({ date, min: 22 * 60 });

describe('the fire', () => {
  test('foundation 20, the Big 3 60, faith 20: each step is a stage, and everything without faith tops out at 80', () => {
    const f = dayFire(snap([worldly(D)]), D, night(D));
    expect([f.foundation.pts, f.work.pts, f.faith.pts, f.pct]).toEqual([20, 60, 0, 80]);
    expect(f.level).toBe('bright');
    const half = dayFire(snap([worldly(D, { big3: big3(2, 1), water: { done: false } })]), D, night(D));
    expect(half.pct).toBe(43);
    expect(half.level).toBe('flame');
    // The stages follow the steps: foundation, then each Big 3 item.
    const steps = [0, 1, 2, 3].map((n) => dayFire(snap([worldly(D, { big3: big3(3, n) })]), D, night(D)).level);
    expect(steps).toEqual(['little', 'flame', 'blaze', 'bright']);
  });

  test('faith steps beyond the walk give 10 each; the night tap fills it; all of it is a blue fire', () => {
    const one = dayFire(snap([worldly(D, { steps: [{ pillar: 'faith', text: 'Prayed for Josh' }] })]), D, night(D));
    expect([one.faith.pts, one.pct]).toEqual([10, 90]);
    const two = dayFire(snap([worldly(D, { steps: [{ pillar: 'faith', text: 'Prayed' }], showedUp: ['faith'] })]), D, night(D));
    expect([two.pct, two.level]).toEqual([100, 'blue']);
    const tap = dayFire(snap([worldly(D, { inner: { mind: 3, heart: 3, spirit: 4, closer: true } })]), D, night(D));
    expect([tap.faith.pts, tap.level]).toEqual([20, 'blue']);
    expect(tap.pieces.map((p) => p.label)).toContain('Drew closer to God today');
  });

  test('a Lost Day: the focus, the foundation and a surrender make a purple fire', () => {
    const lost = (focus: Partial<NonNullable<DayRecord['lostFocus']>>) =>
      worldly(D, { big3: [], lostDay: true, lostDayReason: 'Rough day', lostFocus: { text: 'Be intentional at Epic large group', done: false, big3: big3(3, 0), ...focus } });
    const start = fireFor(snap([lost({})]), night(D));
    expect([start.pct, start.line]).toEqual([20, 'One thing before the day ends: Be intentional at Epic large group. Give the rest to Him.']);
    expect(fireFor(snap([lost({ done: true })]), night(D)).line).toBe('Before bed, tell Him what you are surrendering.');
    const all = fireFor(snap([lost({ done: true, surrender: 'The worry about school' })]), night(D));
    expect([all.pct, all.level]).toEqual([100, 'purple']);
    expect(all.line).toMatch(/^Purple fire\. You are loved by God/);
    const noBase = fireFor(snap([lost({ done: true, surrender: 'It' }), ...[]].map((d) => ({ ...d, water: { done: false } }))), night(D));
    expect(noBase.level).not.toBe('purple');
    expect(noBase.line).toBe('Lay the foundation too, and the fire turns purple.');
  });

  test('the ember never goes out, and the lines point to what is next', () => {
    const cold = fireFor(snap([]), { date: D, min: 600 });
    expect([cold.pct, cold.value, cold.level]).toEqual([0, EMBER, 'ember']);
    expect(cold.line).toBe('An ember, never out. Lay the foundation and it wakes into a little fire.');
    expect(fireFor(snap([worldly(D, { big3: big3(3, 1) })]), night(D)).line).toMatch(/^Foundation laid\. Now the Big 3/);
    expect(fireFor(snap([worldly(D)]), night(D)).line).toMatch(/The last 20 is His/);
    expect(levelFor(19, false)).toBe('ember');
    expect(levelFor(20, false)).toBe('little');
    expect(levelFor(25, false)).toBe('flame');
    expect(levelFor(45, false)).toBe('blaze');
    expect(levelFor(65, false)).toBe('bright');
    expect(levelFor(99, false)).toBe('bright');
  });

  test('before the water anchor, the cold shower and the walk carry the foundation', () => {
    const F = '2026-10-16';
    const f = dayFire(snap([worldly(F, { water: { done: false } })]), F, night(F));
    expect(f.foundation.pts).toBe(20);
  });

  test('the week and the log keep every day', () => {
    const days = [0, 1, 2, 3, 4, 5].map((i) => worldly(addDays('2026-10-12', i)));
    const f = fireFor(snap(days), night(D));
    expect(f.week.map((d) => d?.pct ?? null)).toEqual([80, 80, 80, 80, 80, 80, null]);
    expect(f.weekAvg).toBe(80);
    const log = fireLog(snap(days), night('2026-10-20'));
    expect(log.map((w) => w.weekStart)).toEqual(['2026-10-19', '2026-10-12']);
    expect(log[1]!.avg).toBe(69);
    expect([log[1]!.bright, log[1]!.lived]).toEqual([6, 7]);
  });
});
