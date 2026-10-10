// The fire at the center of the building (Eli, Oct 10). Pure.
// It reads the day: faith most of all (the walk with God, faith steps, the Spirit check), then the rest of life
// (the cold shower, the three torches of the Big 3, the other pillars, Mind and Heart). It carries from day to
// day and never goes out. When everything else breaks down but faith holds, it burns brighter than ever:
// "My strength is made perfect in weakness" (2 Corinthians 12:9).
import type { DayRecord, Snapshot } from '../data/model';
import type { Now } from '../lib/clock';
import { addDays } from '../planner';
import { pillarSteps } from './pillars';
import { dayOf, isItemDone } from './planning';

export interface Inner {
  mind: number;
  heart: number;
  spirit: number;
  note?: string;
}

export interface DayHeat {
  /** 0 to 1: the walk, faith steps, the Spirit check. */
  faith: number;
  /** 0 to 1: the cold shower, the torches, the other pillars, Mind and Heart. */
  life: number;
  /** What the day gives the fire: 0 to 1, or REFINER_HEAT on a refiner's day. */
  heat: number;
  /** Everything else broke down and faith held. */
  refiner: boolean;
}

/** The ember never goes out. */
export const EMBER = 0.12;
/** A refiner's day gives more heat than any ordinary day can. */
export const REFINER_HEAT = 1.25;
const CARRY = 0.6;
/** A refiner's day lifts the fire at least this high: above anything an ordinary day can reach (1.0). */
export const REFINER_FLOOR = 1.1;
/** Overnight the fire settles a little; today can only raise it from there. */
const OVERNIGHT = 0.9;
const HISTORY_DAYS = 60;

const norm = (n: number) => (Math.min(5, Math.max(1, n)) - 1) / 4;

/** Weighted average that skips missing parts (an unanswered check does not count as a low one). */
function blend(parts: [number | null, number][]): number {
  const have = parts.filter(([v]) => v !== null) as [number, number][];
  const w = have.reduce((a, [, x]) => a + x, 0);
  return w ? have.reduce((a, [v, x]) => a + v * x, 0) / w : 0;
}

export function dayHeat(s: Snapshot, date: string, now: Now): DayHeat {
  const rec: DayRecord = dayOf(s, date);
  const steps = pillarSteps(s, date, now);
  const inner = rec.inner ?? null;
  const faithSteps = steps.faith.filter((x) => x.text !== 'Walk with God').length;
  const faith = blend([
    [rec.walk.done ? 1 : 0, 0.4],
    [Math.min(faithSteps, 2) / 2, 0.35],
    [inner ? norm(inner.spirit) : null, 0.25],
  ]);
  const others = (['body', 'sport', 'school', 'shs', 'life'] as const).filter((p) => steps[p].length > 0).length;
  const torches = rec.big3.length ? rec.big3.filter((i) => isItemDone(s, i)).length / rec.big3.length : null;
  const life = blend([
    [rec.coldShower.done ? 1 : 0, 0.25],
    [torches, 0.35],
    [others / 5, 0.25],
    [inner ? (norm(inner.mind) + norm(inner.heart)) / 2 : null, 0.15],
  ]);
  // A breakdown has to be real: a low Mind or Heart, a Lost Day, or a day that played out with little else
  // standing (today counts only from 6 PM, so an early morning never looks like a broken day).
  const played = date < now.date || now.min >= 18 * 60;
  const brokeDown = rec.lostDay || (!!inner && (inner.mind <= 2 || inner.heart <= 2)) || (played && life < 0.4);
  const refiner = faith >= 0.7 && brokeDown;
  return { faith, life, refiner, heat: refiner ? REFINER_HEAT : 0.6 * faith + 0.4 * life };
}

export type FireLevel = 'ember' | 'flame' | 'blaze' | 'bright' | 'refiner';

export interface FireState {
  /** Shown now: about EMBER to REFINER_HEAT. */
  value: number;
  level: FireLevel;
  today: DayHeat;
  /** The fire at the end of each of the last 14 days, oldest first (today: so far). */
  trail: number[];
  line: string;
}

const settle = (prev: number, h: DayHeat) => Math.max(EMBER, CARRY * prev + (1 - CARRY) * h.heat, h.refiner ? REFINER_FLOOR : 0);

/** The fire carried through every day Eli has lived in the app (the last 60 at most), and today so far. */
export function fireFor(s: Snapshot, now: Now): FireState {
  const first = Object.keys(s.days).sort()[0] ?? now.date;
  let start = addDays(now.date, -HISTORY_DAYS);
  if (first > start) start = first;
  const trail: number[] = [];
  let fire = EMBER;
  let refinerRecent = false;
  for (let d = start; d < now.date; d = addDays(d, 1)) {
    const h = dayHeat(s, d, now);
    fire = settle(fire, h);
    trail.push(fire);
    if (h.refiner) refinerRecent = d >= addDays(now.date, -2);
  }
  const today = dayHeat(s, now.date, now);
  const value = Math.max(EMBER, OVERNIGHT * fire, settle(fire, today));
  trail.push(value);
  const level: FireLevel =
    today.refiner || (refinerRecent && value > 1) ? 'refiner' : value >= 0.8 ? 'bright' : value >= 0.5 ? 'blaze' : value >= 0.25 ? 'flame' : 'ember';
  return { value, level, today, trail: trail.slice(-14), line: fireLine(level, today) };
}

export const LEVEL_NAME: Record<FireLevel, string> = {
  ember: 'Ember',
  flame: 'Flame',
  blaze: 'Blaze',
  bright: 'Burning bright',
  refiner: "Refiner's fire",
};

function fireLine(level: FireLevel, t: DayHeat): string {
  if (level === 'refiner') return 'Everything else gave way and your faith held. The fire burns brighter than ever. His strength is made perfect in weakness.';
  if (level === 'ember') return 'An ember, never out. One step toward God brings it back: the walk, a prayer, a verse.';
  if (t.faith < 0.4) return 'The fire is fed first by time with God. Start there.';
  if (level === 'bright') return 'Burning bright. Guard it: stay close to Him and keep showing up.';
  return 'The fire is growing. Keep feeding it, faith first.';
}
