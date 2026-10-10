// Reminder rules shared by the send-due function and the in-app fallback (Appendix E 4).
import { describe, expect, test } from 'vitest';
import { clock, dueNow, remindersFor, type ReminderInput } from '../supabase/functions/_shared/reminders.ts';

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

  test('text has no dashes or emoji and clock formats times', () => {
    expect(clock(1395)).toBe('11:15 PM');
    expect(clock(0)).toBe('12:00 AM');
    for (const x of remindersFor({ ...base, prefs: { ...base.prefs, blocks: true } })) {
      expect(/[–—]|\p{Extended_Pictographic}/u.test(x.title + x.body)).toBe(false);
    }
  });
});
