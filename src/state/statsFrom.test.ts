// Eli's first real week starts Monday Oct 12; earlier days stay saved but do not count (Oct 12).
import { describe, expect, test } from 'vitest';
import { emptyDay, type DayRecord, type Snapshot } from '../data/model';
import { seedSnapshot } from '../data/seedData';
import { addDays } from '../planner';
import { fireFor } from './fire';
import { anchorStreaks, seasonRecord } from './planning';
import { reportToOffer } from './report';
import { coachFacts } from './store';

const day = (date: string, over: Partial<DayRecord> = {}): DayRecord => ({ ...emptyDay(date), checkinDone: true, coldShower: { done: true }, walk: { done: true }, result: 'win', ...over });

function snap(statsFrom: string | null): Snapshot {
  const s = seedSnapshot();
  const days: Record<string, DayRecord> = {};
  for (let i = 0; i < 10; i++) days[addDays('2026-10-02', i)] = day(addDays('2026-10-02', i));
  days['2026-10-12'] = day('2026-10-12', { result: null, coldShower: { done: true }, walk: { done: false } });
  return { ...s, settings: { ...s.settings, statsFrom }, days, blocks: [], tasks: [] };
}

describe('stats start', () => {
  test('season record, streaks and the fire ignore days before the start', () => {
    const before = snap(null);
    const after = snap('2026-10-12');
    expect(seasonRecord(before, '2026-10-12').won + seasonRecord(before, '2026-10-12').lost).toBeGreaterThan(0);
    expect(seasonRecord(after, '2026-10-12')).toEqual({ won: 0, lost: 0 });
    expect(anchorStreaks(before, '2026-10-12').coldShower).toBe(11);
    expect(anchorStreaks(after, '2026-10-12').coldShower).toBe(1);
    expect(fireFor(before, { date: '2026-10-12', min: 600 }).trail.length).toBeGreaterThan(fireFor(after, { date: '2026-10-12', min: 600 }).trail.length);
  });

  test('no scouting report for a week before the start; the coach does not bring up yesterday', () => {
    const s = snap('2026-10-12');
    expect(reportToOffer(s, { date: '2026-10-12', min: 600 })).toBeNull();
    expect(coachFacts(s, '2026-10-12').facts.yesterday).toBe('none (today is the first day that counts)');
    const later = { ...s, days: { ...s.days, '2026-10-12': day('2026-10-12', { result: 'loss' }) } };
    expect(coachFacts(later, '2026-10-13').facts.yesterday).toBe('loss');
  });

  test('the coach line key changes when its facts do (a late close-out)', () => {
    const s = snap(null);
    const a = coachFacts(s, '2026-10-11').key;
    s.days['2026-10-10'] = { ...s.days['2026-10-10']!, result: 'loss' };
    expect(coachFacts(s, '2026-10-11').key).not.toBe(a);
  });
});
