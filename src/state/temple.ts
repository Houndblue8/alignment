// The weekly temple (Eli, Oct 10). Each pillar has a weekly target; each day Eli shows up for a pillar adds a
// stone. The temple rises Monday to Sunday and is saved when the week closes. Pure.
import { DEFAULT_TARGETS, JOURNEYS, WATER_FROM, type Snapshot, type WeeklyTargets } from '../data/model';
import type { Now } from '../lib/clock';
import { addDays, expandEvents, scoreWeek, weekStart as weekStartOf, type Journey, type SeriesLabel } from '../planner';
import { pillarSteps } from './pillars';
import { dayOf, isItemDone } from './planning';

export const UNIT: Record<Journey, string> = {
  faith: 'days with God',
  body: 'days',
  sport: 'sessions',
  school: 'study days',
  shs: 'committed days',
  life: 'connections',
};


/**
 * Steps a pillar needs in one day to count for that day (Oct 16, from the day the water anchor starts): Faith
 * takes two things (the walk and one more), Stewardship three (the water, the cold shower, and one more). The
 * rest take one. Earlier days keep the old rule of one.
 */
export const DAY_NEED: Record<Journey, number> = { faith: 2, body: 3, sport: 1, school: 1, shs: 1, life: 1 };
export const needOn = (j: Journey, date: string): number => (date >= WATER_FROM ? DAY_NEED[j] : 1);

/** Steps per pillar on a day: what the app saw, plus one for a night tap. */
export function stepCounts(s: Snapshot, date: string, now: Now): Record<Journey, number> {
  const steps = pillarSteps(s, date, now);
  const tapped = new Set(dayOf(s, date).showedUp ?? []);
  return Object.fromEntries(JOURNEYS.map((j) => [j.id, steps[j.id].length + (tapped.has(j.id) ? 1 : 0)])) as Record<Journey, number>;
}

/**
 * What the app saw on a day, per pillar, at the day's need. Set-time things count when they happen (practice,
 * the workout, Epic, church, social plans); the rest needs a check (Big 3 items, tasks, the floor) or a logged step.
 */
export function seenOn(s: Snapshot, date: string, now: Now): Record<Journey, boolean> {
  const steps = pillarSteps(s, date, now);
  return Object.fromEntries(JOURNEYS.map((j) => [j.id, steps[j.id].length >= needOn(j.id, date)])) as Record<Journey, boolean>;
}

/** Athletics sessions on a day: every Athletics step (practice, flag football, the lift, a game) is one. */
export function sessionsOn(s: Snapshot, date: string, now: Now): number {
  return stepCounts(s, date, now).sport;
}

/** A pillar counts on a day when its steps (the app's, plus a night tap) reach the day's need. */
export function countedOn(s: Snapshot, date: string, now: Now): Record<Journey, boolean> {
  const n = stepCounts(s, date, now);
  return Object.fromEntries(JOURNEYS.map((j) => [j.id, n[j.id] >= needOn(j.id, date)])) as Record<Journey, boolean>;
}

export interface PillarWeek {
  id: Journey;
  label: string;
  /** Days (or practices) that counted so far this week. */
  done: number;
  target: number;
  /** done / target, 0 to 1. */
  ratio: number;
  /** Monday to Sunday. */
  days: boolean[];
  today: boolean;
}

export interface WeekTemple {
  weekStart: string;
  pillars: PillarWeek[];
  /** Every pillar at its target. */
  complete: boolean;
  /** Average of the pillar ratios, 0 to 1. */
  built: number;
  examWeek: boolean;
}

export function targetsFor(s: Snapshot, start: string): { targets: Record<Journey, number>; examWeek: boolean } {
  const t: WeeklyTargets = { ...DEFAULT_TARGETS, ...(s.settings.weeklyTargets ?? {}) };
  const dates = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const examWeek = dates.some((d) => expandEvents(s.events, d, s.settings).some((e) => e.kind === 'exam'));
  const practices = dates.reduce((n, d) => {
    const planned = s.blocks.filter((b) => b.date === d && b.kind === 'practice').length;
    return n + (planned || expandEvents(s.events, d, s.settings).filter((e) => e.kind === 'practice').length);
  }, 0);
  const n = (v: number | null | undefined, fallback: number) => (v == null ? fallback : v);
  const targets: Record<Journey, number> = {
    faith: n(t.faith, 7),
    body: n(t.body, 5),
    sport: n(t.sport, Math.max(1, practices + 6)),
    school: n(t.school, 5),
    shs: n(t.shs, 6),
    life: n(t.life, 3),
  };
  // Exam weeks lean toward school (D4: the floor yields to exams).
  if (examWeek) {
    targets.school = Math.min(7, targets.school + 1);
    targets.shs = Math.max(2, targets.shs - 2);
  }
  for (const j of JOURNEYS) targets[j.id] = Math.max(1, Math.min(j.id === 'sport' ? 14 : 7, targets[j.id]));
  return { targets, examWeek };
}

