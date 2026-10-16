// Monthly recap (Appendix E 2).
import { describe, expect, test } from 'vitest';
import { emptyDay, type DayRecord, type Snapshot } from '../data/model';
import { seedSnapshot } from '../data/seedData';
import { monthDates, monthFacts, plainLetter, prevMonth } from './recap';

const day = (date: string, over: Partial<DayRecord> = {}): DayRecord => ({ ...emptyDay(date), checkinDone: true, coldShower: { done: true }, walk: { done: true }, result: 'win', ...over });

function snap(over: Partial<Snapshot> = {}): Snapshot {
  const s = seedSnapshot();
  return { ...s, settings: { ...s.settings, statsFrom: '2026-10-12' }, blocks: [], tasks: [], photos: [], days: {}, ...over };
}

describe('monthly recap', () => {
  test('month helpers', () => {
    expect(monthDates('2026-02')).toHaveLength(28);
    expect(prevMonth('2026-01')).toBe('2025-12');
  });

  test('counts only days that count, and weeks that ended in the month', () => {
    const days: Record<string, DayRecord> = {};
    for (let d = 5; d <= 25; d++) {
      const date = `2026-10-${String(d).padStart(2, '0')}`;
      days[date] = day(date, { result: d === 14 ? 'loss' : 'win', walk: { done: d !== 20 }, big3: [{ taskId: 't', locked: true, accepted: true, done: d % 2 === 0 }] });
    }
    const s = snap({ days, photos: [{ date: '2026-10-08', storagePath: 'a', caption: 'x', milestone: false }, { date: '2026-10-13', storagePath: 'b', caption: 'y', milestone: false }] });
    const f = monthFacts(s, '2026-10', { date: '2026-10-26', min: 600 });
    // Oct 12 to 25: 14 days; Oct 5 to 11 are before the stats start.
    expect([f.days, f.wins, f.losses]).toEqual([14, 13, 1]);
    expect([f.coldShower, f.walk]).toEqual([14, 13]);
    // Weeks ending Oct 18 and Oct 25.
    expect(f.series).toEqual({ won: 2, lost: 0 });
    expect(f.photos.map((p) => p.date)).toEqual(['2026-10-13']);
    expect(f.big3).toEqual({ done: 7, of: 14 });
    expect(f.bestDay?.date).toBe('2026-10-12');
    expect(f.soFar).toBe(true);
    expect(plainLetter(f, 'Eli')).toMatch(/^Eli, October 2026 so far: 13 wins, 0 half wins and 1 losses over 14 days\./);
  });

  test('a month with nothing counted says so', () => {
    const f = monthFacts(snap(), '2026-09', { date: '2026-10-26', min: 600 });
    expect(f.days).toBe(0);
    expect(plainLetter(f, 'Eli')).toMatch(/nothing counted/);
  });
});

