// The weekly temple (Eli, Oct 10). Each pillar has a weekly target; each day Eli shows up for a pillar adds a
// stone. The temple rises Monday to Sunday and is saved when the week closes. Pure.
import { DEFAULT_TARGETS, JOURNEYS, type Snapshot, type WeeklyTargets } from '../data/model';
import type { Now } from '../lib/clock';
import { addDays, expandEvents, scoreWeek, weekStart as weekStartOf, type Block, type Journey, type SeriesLabel } from '../planner';
import { pillarFromTitle, pillarSteps } from './pillars';
import { dayOf, isItemDone } from './planning';

export const UNIT: Record<Journey, string> = {
  faith: 'days with God',
  body: 'workouts',
  sport: 'practices',
  school: 'study days',
  shs: 'committed days',
  life: 'connections',
};

const ended = (b: Block, now: Now) => b.date < now.date || (b.date === now.date && b.end <= now.min);
const showedUp = (b: Block, now: Now) => b.status === 'done' || (b.status !== 'skipped' && ended(b, now));

/**
 * What the app saw on a day, per pillar. Set-time things count when they happen (practice, the workout, Epic,
 * church, social plans); the rest needs a check (Big 3 items, tasks, the floor) or a logged step.
 */
export function seenOn(s: Snapshot, date: string, now: Now): Record<Journey, boolean> {
  const rec = dayOf(s, date);
  const blocks = s.blocks.filter((b) => b.date === date);
  const eventPillar = (b: Block): Journey | null => {
    const def = b.eventId ? s.events.find((e) => e.id === b.eventId) : undefined;
    if (!def) return null;
    if (['church', 'epic_large', 'epic_small', 'discipleship', 'retreat'].includes(def.rankKey)) return 'faith';
    if (def.rankKey === 'social') return 'life';
    return null;
  };
  const doneTask = (j: Journey) =>
    rec.big3.some((i) => isItemDone(s, i) && s.tasks.find((t) => t.id === i.taskId)?.journey === j) ||
    blocks.some((b) => b.taskId && b.status === 'done' && s.tasks.find((t) => t.id === b.taskId)?.journey === j);
  const logged = (j: Journey) => (rec.steps ?? []).some((x) => x.pillar === j);
  return {
    faith: rec.walk.done || logged('faith') || doneTask('faith') || blocks.some((b) => eventPillar(b) === 'faith' && showedUp(b, now)),
    body: blocks.some((b) => b.kind === 'workout' && showedUp(b, now)) || logged('body') || doneTask('body'),
    sport: blocks.some((b) => b.kind === 'practice' && showedUp(b, now)) || logged('sport'),
    school: doneTask('school') || logged('school') || blocks.some((b) => b.kind === 'library_work' && b.status === 'done'),
    shs: blocks.some((b) => b.kind === 'shs_floor' && b.status === 'done') || doneTask('shs') || logged('shs'),
    life:
      logged('life') ||
      doneTask('life') ||
      blocks.some((b) => showedUp(b, now) && (eventPillar(b) === 'life' || (b.source === 'manual' && pillarFromTitle(b.title) === 'life'))),
  };
}

/** A pillar counts on a day when the app saw it or Eli tapped it at night. */
export function countedOn(s: Snapshot, date: string, now: Now): Record<Journey, boolean> {
  const seen = seenOn(s, date, now);
  const tapped = new Set(dayOf(s, date).showedUp ?? []);
  return Object.fromEntries(JOURNEYS.map((j) => [j.id, seen[j.id] || tapped.has(j.id)])) as Record<Journey, boolean>;
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
    body: n(t.body, 6),
    sport: n(t.sport, Math.max(1, practices)),
    school: n(t.school, 5),
    shs: n(t.shs, 6),
    life: n(t.life, 3),
  };
  // Exam weeks lean toward school (D4: the floor yields to exams).
  if (examWeek) {
    targets.school = Math.min(7, targets.school + 1);
    targets.shs = Math.max(2, targets.shs - 2);
  }
  for (const j of JOURNEYS) targets[j.id] = Math.max(1, Math.min(7, targets[j.id]));
  return { targets, examWeek };
}

export function weekTemple(s: Snapshot, start: string, now: Now): WeekTemple {
  const dates = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const { targets, examWeek } = targetsFor(s, start);
  const counted = dates.map((d) => (d > now.date ? null : countedOn(s, d, now)));
  const pillars = JOURNEYS.map((j) => {
    const days = counted.map((c) => !!c?.[j.id]);
    // Sports counts practices (two in a day count twice); every other pillar counts days.
    const done =
      j.id === 'sport'
        ? dates.reduce((n, d, i) => {
            if (!counted[i]) return n;
            const practices = s.blocks.filter((b) => b.date === d && b.kind === 'practice' && showedUp(b, now)).length;
            return n + (practices || (days[i] ? 1 : 0));
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
  foundation: { coldShower: boolean; walk: boolean };
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
  const foundation = { coldShower: rec.coldShower.done, walk: rec.walk.done };
  return {
    foundation,
    pillars: week.pillars.map((p) => ({ id: p.id, label: p.label, steps: steps[p.id].length, ratio: p.ratio, done: p.done, target: p.target, today: p.today })),
    torches: { done, total: items.length, items },
    complete: foundation.coldShower && foundation.walk && items.length > 0 && done === items.length,
    week,
  };
}

/** One line under the fire, in the coach voice: today is about the foundation and the Big 3. */
export function buildingLine(b: BuildingState): string {
  const atTarget = b.week.pillars.filter((p) => p.done >= p.target).length;
  const temple = `Temple this week: ${atTarget} of 6 pillars at target.`;
  if (b.complete) return `All three little flames are in the fire. That day is a Win. ${temple}`;
  if (!b.foundation.coldShower && !b.foundation.walk) return 'Lay the foundation first: the cold shower, then the walk.';
  if (!b.foundation.coldShower || !b.foundation.walk) return `Half the foundation is set. Finish it. ${temple}`;
  if (b.torches.total === 0) return `Foundation laid. Pick your Big 3: three little flames for the fire. ${temple}`;
  if (b.torches.done === 0) return `Foundation laid. Now feed the fire: your Big 3. ${temple}`;
  return `${b.torches.done} of ${b.torches.total} in the fire. ${temple}`;
}
