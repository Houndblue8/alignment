import { describe, expect, test } from 'vitest';
import { diffBlocks } from '../diff';
import { expandEvents, toInstance } from '../expand';
import { onCampus, placeName, travel, workPlace } from '../places';
import { scoreDay, scoreWeek, streak } from '../scoring';
import { addDays, ceil5, diffDays, floor5, fmtDate, fmtDuration, fmtTime, weekStart, weekday } from '../time';
import type { Block, EventDef } from '../types';
import { EVENTS, MON, PLACES, SETTINGS, SUN, TUE, WED, at } from './fixtures';

describe('time', () => {
  test('weekday, addDays, diffDays across months and years', () => {
    expect(weekday(MON)).toBe(1);
    expect(weekday(SUN)).toBe(0);
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09'); // DST start in Los Angeles
    expect(addDays('2026-11-01', 1)).toBe('2026-11-02'); // DST end
    expect(diffDays('2026-10-12', '2026-10-28')).toBe(16);
    expect(diffDays('2026-10-28', '2026-10-12')).toBe(-16);
  });

  test('weekStart is the Monday', () => {
    expect(weekStart(MON)).toBe(MON);
    expect(weekStart(WED)).toBe(MON);
    expect(weekStart(SUN)).toBe(MON);
  });

  test('rounding and formatting', () => {
    expect(ceil5(612)).toBe(615);
    expect(floor5(612)).toBe(610);
    expect(fmtTime(0)).toBe('12:00 AM');
    expect(fmtTime(at(7, 5))).toBe('7:05 AM');
    expect(fmtTime(at(12))).toBe('12:00 PM');
    expect(fmtTime(at(23, 15))).toBe('11:15 PM');
    expect(fmtTime(1470)).toBe('12:30 AM');
    expect(fmtDuration(480)).toBe('8 hours');
    expect(fmtDuration(460)).toBe('7 hours 40 minutes');
    expect(fmtDuration(60)).toBe('1 hour');
    expect(fmtDuration(30)).toBe('30 minutes');
    expect(fmtDate('2026-10-28')).toBe('Wednesday, Oct 28');
  });
});

describe('places', () => {
  test('drive times', () => {
    expect(travel(PLACES, 'home', 'home')).toBe(0);
    expect(travel(PLACES, 'home', 'library')).toBe(18);
    expect(travel(PLACES, 'campus', 'library')).toBe(0);
    expect(travel(PLACES, 'scouts', 'library')).toBe(8);
    expect(travel(PLACES, 'campus', 'grover')).toBe(30);
    expect(travel(PLACES, 'home', 'grover')).toBe(20);
    expect(travel(PLACES, 'home', 'nowhere')).toBe(15);
  });

  test('work place: library on campus days, by work type otherwise', () => {
    expect(workPlace(PLACES, 'easy', true)).toBe('library');
    expect(workPlace(PLACES, 'deep', false)).toBe('scouts');
    expect(workPlace(PLACES, 'easy', false)).toBe('public_market');
    expect(workPlace(PLACES, 'errand', false)).toBe('starbucks');
    expect(workPlace([], 'deep', false)).toBe('library');
  });

  test('names and campus check', () => {
    expect(placeName(PLACES, 'scouts')).toBe("Scout's Coffee");
    expect(placeName(PLACES, 'x')).toBe('x');
    expect(onCampus(PLACES, 'library')).toBe(true);
    expect(onCampus(PLACES, 'home')).toBe(false);
    expect(onCampus(PLACES, 'x')).toBe(false);
  });
});

describe('expandEvents', () => {
  const ids = (date: string, block: 'A' | 'B' = 'A') => expandEvents(EVENTS, date, { ...SETTINGS, practiceBlock: block }).map((e) => e.id);

  test('weekly events by weekday, practice block A or B', () => {
    expect(ids(TUE)).toEqual(['bus-tue', 'club-a-tue', 'dwts-tue']);
    expect(ids(TUE, 'B')).toEqual(['bus-tue', 'club-b-tue', 'dwts-tue']);
    expect(ids(WED)).toEqual(['d1-wed', 'acct2-wed', 'tax-wed', 'itp-wed']);
  });

  test('exam days replace classes (skipDates) and one-time events span their dates', () => {
    expect(ids('2026-10-28')).toEqual(['d1-wed', 'acct-exam2-2026-10-28', 'tax-wed', 'itp-wed']);
    expect(ids('2026-11-04')).toEqual(['d1-wed', 'acct2-wed', 'tax-midterm2-2026-11-04', 'itp-wed']);
    expect(ids('2026-10-24')).toContain('retreat-2026-10-23');
    expect(ids('2026-10-25')).toContain('dayoff-2026-10-25');
    expect(ids('2026-10-26')).not.toContain('dayoff-2026-10-25');
  });

  test('active dates', () => {
    const def: EventDef = { ...EVENTS[0]!, activeFrom: '2026-10-19', activeTo: '2026-10-26' };
    expect(expandEvents([def], MON, SETTINGS)).toHaveLength(0);
    expect(expandEvents([def], '2026-10-19', SETTINGS)).toHaveLength(1);
    expect(expandEvents([def], '2026-11-02', SETTINGS)).toHaveLength(0);
    const broken: EventDef = { ...EVENTS[0]!, recurringWeekly: false, date: undefined };
    expect(expandEvents([broken], MON, SETTINGS)).toHaveLength(0);
  });

  test('instances carry rank and flags', () => {
    expect(toInstance(EVENTS.find((e) => e.id === 'retreat-2026-10-23')!)).toMatchObject({ rank: 1, allDay: true, noWork: true, away: true });
    expect(toInstance(EVENTS.find((e) => e.id === 'dwts-tue')!)).toMatchObject({ rank: 10, allDay: false, noWork: false, away: false });
  });
});

