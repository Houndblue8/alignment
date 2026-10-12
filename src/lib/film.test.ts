import { describe, expect, test } from 'vitest';
import { dateStamp, disposable } from './film';
import { developed, developsOn, isDeveloped, rollSize, shotNumber } from '../state/roll';

const gray = (w: number, h: number, v = 128) => {
  const px = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < px.length; i += 4) {
    px[i] = px[i + 1] = px[i + 2] = v;
    px[i + 3] = 255;
  }
  return px;
};

describe('the disposable look', () => {
  test('warm: red above blue on a neutral gray; the same seed gives the same grain', () => {
    const a = gray(20, 20);
    disposable(a, 20, 20, 7);
    const c = (10 * 20 + 10) * 4;
    expect(a[c]!).toBeGreaterThan(a[c + 2]! + 15);
    const b = gray(20, 20);
    disposable(b, 20, 20, 7);
    expect(Array.from(b)).toEqual(Array.from(a));
  });

  test('vignette: the corners come out darker than the middle; blacks are lifted', () => {
    const px = gray(40, 40, 200);
    disposable(px, 40, 40, 1);
    const at = (x: number, y: number) => px[(y * 40 + x) * 4 + 1]!;
    expect(at(0, 0)).toBeLessThan(at(20, 20) - 10);
    const black = gray(4, 4, 0);
    disposable(black, 4, 4, 1);
    expect(black[(1 * 4 + 1) * 4]!).toBeGreaterThan(5);
  });

  test("the date stamp reads like a 90s disposable: '26 10 12", () => {
    expect(dateStamp('2026-10-12')).toBe("'26 10 12");
  });
});

describe('the roll', () => {
  const photos = ['2026-09-30', '2026-10-01', '2026-10-05', '2026-10-12'].map((date) => ({ date, storagePath: date, caption: '', milestone: false }));

  test('a month develops on the first of the next month', () => {
    expect(isDeveloped('2026-10-12', '2026-10-31')).toBe(false);
    expect(isDeveloped('2026-10-12', '2026-11-01')).toBe(true);
    expect(developsOn('2026-12')).toBe('2027-01-01');
    expect(developed(photos, '2026-10-20').map((p) => p.date)).toEqual(['2026-09-30']);
  });

  test('shot numbers count within the month; the roll has a shot for every day', () => {
    expect(shotNumber(photos, '2026-10-12')).toBe(3);
    expect(shotNumber(photos, '2026-10-01')).toBe(1);
    expect([rollSize('2026-10'), rollSize('2026-02')]).toEqual([31, 28]);
  });
});
