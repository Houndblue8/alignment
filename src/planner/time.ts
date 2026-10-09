// Date and minute helpers. Dates are plain YYYY-MM-DD strings; the only Date use is UTC
// arithmetic on those strings, so results never depend on the machine's time zone.

const DAY_MS = 86_400_000;

function toUtc(date: string): number {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
}

function fromUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** 0 = Sunday ... 6 = Saturday. */
export function weekday(date: string): number {
  return new Date(toUtc(date)).getUTCDay();
}

export function addDays(date: string, n: number): string {
  return fromUtc(toUtc(date) + n * DAY_MS);
}

/** Whole days from a to b (b - a). */
export function diffDays(a: string, b: string): number {
  return Math.round((toUtc(b) - toUtc(a)) / DAY_MS);
}

/** Monday of the week containing date (weeks run Monday to Sunday). */
export function weekStart(date: string): string {
  const wd = weekday(date);
  return addDays(date, wd === 0 ? -6 : 1 - wd);
}

export const ceil5 = (m: number): number => Math.ceil(m / 5) * 5;
export const floor5 = (m: number): number => Math.floor(m / 5) * 5;

/** 450 -> "7:30 AM". Minutes past midnight wrap to the next day's clock time. */
export function fmtTime(min: number): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  const h24 = Math.floor(m / 60);
  const mm = m % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(mm).padStart(2, '0')} ${h24 < 12 ? 'AM' : 'PM'}`;
}

/** 460 -> "7 hours 40 minutes". */
export function fmtDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const hs = h === 1 ? '1 hour' : `${h} hours`;
  if (m === 0) return hs;
  if (h === 0) return `${m} minutes`;
  return `${hs} ${m} minutes`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** "2026-10-14" -> "Wednesday, Oct 14". */
export function fmtDate(date: string): string {
  const [, m, d] = date.split('-').map(Number) as [number, number, number];
  return `${DAYS[weekday(date)]}, ${MONTHS[m - 1]} ${d}`;
}
