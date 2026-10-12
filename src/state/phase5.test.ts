// Monthly recap (Appendix E 2) and the urge button (Appendix E 5).
import { describe, expect, test } from 'vitest';
import { emptyDay, type DayRecord, type Snapshot, type TaskRow } from '../data/model';
import { seedSnapshot } from '../data/seedData';
import { monthDates, monthFacts, plainLetter, prevMonth } from './recap';
import { avoidingPick, boredKinds, firstStep, lightestPick } from './urge';

const task = (id: string, over: Partial<TaskRow> = {}): TaskRow =>
  ({ id, title: id, journey: 'school', importance: 3, estimatedMinutes: 60, deadline: null, workType: 'deep', deferralCount: 0, status: 'open', notes: '', steps: [], completedAt: null, createdAt: '2026-10-01', ...over }) as TaskRow;
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

describe('the urge button', () => {
  const s = snap({
    tasks: [task('memo', { deferralCount: 3, steps: [{ text: 'Open the memo template', guess: false }] }), task('dms', { deferralCount: 1, estimatedMinutes: 20, workType: 'easy' }), task('done', { status: 'done', estimatedMinutes: 5 })],
  });

  test('avoiding: the task pushed off most, with its first step written out', () => {
    const t = avoidingPick(s, '2026-10-12')!;
    expect(t.id).toBe('memo');
    expect(firstStep(t)).toBe('Open the memo template');
  });

  test('tired: the lightest open task, with a starter step for its kind of work', () => {
    const t = lightestPick(s, '2026-10-12')!;
    expect(t.id).toBe('dms');
    expect(firstStep(t)).toBe('Open it and do the smallest piece you can see.');
  });

  test('bored: a photo, the season, or a quote, whichever exist', () => {
    expect(boredKinds(s)).toEqual(['season', 'quote']);
    expect(boredKinds({ ...s, photos: [{ date: '2026-10-12', storagePath: 'x', caption: '', milestone: false }] })[0]).toBe('photo');
  });
});
