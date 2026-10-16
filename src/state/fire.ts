// The fire at the center of the temple (Eli, Oct 16). Pure. Simple and honest: today's fire is a percent made of
// pieces Eli can see.
// - Foundation, 30: the glass of water, the cold shower, the walk with God (10 each).
// - The Big 3, 50: each little flame that hops in.
// - Faith, 20: steps toward God beyond the walk (prayer, serving, Epic, church, sharing His love), 10 each, or
//   the night tap "I drew closer to God today", which fills it.
// Everything done without faith tops out at 80. Everything plus faith is 100: a blue fire.
// A Lost Day trades the Big 3 for one faith focus: foundation 30, the focus 50, surrendering the day to Him 20.
// All of it is a purple fire: you are loved by God; look at today with eternal eyes.
// The fire never goes out: an ember is always there. Each day is its own fire; the week and the log keep them.
import { WATER_FROM, type Snapshot } from '../data/model';
import type { Now } from '../lib/clock';
import { addDays, weekStart } from '../planner';
import { pillarSteps } from './pillars';
import { counts, dayOf, firstCounted, isItemDone } from './planning';

export type FireLevel = 'ember' | 'flame' | 'blaze' | 'bright' | 'blue' | 'purple';

export interface FirePart {
  label: string;
  pts: number;
  max: number;
}

export interface DayFire {
  date: string;
  /** 0 to 100. */
  pct: number;
  level: FireLevel;
  lost: boolean;
  foundation: FirePart;
  /** The Big 3 (or a Lost Day's one focus). */
  work: FirePart;
  /** Faith beyond the walk (or a Lost Day's surrender). */
  faith: FirePart;
  /** Each piece, for the list in the fire sheet. */
  pieces: { label: string; done: boolean; pts: number }[];
}

/** Drawn size of the fire when nothing is in yet: the ember never goes out. */
export const EMBER = 0.12;

export function levelFor(pct: number, lost: boolean): FireLevel {
  if (pct >= 100) return lost ? 'purple' : 'blue';
  return pct >= 80 ? 'bright' : pct >= 50 ? 'blaze' : pct >= 25 ? 'flame' : 'ember';
}

export function dayFire(s: Snapshot, date: string, now: Now): DayFire {
  const rec = dayOf(s, date);
  const pieces: DayFire['pieces'] = [];
  // Foundation: before the water anchor existed, the cold shower and the walk carry 15 each.
  const anchors: [string, boolean][] = [
    ...(date >= WATER_FROM ? ([['Glass of water', rec.water.done]] as [string, boolean][]) : []),
    ['Cold shower', rec.coldShower.done],
    ['Walk with God', rec.walk.done],
  ];
  const each = 30 / anchors.length;
  for (const [label, done] of anchors) pieces.push({ label, done, pts: each });
  const foundation = { label: 'Foundation', pts: anchors.filter(([, d]) => d).length * each, max: 30 };

  const lost = rec.lostDay && !!rec.lostFocus;
  let work: FirePart;
  let faith: FirePart;
  if (lost) {
    const f = rec.lostFocus!;
    const surrendered = !!f.surrender?.trim();
    pieces.push({ label: f.text, done: f.done, pts: 50 }, { label: 'Surrendered the day to God', done: surrendered, pts: 20 });
    work = { label: 'The one focus', pts: f.done ? 50 : 0, max: 50 };
    faith = { label: 'Surrender', pts: surrendered ? 20 : 0, max: 20 };
  } else {
    const n = rec.big3.length;
    for (const i of rec.big3) {
      const t = s.tasks.find((x) => x.id === i.taskId);
      pieces.push({ label: t?.title ?? 'Big 3 item', done: isItemDone(s, i), pts: n ? 50 / n : 0 });
    }
    const done = rec.big3.filter((i) => isItemDone(s, i)).length;
    work = { label: 'The Big 3', pts: n ? (50 * done) / n : 0, max: 50 };
    const steps = pillarSteps(s, date, now).faith.filter((x) => x.key !== 'anchor:walk');
    const tapped = (rec.showedUp ?? []).includes('faith') ? 1 : 0;
    const closer = !!rec.inner?.closer;
    const pts = closer ? 20 : Math.min(20, 10 * (steps.length + tapped));
    for (const st of steps.slice(0, 2)) pieces.push({ label: st.text, done: true, pts: 10 });
    if (closer) pieces.push({ label: 'Drew closer to God today', done: true, pts: 20 });
    else if (pts < 20) pieces.push({ label: pts ? 'One more step toward God' : 'A step toward God: prayer, serving, His Word, sharing His love', done: false, pts: 20 - pts });
    faith = { label: 'Faith', pts, max: 20 };
  }
  const pct = Math.round(foundation.pts + work.pts + faith.pts);
  return { date, pct, level: levelFor(pct, lost), lost, foundation, work, faith, pieces };
}

