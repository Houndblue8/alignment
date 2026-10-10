import { describe, expect, test } from 'vitest';
import { emptyDay, type DayRecord, type Snapshot, type TaskRow } from '../data/model';
import { seedSnapshot } from '../data/seedData';
import type { Block } from '../planner';
import { cleanReport, draftReport, reportToOffer, weekClosed, weekFacts } from './report';

const MON = '2026-10-12';
const SUN = '2026-10-18';
const dates = ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18'];

function block(date: string, kind: Block['kind'], status: Block['status'], start = 600): Block {
  return { id: `${date}:${kind}:${start}`, date, start, end: start + 60, kind, title: kind, placeId: null, taskId: null, eventId: null, status, pinned: false, source: 'planner', howto: null };
}

function task(id: string, status: TaskRow['status'], deferralCount = 0): TaskRow {
  return { id, title: `Task ${id}`, journey: 'school', importance: 3, estimatedMinutes: 60, deadline: null, workType: 'deep', deferralCount, status, notes: '', completedAt: null } as TaskRow;
}

function week(over: (d: DayRecord, i: number) => Partial<DayRecord>): Snapshot {
  const s = seedSnapshot();
  const days: Record<string, DayRecord> = {};
  dates.forEach((d, i) => (days[d] = { ...emptyDay(d), checkinDone: true, wakeMin: 450, coldShower: { done: true }, walk: { done: true }, result: 'win', ...over(emptyDay(d), i) }));
  return { ...s, settings: { ...s.settings, wakeTargetMin: 450 }, days, tasks: [task('a', 'done'), task('b', 'open'), task('c', 'open', 2)], blocks: [], photos: [] };
}

describe('scouting report', () => {
  test('the week closes Sunday at wind-down; Home offers it Sunday night and all Monday', () => {
    const s = week(() => ({}));
    s.blocks = [block(SUN, 'winddown', 'planned', 1290)];
    expect(weekClosed(s, MON, { date: SUN, min: 1289 })).toBe(false);
    expect(weekClosed(s, MON, { date: SUN, min: 1290 })).toBe(true);
    expect(reportToOffer(s, { date: SUN, min: 1000 })).toBeNull();
    expect(reportToOffer(s, { date: SUN, min: 1300 })).toBe(MON);
    expect(reportToOffer(s, { date: '2026-10-19', min: 600 })).toBe(MON);
    expect(reportToOffer(s, { date: '2026-10-20', min: 600 })).toBeNull();
    // No wind-down block: 9:00 PM. No days lived that week: nothing to offer.
    expect(weekClosed({ ...s, blocks: [] }, MON, { date: SUN, min: 1260 })).toBe(true);
    expect(reportToOffer({ ...s, days: {} }, { date: '2026-10-19', min: 600 })).toBeNull();
  });

  test('facts come straight from the week: series, anchors, Big 3, blocks, photos, late wakes', () => {
    const s = week((_, i) => ({
      result: i < 4 ? 'win' : i === 4 ? 'half' : 'loss',
      coldShower: { done: i !== 6 },
      walk: { done: i < 3 },
      big3: i === 0 ? [{ taskId: 'a', locked: true, accepted: true }, { taskId: 'b', locked: true, accepted: true }] : [],
      wakeMin: i === 2 || i === 3 ? 520 : 450,
    }));
    s.blocks = [block(MON, 'workout', 'done'), block('2026-10-13', 'workout', 'skipped'), block(MON, 'shs_floor', 'done'), block('2026-10-11', 'workout', 'done')];
    s.photos = [{ date: MON, storagePath: 'x', caption: 'x', milestone: false }];
    const f = weekFacts(s, MON);
    expect([f.wins, f.halves, f.losses, f.points, f.won, f.label]).toEqual([4, 1, 2, 4.5, true, 'Won']);
    expect(f.coldShower).toEqual({ done: 6, of: 7 });
    expect(f.walk).toEqual({ done: 3, of: 7 });
    expect(f.big3).toEqual({ done: 1, of: 2 });
    expect(f.workouts).toEqual({ done: 1, of: 2 });
    expect(f.shsFloor).toEqual({ done: 1, of: 1 });
    expect(f.photos).toEqual({ done: 1, of: 7 });
    expect(f.lateWakes).toBe(2);
    expect(f.bestDay).toBe(MON);
    expect(f.deferred).toEqual(['Task c']);
  });

  test('Sunday is scored live; days skipped after the start are losses; a first partial week counts its own days', () => {
    const s = week(() => ({}));
    s.days[SUN] = { ...s.days[SUN]!, result: null };
    expect(weekFacts(s, MON).wins).toBe(7);
    const partial: Snapshot = { ...s, days: { '2026-10-16': s.days['2026-10-16']!, [SUN]: s.days[SUN]! } };
    const f = weekFacts(partial, MON);
    expect([f.wins, f.losses]).toEqual([2, 1]);
    expect(f.coldShower).toEqual({ done: 2, of: 3 });
  });

  test('the draft names what held, the weakest area, and one matching adjustment', () => {
    const s = week((_, i) => ({ walk: { done: i < 3 } }));
    const r = draftReport(weekFacts(s, MON), 'I am a man of discipline. More text.');
    expect(r.held).toContain('the cold shower (7 of 7)');
    expect(r.slipped).toMatch(/^The walk with God: 3 of 7\./);
    expect(r.slipped).toContain('Pushed off twice or more: Task c.');
    expect(r.adjustment).toContain('Walk at fifteen minutes after waking');
    expect(r.vision).toBe('This week was practice for who you said you are: I am a man of discipline.');
  });

  test('late wakes take priority as the slip; a clean week asks for one higher bar', () => {
    const late = draftReport(weekFacts(week((_, i) => ({ wakeMin: i < 3 ? 540 : 450 })), MON), 'X.');
    expect(late.slipped).toMatch(/^3 late wakes/);
    expect(late.adjustment).toContain('recommended bedtime');
    const s = week(() => ({}));
    s.tasks = [];
    s.photos = dates.map((d) => ({ date: d, storagePath: d, caption: '', milestone: false }));
    const clean = draftReport(weekFacts(s, MON), 'X.');
    expect(clean.slipped).toBe('No real slip in the numbers. Watch for coasting.');
    expect(clean.held).toContain('7 points, series won (Sweep)');
  });

  test('the coach reply is kept only when it has all four lines; dashes become commas', () => {
    expect(cleanReport({ held: 'a', slipped: 'b' })).toBeNull();
    expect(cleanReport('nope')).toBeNull();
    const dash = String.fromCharCode(0x2014);
    expect(cleanReport({ held: `Walks held ${dash} 7 of 7.`, slipped: 'b', adjustment: 'c', vision: 'd' })?.held).toBe('Walks held, 7 of 7.');
  });

  test('draft text has no dashes or emoji', () => {
    const r = draftReport(weekFacts(week(() => ({ result: 'loss', coldShower: { done: false } })), MON), 'X.');
    for (const t of Object.values(r)) expect(/[–—]|\p{Extended_Pictographic}/u.test(t)).toBe(false);
  });
});
