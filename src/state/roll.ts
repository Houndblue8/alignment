// The roll (Eli, Oct 12): like a disposable camera, a month's photos stay hidden until the month ends, then
// the monthly recap develops them. Pure.
import type { PhotoRow } from '../data/model';
import { monthDates, monthName } from './recap';

/** A photo is developed once its month is over. */
export const isDeveloped = (photoDate: string, today: string): boolean => photoDate.slice(0, 7) < today.slice(0, 7);

/** Shots on a month's roll: one a day. */
export const rollSize = (month: string): number => monthDates(month).length;

/** Which shot of the month's roll this photo is (1 for the first photo that month). */
export function shotNumber(photos: PhotoRow[], date: string): number {
  return photos.filter((p) => p.date.startsWith(date.slice(0, 7)) && p.date <= date).length;
}

/** The day a month's roll develops: the first of the next month. */
export function developsOn(month: string): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
}

export const developsLabel = (month: string): string => {
  const d = developsOn(month);
  return `${monthName(d.slice(0, 7)).split(' ')[0]} 1`;
};

/** Photos that can be shown today. */
export const developed = (photos: PhotoRow[], today: string): PhotoRow[] => photos.filter((p) => isDeveloped(p.date, today));