export interface FireState {
  /** Drawn size, EMBER to 1. */
  value: number;
  pct: number;
  level: FireLevel;
  today: DayFire;
  /** Monday to Sunday of this week (null: still ahead, or before stats start). */
  week: (DayFire | null)[];
  /** Average of the days so far this week. */
  weekAvg: number;
  line: string;
}

export function fireFor(s: Snapshot, now: Now): FireState {
  const today = dayFire(s, now.date, now);
  const week = fireWeek(s, weekStart(now.date), now);
  const lived = week.filter((d): d is DayFire => !!d);
  return {
    value: Math.max(EMBER, today.pct / 100),
    pct: today.pct,
    level: today.level,
    today,
    week,
    weekAvg: lived.length ? Math.round(lived.reduce((a, d) => a + d.pct, 0) / lived.length) : 0,
    line: fireLine(s, today),
  };
}

/** One week of fires, Monday to Sunday. Days ahead or before stats start are null. */
export function fireWeek(s: Snapshot, start: string, now: Now): (DayFire | null)[] {
  const first = firstCounted(s, now.date);
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(start, i);
    return d > now.date || d < first || !counts(s, d) ? null : dayFire(s, d, now);
  });
}

/** The fire log: the last few weeks, newest first, back to the first day that counts. */
export function fireLog(s: Snapshot, now: Now, weeks = 8): { weekStart: string; days: (DayFire | null)[]; avg: number }[] {
  const first = weekStart(firstCounted(s, now.date));
  const out = [];
  for (let w = weekStart(now.date), k = 0; w >= first && k < weeks; w = addDays(w, -7), k++) {
    const days = fireWeek(s, w, now);
    const lived = days.filter((d): d is DayFire => !!d);
    out.push({ weekStart: w, days, avg: lived.length ? Math.round(lived.reduce((a, d) => a + d.pct, 0) / lived.length) : 0 });
  }
  return out;
}

export const LEVEL_NAME: Record<FireLevel, string> = {
  ember: 'Ember',
  flame: 'Flame',
  blaze: 'Blaze',
  bright: 'Burning bright',
  blue: 'Blue fire',
  purple: 'Purple fire',
};

function fireLine(s: Snapshot, t: DayFire): string {
  if (t.level === 'purple') return 'Purple fire. You are loved by God. Look at today with eternal eyes.';
  if (t.level === 'blue') return 'Blue fire. Everything done, and done with God.';
  if (t.lost) {
    const f = dayOf(s, t.date).lostFocus!;
    if (!f.done) return `One thing before the day ends: ${f.text}. Give the rest to Him.`;
    if (!t.faith.pts) return 'Before bed, tell Him what you are surrendering.';
    return 'Lay the foundation too, and the fire turns purple.';
  }
  if (t.foundation.pts < t.foundation.max) return 'Feed the fire from the bottom up: the foundation first.';
  if (t.work.pts < t.work.max) return 'Foundation laid. Now the Big 3: each little flame that hops in feeds it.';
  return 'Everything is done. The last 20 is His: a prayer, serving someone, sharing His love.';
}
