import { describe, expect, test } from 'vitest';
import { emptyDay, type PhotoRow } from '../data/model';
import { seedSnapshot } from '../data/seedData';
import { missedRitual, photoForDay } from './Memory';

const photo = (date: string): PhotoRow => ({ date, storagePath: `u/${date}.jpg`, caption: date, milestone: false });

describe('Memory', () => {
  test('then and now: day N counts from the first photo, allowing up to 3 days late', () => {
    const photos = [photo('2026-10-10'), photo('2026-11-10'), photo('2027-01-08')];
    expect(photoForDay(photos, '2026-10-10', 1)?.date).toBe('2026-10-10');
    // Day 30 is Nov 8; the Nov 10 photo is 2 days later.
    expect(photoForDay(photos, '2026-10-10', 30)?.date).toBe('2026-11-10');
    // Day 90 is Jan 7; the Jan 8 photo counts.
    expect(photoForDay(photos, '2026-10-10', 90)?.date).toBe('2027-01-08');
    expect(photoForDay([photo('2026-10-10')], '2026-10-10', 30)).toBeNull();
  });

  test('a missed photo marks only past days that were lived in the app', () => {
    const s = {
      ...seedSnapshot(),
      days: {
        '2026-10-10': { ...emptyDay('2026-10-10'), checkinDone: true },
        '2026-10-11': { ...emptyDay('2026-10-11'), checkinDone: true },
        '2026-10-12': { ...emptyDay('2026-10-12'), checkinDone: true },
      },
      photos: [photo('2026-10-11')],
    };
    expect(missedRitual(s, '2026-10-10', '2026-10-12')).toBe(true);
    expect(missedRitual(s, '2026-10-11', '2026-10-12')).toBe(false);
    expect(missedRitual(s, '2026-10-12', '2026-10-12')).toBe(false); // today is still open
    expect(missedRitual(s, '2026-10-09', '2026-10-12')).toBe(false); // no record that day
  });
});
