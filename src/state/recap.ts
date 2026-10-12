// Monthly recap (Appendix E 2). The facts are computed here; the coach only writes the short letter, and a plain
// letter from the facts stands in when it is unavailable. Pure.
import type { PhotoRow, Snapshot } from '../data/model';
import type { Now } from '../lib/clock';
import { addDays, scoreWeek, weekStart } from '../planner';
import { counts, dayOf, isItemDone } from './planning';
import { countedOn } from './temple';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const monthName = (month: string): string => `${MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;

export function monthDates(month: string): string[] {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const n = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: n }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
}

export const prevMonth = (month: string): string => {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
};

export interface MonthFacts {
  month: string;
  /** Days that counted (lived in the app, on or after the stats start, up to today). */
  days: number;
  wins: number;
  halves: number;
  losses: number;
  /** Weeks that ended this month (Monday to Sunday). */
  series: { won: number; lost: number };
  workouts: number;
  coldShower: number;
  walk: number;
  big3: { done: number; of: number };
  photos: PhotoRow[];
  bestDay: { date: string; big3: number } | null;
  /** True while the month is still going. */
  soFar: boolean;
}

export function monthFacts(s: Snapshot, month: string, now: Now): MonthFacts {
  const dates = monthDates(month).filter((d) => d <= now.date && counts(s, d) && !!s.days[d]);
  const recs = dates.map((d) => dayOf(s, d));
  const results = dates.map((d) => s.days[d]?.result ?? null);
  const weeks = [...new Set(monthDates(month).map(weekStart))].filter((w) => {
    const sunday = addDays(w, 6);
    return sunday.startsWith(month) && sunday < now.date && counts(s, sunday);
  });
  const series = { won: 0, lost: 0 };
  for (const w of weeks) {
    const r = scoreWeek(Array.from({ length: 7 }, (_, i) => s.days[addDays(w, i)]?.result ?? null));
    if (r.won) series.won += 1;
    else series.lost += 1;
  }
  const big3 = recs.flatMap((r) => r.big3);
  const order = { win: 3, half: 2, loss: 1 } as const;
  const best = dates
    .map((d, i) => ({ date: d, r: results[i], big3: recs[i]!.big3.filter((x) => isItemDone(s, x)).length }))
    .filter((x) => x.r)
    .sort((a, b) => order[b.r!] - order[a.r!] || b.big3 - a.big3 || a.date.localeCompare(b.date))[0];
  return {
    month,
    days: dates.length,
    wins: results.filter((r) => r === 'win').length,
    halves: results.filter((r) => r === 'half').length,
    losses: results.filter((r) => r === 'loss').length,
    series,
    workouts: dates.filter((d) => countedOn(s, d, now).body).length,
    coldShower: recs.filter((r) => r.coldShower.done).length,
    walk: recs.filter((r) => r.walk.done).length,
    big3: { done: big3.filter((x) => isItemDone(s, x)).length, of: big3.length },
    photos: s.photos.filter((p) => p.date.startsWith(month) && counts(s, p.date)).sort((a, b) => a.date.localeCompare(b.date)),
    bestDay: best ? { date: best.date, big3: best.big3 } : null,
    soFar: monthDates(month).at(-1)! >= now.date,
  };
}

/** Facts for the coach letter: numbers only. */
export function factsForLetter(f: MonthFacts): Record<string, unknown> {
  return {
    month: monthName(f.month),
    still_going: f.soFar,
    days_lived: f.days,
    days: { wins: f.wins, half_wins: f.halves, losses: f.losses },
    series: f.series,
    workouts: f.workouts,
    cold_showers: f.coldShower,
    walks_with_god: f.walk,
    big3_finished: `${f.big3.done} of ${f.big3.of}`,
    photos: f.photos.length,
    best_day: f.bestDay?.date ?? null,
  };
}

/** The plain letter, from the facts alone. */
export function plainLetter(f: MonthFacts, name: string): string {
  if (!f.days) return `${name}, nothing counted in ${monthName(f.month)} yet. The first day is the one in front of you.`;
  const record = `${f.wins} wins, ${f.halves} half wins and ${f.losses} losses over ${f.days} days`;
  const anchors = `${f.walk} walks with God and ${f.coldShower} cold showers`;
  const close = f.walk >= f.days * 0.8 ? 'The walk held, and everything else is built on it.' : 'More mornings with God is the first thing to build next month.';
  return `${name}, ${monthName(f.month)}${f.soFar ? ' so far' : ''}: ${record}. ${anchors}, ${f.workouts} workout days, ${f.big3.done} of ${f.big3.of} Big 3 items finished. ${close} Keep showing up; the fruit comes in its season.`;
}