export function weekTemple(s: Snapshot, start: string, now: Now): WeekTemple {
  const dates = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const { targets, examWeek } = targetsFor(s, start);
  const counted = dates.map((d) => (d > now.date ? null : countedOn(s, d, now)));
  const pillars = JOURNEYS.map((j) => {
    const days = counted.map((c) => !!c?.[j.id]);
    // Athletics counts sessions (a workout and a practice in a day count twice); every other pillar counts days.
    const done =
      j.id === 'sport'
        ? dates.reduce((n, d, i) => {
            if (!counted[i]) return n;
            return n + sessionsOn(s, d, now);
          }, 0)
        : days.filter(Boolean).length;
    const target = targets[j.id];
    return { id: j.id, label: j.label, done, target, ratio: Math.min(1, done / target), days, today: !!counted[dates.indexOf(now.date)]?.[j.id] };
  });
  return {
    weekStart: start,
    pillars,
    complete: pillars.every((p) => p.done >= p.target),
    built: pillars.reduce((a, p) => a + p.ratio, 0) / pillars.length,
    examWeek,
  };
}

/** What gets saved when the week closes: a few numbers, enough to draw the temple again. */
export interface SavedTemple {
  weekStart: string;
  pillars: Record<Journey, [done: number, target: number]>;
  series: { wins: number; halves: number; losses: number; points: number; won: boolean; label: SeriesLabel };
}

export function saveableTemple(s: Snapshot, start: string, now: Now): SavedTemple {
  const t = weekTemple(s, start, now);
  const results = Array.from({ length: 7 }, (_, i) => s.days[addDays(start, i)]?.result ?? null);
  const series = scoreWeek(results);
  return {
    weekStart: start,
    pillars: Object.fromEntries(t.pillars.map((p) => [p.id, [p.done, p.target]])) as SavedTemple['pillars'],
    series: {
      wins: results.filter((r) => r === 'win').length,
      halves: results.filter((r) => r === 'half').length,
      losses: results.filter((r) => r === 'loss').length,
      points: series.points,
      won: series.won,
      label: series.label,
    },
  };
}

export interface BuildingState {
  foundation: { water: boolean; coldShower: boolean; walk: boolean };
  /** Each pillar: today's steps, and the week so far (the column height). */
  pillars: { id: Journey; label: string; steps: number; ratio: number; done: number; target: number; today: boolean }[];
  /** The Big 3: little flames that hop into the fire when done. */
  torches: { done: number; total: number; items: { taskId: string; done: boolean; pillar: Journey }[] };
  complete: boolean;
  week: WeekTemple;
}

export function buildingFor(s: Snapshot, date: string, now: Now): BuildingState {
  const rec = dayOf(s, date);
  const steps = pillarSteps(s, date, now);
  const week = weekTemple(s, weekStartOf(date), now);
  const items = rec.big3.map((i) => ({ taskId: i.taskId, done: isItemDone(s, i), pillar: s.tasks.find((t) => t.id === i.taskId)?.journey ?? ('shs' as Journey) }));
  const done = items.filter((i) => i.done).length;
  // Days before the water anchor existed count it as laid.
  const foundation = { water: rec.water.done || date < WATER_FROM, coldShower: rec.coldShower.done, walk: rec.walk.done };
  return {
    foundation,
    pillars: week.pillars.map((p) => ({ id: p.id, label: p.label, steps: steps[p.id].length, ratio: p.ratio, done: p.done, target: p.target, today: p.today })),
    torches: { done, total: items.length, items },
    complete: foundation.water && foundation.coldShower && foundation.walk && items.length > 0 && done === items.length,
    week,
  };
}

/** One line under the fire, in the coach voice: today is about the foundation and the Big 3. */
export function buildingLine(b: BuildingState): string {
  const atTarget = b.week.pillars.filter((p) => p.done >= p.target).length;
  const temple = `Temple this week: ${atTarget} of 6 pillars at target.`;
  if (b.complete) return `All three little flames are in the fire. That day is a Win. ${temple}`;
  const laid = Number(b.foundation.water) + Number(b.foundation.coldShower) + Number(b.foundation.walk);
  if (laid === 0) return 'Lay the foundation first: a glass of water, the cold shower, then the walk.';
  if (laid < 3) return `${laid} of 3 in the foundation. Finish it. ${temple}`;
  if (b.torches.total === 0) return `Foundation laid. Pick your Big 3: three little flames for the fire. ${temple}`;
  if (b.torches.done === 0) return `Foundation laid. Now feed the fire: your Big 3. ${temple}`;
  return `${b.torches.done} of ${b.torches.total} in the fire. ${temple}`;
}
