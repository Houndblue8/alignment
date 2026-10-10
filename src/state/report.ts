// Sunday scouting report (Appendix E 3). The facts and a plain draft are computed here, deterministically;
// the AI only rewrites the four lines in the coach voice, and the draft stands in when it is unavailable.
import { z } from 'zod';
import { addDays, scoreWeek, weekday, type SeriesLabel } from '../planner';
import type { Snapshot } from '../data/model';
import { dayOf, isItemDone, resultFor } from './planning';

export interface Rate {
  done: number;
  of: number;
}

export interface WeekFacts {
  weekStart: string;
  points: number;
  won: boolean;
  label: SeriesLabel;
  wins: number;
  halves: number;
  losses: number;
  lostDays: number;
  coldShower: Rate;
  walk: Rate;
  big3: Rate;
  workouts: Rate;
  shsFloor: Rate;
  photos: Rate;
  /** Days the wake came more than 15 minutes after last night's recommended wake. */
  lateWakes: number;
  bestDay: string | null;
  /** Open tasks pushed off at least twice. */
  deferred: string[];
}

export const ReportSchema = z.object({
  held: z.string().min(1).max(400),
  slipped: z.string().min(1).max(400),
  adjustment: z.string().min(1).max(400),
  vision: z.string().min(1).max(400),
});
export type ScoutingReport = z.infer<typeof ReportSchema>;

export interface StoredReport {
  facts: WeekFacts;
  report: ScoutingReport;
  source: 'coach' | 'draft';
}

const LATE_GRACE = 15;

/** The week closes on Sunday when wind-down starts (9:00 PM if there is no wind-down block). */
export function closeMin(s: Snapshot, sunday: string): number {
  return s.blocks.find((b) => b.date === sunday && b.kind === 'winddown')?.start ?? 21 * 60;
}

export function weekClosed(s: Snapshot, start: string, now: { date: string; min: number }): boolean {
  const sunday = addDays(start, 6);
  return now.date > sunday || (now.date === sunday && now.min >= closeMin(s, sunday));
}

/** Which report Home offers: this week's from Sunday close-out, last week's all Monday. */
export function reportToOffer(s: Snapshot, now: { date: string; min: number }): string | null {
  const wd = weekday(now.date);
  const start = wd === 0 ? addDays(now.date, -6) : wd === 1 ? addDays(now.date, -7) : null;
  if (!start || !weekClosed(s, start, now)) return null;
  return Object.keys(s.days).some((d) => d >= start && d <= addDays(start, 6)) ? start : null;
}

const rate = (done: number, of: number): Rate => ({ done, of });

export function weekFacts(s: Snapshot, start: string): WeekFacts {
  const dates = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  // Only days since Eli started count: a first, partial week is measured on the days it had.
  const first = Object.keys(s.days).sort()[0] ?? start;
  const span = dates.filter((d) => d >= first);
  const days = dates.map((d) => dayOf(s, d));
  // Sunday is not scored until Monday, so an unscored lived day is scored here; a skipped day is a loss.
  const results = dates.map((d) => s.days[d]?.result ?? (s.days[d] ? resultFor(s, d) : d >= first ? 'loss' : null));
  const series = scoreWeek(results);
  const blocks = s.blocks.filter((b) => b.date >= start && b.date <= dates[6]!);
  const count = (kind: string) => {
    const of = blocks.filter((b) => b.kind === kind);
    return rate(of.filter((b) => b.status === 'done').length, of.length);
  };
  const big3 = days.flatMap((d) => d.big3);
  let lateWakes = 0;
  for (const d of days) {
    if (d.wakeMin == null) continue;
    const expected = s.days[addDays(d.date, -1)]?.plan.bedtime?.wakeMin ?? s.settings.wakeTargetMin;
    if (d.wakeMin > expected + LATE_GRACE) lateWakes += 1;
  }
  const order = { win: 3, half: 2, loss: 1 } as const;
  const bestDay =
    dates
      .map((d, i) => ({ d, r: results[i], big3: days[i]!.big3.filter((x) => isItemDone(s, x)).length }))
      .filter((x) => x.r)
      .sort((a, b) => order[b.r!] - order[a.r!] || b.big3 - a.big3 || a.d.localeCompare(b.d))[0]?.d ?? null;
  const lived = days.filter((d) => d.checkinDone).length;
  return {
    weekStart: start,
    points: series.points,
    won: series.won,
    label: series.label,
    wins: results.filter((r) => r === 'win').length,
    halves: results.filter((r) => r === 'half').length,
    losses: results.filter((r) => r === 'loss').length,
    lostDays: days.filter((d) => d.lostDay).length,
    coldShower: rate(days.filter((d) => d.coldShower.done).length, span.length),
    walk: rate(days.filter((d) => d.walk.done).length, span.length),
    big3: rate(big3.filter((x) => isItemDone(s, x)).length, big3.length),
    workouts: count('workout'),
    shsFloor: count('shs_floor'),
    photos: rate(s.photos.filter((p) => p.date >= start && p.date <= dates[6]!).length, lived),
    lateWakes,
    bestDay,
    deferred: s.tasks.filter((t) => t.status === 'open' && t.deferralCount >= 2).map((t) => t.title),
  };
}

