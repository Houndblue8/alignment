// Reminder rules shared by the send-due function and the in-app fallback (Appendix E 4).
import { describe, expect, test } from 'vitest';
import { clock, dueNow, openWindows, remindersFor, setBlocks, type ReminderBlock, type ReminderInput } from '../supabase/functions/_shared/reminders.ts';

const base: ReminderInput = {
  date: '2026-10-12',
  prefs: { morning: true, evening: true, bedtime: true, blocks: false },
  expectedWakeMin: 390,
  checkinDone: false,
  anchorsDone: false,
  bedMin: 1395,
  blocks: [
    { id: 'w', start: 1365, end: 1395, kind: 'winddown', title: 'Wind down', status: 'planned' },
    { id: 'c', start: 720, end: 800, kind: 'class', title: 'Intermediate Accounting 2', status: 'planned' },
    { id: 't', start: 1270, end: 1288, kind: 'travel', title: 'Drive to Campus', status: 'planned' },
    { id: 'd', start: 600, end: 660, kind: 'work', title: 'Tax memo', status: 'done' },
  ],
};

describe('reminders', () => {
  test('morning at the wake time, close-out at wind-down, bedtime at the recommended bedtime', () => {
    const r = remindersFor(base);
    expect(r.map((x) => [x.kind, x.dueMin])).toEqual([
      ['morning', 390],
      ['evening', 1365],
      ['bedtime', 1395],
    ]);
    expect(r[2]!.body).toBe('Bed by 11:15 PM protects tomorrow. Phone down.');
  });

  test('no morning reminder once checked in with both anchors done', () => {
    expect(remindersFor({ ...base, checkinDone: true, anchorsDone: true }).some((x) => x.kind === 'morning')).toBe(false);
    expect(remindersFor({ ...base, checkinDone: true }).some((x) => x.kind === 'morning')).toBe(true);
  });

  test('block reminders are optional, 5 minutes before, and skip travel, done and wind-down', () => {
    const r = remindersFor({ ...base, prefs: { ...base.prefs, blocks: true } }).filter((x) => x.kind === 'block');
    expect(r.map((x) => [x.title, x.dueMin])).toEqual([['Intermediate Accounting 2', 715]]);
    expect(r[0]!.url).toBe('/today#c');
  });

  test('preferences turn reminders off; no bedtime after midnight', () => {
    expect(remindersFor({ ...base, prefs: { morning: false, evening: false, bedtime: false, blocks: false } })).toEqual([]);
    expect(remindersFor({ ...base, bedMin: 1470, blocks: [] }).map((x) => x.kind)).toEqual(['morning', 'evening']);
  });

  test('due now means within the last few minutes', () => {
    const r = remindersFor(base);
    expect(dueNow(r, 390).map((x) => x.kind)).toEqual(['morning']);
    expect(dueNow(r, 392).map((x) => x.kind)).toEqual(['morning']);
    expect(dueNow(r, 393)).toEqual([]);
    expect(dueNow(r, 389)).toEqual([]);
  });

  test('photo reminder at the chosen time, only while today has no photo', () => {
    const photo = { ...base, prefs: { ...base.prefs, photo: true }, photoMin: 720, photoTaken: false };
    expect(remindersFor(photo).find((x) => x.kind === 'photo')).toMatchObject({ dueMin: 720, title: "Today's photo", url: '/?photo=1' });
    expect(remindersFor({ ...photo, photoTaken: true }).some((x) => x.kind === 'photo')).toBe(false);
    expect(remindersFor({ ...photo, prefs: { ...photo.prefs, photo: false } }).some((x) => x.kind === 'photo')).toBe(false);
    expect(remindersFor(photo).find((x) => x.kind === 'evening')!.body).toBe("Check off what got done. Today's photo is still open.");
  });

  test('Sunday close-out closes the week and points to the scouting report', () => {
    const ev = remindersFor({ ...base, date: '2026-10-18' }).find((x) => x.kind === 'evening')!;
    expect(ev.title).toBe('Close the week');
    expect(ev.body).toBe('Check off what got done. Then your scouting report is ready on Home.');
  });

  test('text has no dashes or emoji and clock formats times', () => {
    expect(clock(1395)).toBe('11:15 PM');
    expect(clock(0)).toBe('12:00 AM');
    for (const x of remindersFor({ ...base, prefs: { ...base.prefs, blocks: true } })) {
      expect(/[–—]|\p{Extended_Pictographic}/u.test(x.title + x.body)).toBe(false);
    }
  });
});

describe('open time', () => {
  const b = (id: string, kind: string, start: number, end: number, over: Partial<ReminderBlock> = {}): ReminderBlock => ({ id, kind, start, end, title: id, status: 'planned', placeId: 'home', ...over });
  const day: ReminderBlock[] = [
    b('shower', 'anchor_cold_shower', 455, 465),
    b('walk', 'anchor_walk', 465, 480),
    b('drive1', 'travel', 482, 500, { placeId: 'campus' }),
    b('lib', 'library_work', 500, 570, { placeId: 'campus', taskId: 'memo', title: 'Library: Tax memo' }),
    b('class', 'class', 720, 800, { placeId: 'campus' }),
    b('work', 'work', 810, 870, { taskId: 'memo', title: 'Tax memo' }),
    b('floor', 'shs_floor', 880, 910, { title: 'Side Hustle Summit floor' }),
    b('lunch', 'meal', 700, 715, { title: 'Lunch' }),
    b('epic', 'event', 1110, 1200),
    b('hang', 'misc', 1210, 1260, { source: 'manual', title: 'Hangout with Josh' }),
    b('wind', 'winddown', 1320, 1350),
  ];

  test('set times stay; planner work, the floor, meals and misc float; a drive stays when it leads to something set there', () => {
    expect(setBlocks(day).map((x) => x.id)).toEqual(['shower', 'walk', 'drive1', 'class', 'epic', 'hang', 'wind']);
  });

  test('the gaps are open windows, with the planner picks as the best use', () => {
    const w = openWindows(day, 455, 1320);
    expect(w.map((x) => [x.start, x.end])).toEqual([
      [500, 720],
      [800, 1110],
      [1260, 1320],
    ]);
    expect(w[0]!.uses.map((u) => u.title)).toEqual(['Library: Tax memo', 'Lunch (whenever it fits)']);
    expect(w[1]!.uses.map((u) => u.title)).toEqual(['Tax memo', 'Side Hustle Summit floor']);
    expect(w[2]!.uses).toEqual([]);
  });

  test('a ping when a window of 30 minutes or more starts, naming the Big 3 first; only when it has a use', () => {
    const r = remindersFor({ ...base, blocks: day, prefs: { ...base.prefs, open: true }, big3: ['memo'] }).filter((x) => x.kind === 'open');
    expect(r.map((x) => [x.dueMin, x.title, x.body])).toEqual([
      [500, 'Open time: 3h 40m', 'Until 12:00 PM. Best use: Library: Tax memo (Big 3), then Lunch (whenever it fits).'],
      [800, 'Open time: 5h 10m', 'Until 6:30 PM. Best use: Tax memo (Big 3), then Side Hustle Summit floor.'],
    ]);
    expect(remindersFor({ ...base, blocks: day }).some((x) => x.kind === 'open')).toBe(false);
  });
});
