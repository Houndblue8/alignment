import { describe, expect, test } from 'vitest';
import { emptyDay, type DayRecord, type Snapshot, type TaskRow } from '../data/model';
import { seedSnapshot } from '../data/seedData';
import type { Block } from '../planner';
import { buildingFor, buildingLine, countedOn, saveableTemple, seenOn, targetsFor, weekTemple } from './temple';

const MON = '2026-10-12';
const TUE = '2026-10-13';
const blk = (id: string, date: string, over: Partial<Block>): Block => ({
  id,
  date,
  start: 600,
  end: 660,
  kind: 'event',
  title: id,
  placeId: null,
  taskId: null,
  eventId: null,
  status: 'planned',
  pinned: false,
  source: 'planner',
  howto: null,
  ...over,
});
const task = (id: string, journey: TaskRow['journey']): TaskRow =>
  ({ id, title: id, journey, importance: 3, estimatedMinutes: 60, deadline: null, workType: 'deep', deferralCount: 0, status: 'open', notes: '', completedAt: null, createdAt: '2026-10-01' }) as TaskRow;
const day = (date: string, over: Partial<DayRecord> = {}): DayRecord => ({ ...emptyDay(date), checkinDone: true, ...over });

function snap(over: Partial<Snapshot>): Snapshot {
  return { ...seedSnapshot(), blocks: [], tasks: [], photos: [], ...over };
}

describe('the weekly temple', () => {
  test('what the app sees: set-time things count when they happen, effort counts when checked', () => {
    const s = snap({
      tasks: [task('memo', 'school'), task('dms', 'shs')],
      days: { [MON]: day(MON, { walk: { done: true }, big3: [{ taskId: 'memo', locked: true, accepted: true, done: true }] }) },
      blocks: [
        blk('w', MON, { kind: 'workout', start: 900, end: 960 }),
        blk('p', MON, { kind: 'practice', start: 585, end: 705 }),
        blk('f', MON, { kind: 'shs_floor', start: 1000, end: 1030 }),
        blk('epic', MON, { eventId: 'epic-small-mon', start: 1110, end: 1200 }),
      ],
    });
    expect(seenOn(s, MON, { date: MON, min: 800 })).toEqual({ faith: true, body: false, sport: true, school: true, shs: false, life: false });
    const night = seenOn(s, MON, { date: MON, min: 1300 });
    expect(night.body).toBe(true);
    // The floor is effort: it counts only when checked.
    expect(night.shs).toBe(false);
    s.blocks = s.blocks.map((b) => (b.id === 'f' ? { ...b, status: 'done' } : b));
    expect(seenOn(s, MON, { date: MON, min: 1300 }).shs).toBe(true);
  });

  test('the night tap adds what the app could not see', () => {
    const s = snap({ days: { [MON]: day(MON, { showedUp: ['school', 'life'] }) } });
    const c = countedOn(s, MON, { date: MON, min: 1300 });
    expect([c.school, c.life, c.shs]).toEqual([true, true, false]);
  });

  test('targets: the defaults, every practice on the calendar, and exam weeks', () => {
    const s = snap({ days: {} });
    const { targets, examWeek } = targetsFor(s, MON);
    expect(examWeek).toBe(false);
    expect(targets).toMatchObject({ faith: 7, body: 6, school: 5, shs: 6, life: 3 });
    expect(targets.sport).toBeGreaterThanOrEqual(4);
    // Tax Midterm II is Nov 4 (a Wednesday): that week adds a study day and eases Side Hustle by two.
    const exam = targetsFor(s, '2026-11-02');
    expect(exam.examWeek).toBe(true);
    expect([exam.targets.school, exam.targets.shs]).toEqual([6, 4]);
    // Edited in Settings.
    const custom = targetsFor({ ...s, settings: { ...s.settings, weeklyTargets: { faith: 7, body: 4, sport: 3, school: 4, shs: 4, life: 2 } } }, MON);
    expect(custom.targets).toMatchObject({ body: 4, sport: 3, school: 4, shs: 4, life: 2 });
  });

  test('the week adds up day by day; sports counts practices', () => {
    const s = snap({
      days: { [MON]: day(MON, { walk: { done: true } }), [TUE]: day(TUE, { walk: { done: true }, showedUp: ['body'] }) },
      blocks: [blk('p1', MON, { kind: 'practice', start: 585, end: 705 }), blk('p2', MON, { kind: 'practice', start: 1290, end: 1350 }), blk('p3', TUE, { kind: 'practice', start: 1200, end: 1290, status: 'skipped' })],
    });
    const t = weekTemple(s, MON, { date: TUE, min: 1300 });
    const p = Object.fromEntries(t.pillars.map((x) => [x.id, x]));
    expect([p.faith!.done, p.faith!.days.slice(0, 3)]).toEqual([2, [true, true, false]]);
    expect(p.body!.done).toBe(1);
    expect(p.sport!.done).toBe(2);
    expect(p.faith!.today).toBe(true);
    expect(t.complete).toBe(false);
    const saved = saveableTemple(s, MON, { date: TUE, min: 1300 });
    expect(saved.pillars.faith).toEqual([2, 7]);
    expect(JSON.stringify(saved).length).toBeLessThan(400);
  });

  test('the line under the fire speaks to today: foundation, then the Big 3 flames', () => {
    const s = snap({ tasks: [task('a', 'school'), task('b', 'shs')], days: { [MON]: day(MON) } });
    const now = { date: MON, min: 600 };
    expect(buildingLine(buildingFor(s, MON, now))).toBe('Lay the foundation first: the cold shower, then the walk.');
    s.days[MON] = day(MON, { coldShower: { done: true }, walk: { done: true }, big3: [{ taskId: 'a', locked: true, accepted: true }, { taskId: 'b', locked: true, accepted: true, done: true }] });
    const b = buildingFor(s, MON, now);
    expect(b.torches.items.map((i) => [i.pillar, i.done])).toEqual([
      ['school', false],
      ['shs', true],
    ]);
    expect(buildingLine(b)).toMatch(/^1 of 2 in the fire\. Temple this week: \d of 6 pillars at target\.$/);
  });
});