const blk = (id: string, start: number, end: number, kind: Block['kind'] = 'work'): Block => ({
  id,
  date: MON,
  start,
  end,
  kind,
  title: id,
  placeId: 'home',
  taskId: null,
  eventId: null,
  status: 'planned',
  pinned: false,
  source: 'planner',
  howto: null,
});

describe('diffBlocks', () => {
  test('added, moved, resized, removed; travel ignored', () => {
    const before = [blk('a', 600, 660), blk('b', 700, 760), blk('c', 800, 830), blk('t', 590, 600, 'travel')];
    const after = [blk('a', 600, 660), blk('b', 710, 770), blk('c', 800, 845), blk('d', 900, 930), blk('t2', 680, 700, 'travel')];
    const d = diffBlocks(before, after);
    expect(d.moved.map((x) => x.id)).toEqual(['b']);
    expect(d.resized.map((x) => x.id)).toEqual(['c']);
    expect(d.added.map((x) => x.id)).toEqual(['d']);
    expect(d.removed).toEqual([]);
    expect(d.count).toBe(3);
    const gone = diffBlocks(after, before);
    expect(gone.removed.map((x) => x.id)).toEqual(['d']);
  });

  test('orders changes by time', () => {
    const d = diffBlocks([], [blk('late', 900, 930), blk('early', 600, 630), blk('mid', 600, 630)]);
    expect(d.added.map((x) => x.id)).toEqual(['early', 'mid', 'late']);
  });
});

describe('scoring', () => {
  const day = { coldShowerDone: true, walkDone: true, big3Done: [true, true, true], lostDay: false, lostDayReason: null, salvageCompleted: 0 };

  test('Win, Half, Loss', () => {
    expect(scoreDay(day)).toBe('win');
    expect(scoreDay({ ...day, big3Done: [true] })).toBe('win'); // Eli kept only one
    expect(scoreDay({ ...day, walkDone: false })).toBe('loss');
    expect(scoreDay({ ...day, walkDone: false, lostDay: true, lostDayReason: 'Sick', salvageCompleted: 2 })).toBe('half');
    expect(scoreDay({ ...day, walkDone: false, lostDay: true, lostDayReason: ' ', salvageCompleted: 3 })).toBe('loss');
    expect(scoreDay({ ...day, walkDone: false, lostDay: true, lostDayReason: 'Sick', salvageCompleted: 1 })).toBe('loss');
  });

  test('weekly series: at most 2 half wins count, 4 wins the series', () => {
    expect(scoreWeek(['win', 'win', 'win', 'win', 'win', 'win', 'win'])).toEqual({ points: 7, won: true, label: 'Sweep' });
    expect(scoreWeek(['win', 'win', 'win', 'win', 'win', 'win', 'half'])).toEqual({ points: 6.5, won: true, label: 'Dominant' });
    expect(scoreWeek(['win', 'win', 'win', 'win', 'win', 'loss', null])).toEqual({ points: 5, won: true, label: 'Solid' });
    expect(scoreWeek(['win', 'win', 'win', 'half', 'half', 'half', 'half'])).toEqual({ points: 4, won: true, label: 'Won' });
    expect(scoreWeek(['win', 'win', 'win', 'loss', 'half', 'loss', null])).toEqual({ points: 3.5, won: false, label: 'Lost' });
  });

  test('streaks count back from today, or from yesterday if today is not done yet', () => {
    const done = new Set(['2026-10-09', '2026-10-10', '2026-10-11']);
    expect(streak('2026-10-11', (d) => done.has(d))).toBe(3);
    expect(streak('2026-10-12', (d) => done.has(d))).toBe(3);
    expect(streak('2026-10-14', (d) => done.has(d))).toBe(0);
  });
});