type Area = 'coldShower' | 'walk' | 'big3' | 'workouts' | 'shsFloor' | 'photos';
const AREAS: { key: Area; name: string }[] = [
  { key: 'coldShower', name: 'the cold shower' },
  { key: 'walk', name: 'the walk with God' },
  { key: 'big3', name: 'the Big 3' },
  { key: 'workouts', name: 'workouts' },
  { key: 'shsFloor', name: 'the Side Hustle Summit floor' },
  { key: 'photos', name: 'the daily photo' },
];

const pct = (r: Rate) => (r.of ? r.done / r.of : 1);

const ADJUST: Record<Area, string> = {
  coldShower: 'Cold shower before the phone comes off the charger. Five minutes after you wake, no decision to make.',
  walk: 'Walk at fifteen minutes after waking, even if it is only ten minutes. The short walk beats the skipped one.',
  big3: 'Pick a Big 3 you can finish. Make the first item something you can close before noon.',
  workouts: 'Treat the workout like a class. It starts right after the last class, and nothing gets booked over it.',
  shsFloor: 'Do the Side Hustle Summit floor before anything optional. It is short on purpose.',
  photos: 'Take the photo at the first natural break of the day, not at night.',
};

const fmtRate = (r: Rate) => `${r.done} of ${r.of}`;

/** The plain version, from the facts alone. */
export function draftReport(f: WeekFacts, identity: string): ScoutingReport {
  const scored = AREAS.filter((a) => f[a.key].of > 0).map((a) => ({ ...a, p: pct(f[a.key]) }));
  const strong = scored.filter((a) => a.p >= 0.85).sort((a, b) => b.p - a.p);
  // The photo never touches the score, so it is named as the slip only when everything that counts held.
  const below = scored.filter((a) => a.p < 0.85).sort((a, b) => a.p - b.p);
  const weak = below.find((a) => a.key !== 'photos') ?? below[0];
  const series = `${f.wins} wins, ${f.halves} half wins, ${f.losses} losses: ${f.points} points, series ${f.won ? `won (${f.label})` : 'lost'}.`;
  const held = strong.length
    ? `${series} What held: ${strong
        .slice(0, 3)
        .map((a) => `${a.name} (${fmtRate(f[a.key])})`)
        .join(', ')}.`
    : `${series} Nothing held above 85 percent this week.`;
  let slipped: string;
  let adjustment: string;
  if (f.lateWakes >= 2) {
    slipped = `${f.lateWakes} late wakes. A late wake costs the morning, and the anchors went with it.`;
    adjustment = 'Be in bed by the recommended bedtime Sunday through Thursday. The morning is won the night before.';
  } else if (weak && weak.p < 0.85) {
    slipped = `${weak.name[0]!.toUpperCase()}${weak.name.slice(1)}: ${fmtRate(f[weak.key])}.`;
    adjustment = ADJUST[weak.key];
  } else {
    slipped = 'No real slip in the numbers. Watch for coasting.';
    adjustment = 'Keep the same plan, and raise one bar: finish the first Big 3 item before lunch.';
  }
  if (f.deferred.length) slipped += ` Pushed off twice or more: ${f.deferred.slice(0, 3).join(', ')}.`;
  const firstLine = identity.split(/(?<=\.)\s/)[0] ?? identity;
  return { held, slipped, adjustment, vision: `This week was practice for who you said you are: ${firstLine}` };
}

/** Facts for the AI: plain numbers and names only. */
export function factsForCoach(f: WeekFacts): Record<string, unknown> {
  return {
    series: { points: f.points, won: f.won, label: f.label, wins: f.wins, half_wins: f.halves, losses: f.losses, lost_days: f.lostDays },
    cold_shower: fmtRate(f.coldShower),
    walk: fmtRate(f.walk),
    big3_finished: fmtRate(f.big3),
    workouts: fmtRate(f.workouts),
    shs_floor: fmtRate(f.shsFloor),
    photos: fmtRate(f.photos),
    late_wakes: f.lateWakes,
    best_day: f.bestDay,
    pushed_off_twice: f.deferred,
  };
}

/** Keeps the AI's lines only if they parse; strips dashes used as punctuation and emoji. */
export function cleanReport(raw: unknown): ScoutingReport | null {
  const r = ReportSchema.safeParse(raw);
  if (!r.success) return null;
  const tidy = (t: string) =>
    t
      .replace(/\s*[\u2013\u2014]\s*/g, ', ')
      .replace(/\p{Extended_Pictographic}/gu, '')
      .trim();
  return { held: tidy(r.data.held), slipped: tidy(r.data.slipped), adjustment: tidy(r.data.adjustment), vision: tidy(r.data.vision) };
}
