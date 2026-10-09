// Pure glue between stored data and the planner. No React, no network.
import {
  addDays,
  ceil5,
  keptForReplan,
  pickBig3,
  planWeek,
  scoreDay,
  scoreWeek,
  streak,
  weekStart,
  type Block,
  type DayPlan,
  type Mode,
  type Task,
  type WorkoutType,
} from '../planner';
import type { Now } from '../lib/clock';
import { emptyDay, type Big3Item, type DayRecord, type DayResult, type Quote, type QuoteTag, type Snapshot } from '../data/model';

export const WEEK_DAYS = 7;

export function dayOf(s: Snapshot, date: string): DayRecord {
  return s.days[date] ?? emptyDay(date);
}

export function modeFor(s: Snapshot, date: string): Mode {
  if (dayOf(s, date).lostDay) return 'lostDay';
  return s.settings.codeRed ? 'codeRed' : 'normal';
}

const isWork = (b: Block) => b.kind === 'work' || b.kind === 'library_work';

/** Open tasks for the planner, with minutes already done on earlier days taken off. */
export function plannerTasks(s: Snapshot, today: string): Task[] {
  return s.tasks
    .filter((t) => t.status === 'open')
    .map((t) => {
      const done = s.blocks
        .filter((b) => b.taskId === t.id && b.date < today && b.status === 'done')
        .reduce((m, b) => m + b.end - b.start, 0);
      return { ...t, estimatedMinutes: Math.max(5, t.estimatedMinutes - done) };
    });
}

/** Keep Eli's picks, drop finished or missing tasks, and fill empty slots with suggestions. */
export function fillBig3(s: Snapshot, date: string, current: Big3Item[]): Big3Item[] {
  const open = plannerTasks(s, date);
  const openIds = new Set(open.map((t) => t.id));
  const doneToday = new Set(s.tasks.filter((t) => t.status === 'done' && t.completedAt?.slice(0, 10) === date).map((t) => t.id));
  const kept = current.filter((i) => openIds.has(i.taskId) || doneToday.has(i.taskId)).slice(0, 3);
  if (kept.length >= 3) return kept;
  const { suggested } = pickBig3(
    open.filter((t) => !kept.some((k) => k.taskId === t.id)),
    date,
    [],
  );
  return [...kept, ...suggested.slice(0, 3 - kept.length).map((taskId) => ({ taskId, locked: false, accepted: false }))];
}

/** A fresh set of suggestions for the unlocked slots ("Suggest again"): skips the current suggestions. */
export function suggestAgain(s: Snapshot, date: string, current: Big3Item[]): Big3Item[] {
  const keep = current.filter((i) => i.locked || i.accepted);
  const skip = new Set(current.filter((i) => !i.locked && !i.accepted).map((i) => i.taskId));
  const pool = plannerTasks(s, date).filter((t) => !keep.some((k) => k.taskId === t.id) && !skip.has(t.id));
  const { suggested } = pickBig3(pool, date, []);
  const next = [...keep, ...suggested.slice(0, 3 - keep.length).map((taskId) => ({ taskId, locked: false, accepted: false }))];
  return next.length > keep.length ? next : fillBig3(s, date, keep);
}

/** Workouts this week (Monday to yesterday) that were planned and not skipped. */
export function workoutsBefore(s: Snapshot, today: string): Record<WorkoutType, number> {
  const from = weekStart(today);
  const done = { field: 0, weights: 0 };
  for (const b of s.blocks) {
    if (b.kind !== 'workout' || b.date < from || b.date >= today || b.status === 'skipped') continue;
    if (b.id.endsWith(':field')) done.field += 1;
    else done.weights += 1;
  }
  return done;
}

export interface WeekBuild {
  dates: string[];
  blocks: Block[];
  days: DayRecord[];
  plans: DayPlan[];
}

/**
 * Plan today (from now) and the next 6 days. Today keeps what happened and what Eli placed by hand;
 * later days keep only done, pinned and manual blocks.
 */
export function buildWeek(s: Snapshot, now: Now): WeekBuild {
  const today = now.date;
  const dates = Array.from({ length: WEEK_DAYS }, (_, i) => addDays(today, i));
  const record = dayOf(s, today);
  const pinnedByDate: Record<string, Block[]> = {};
  for (const d of dates) {
    const existing = s.blocks.filter((b) => b.date === d);
    pinnedByDate[d] =
      d === today
        ? keptForReplan(existing, ceil5(now.min))
        : existing.filter((b) => b.status === 'done' || b.status === 'in_progress' || b.pinned || b.source === 'manual');
  }
  const plans = planWeek({
    startDate: today,
    now: now.min,
    today: {
      wakeMin: record.wakeMin ?? s.settings.wakeTargetMin,
      expectedWakeMin: s.days[addDays(today, -1)]?.plan.bedtime?.wakeMin ?? s.settings.wakeTargetMin,
      anchors: { coldShower: record.coldShower, walk: record.walk },
      big3: record.big3.map((i) => i.taskId),
      mode: modeFor(s, today),
    },
    codeRed: s.settings.codeRed,
    codeRedLevel: s.settings.codeRedLevel,
    eventDefs: s.events,
    tasks: plannerTasks(s, today),
    places: s.places,
    settings: s.settings,
    pinnedByDate,
    suppressByDate: Object.fromEntries(dates.map((d) => [d, dayOf(s, d).plan.suppressed ?? []])),
    workoutsThisWeek: workoutsBefore(s, today),
  });
  const days = plans.map((p) => ({
    ...dayOf(s, p.date),
    plan: { warnings: p.warnings, notes: p.notes, bedtime: p.bedtime, belowTheLine: p.belowTheLine, suppressed: dayOf(s, p.date).plan.suppressed ?? [] },
  }));
  return { dates, blocks: plans.flatMap((p) => p.blocks), days, plans };
}

/** Salvage items done on a Lost Day: the walk, a workout, a Big 3 item, a meal. */
export function salvageCount(s: Snapshot, date: string): number {
  const rec = dayOf(s, date);
  const blocks = s.blocks.filter((b) => b.date === date && b.status === 'done');
  let n = rec.walk.done ? 1 : 0;
  if (blocks.some((b) => b.kind === 'workout')) n += 1;
  if (blocks.some((b) => b.kind === 'meal')) n += 1;
  if (rec.big3.some((i) => isTaskDone(s, i.taskId))) n += 1;
  return n;
}

export const isTaskDone = (s: Snapshot, id: string): boolean => s.tasks.find((t) => t.id === id)?.status === 'done';

export function resultFor(s: Snapshot, date: string): DayResult {
  const rec = dayOf(s, date);
  return scoreDay({
    coldShowerDone: rec.coldShower.done,
    walkDone: rec.walk.done,
    big3Done: rec.big3.map((i) => isTaskDone(s, i.taskId)),
    lostDay: rec.lostDay,
    lostDayReason: rec.lostDayReason,
    salvageCompleted: salvageCount(s, date),
  });
}

/**
 * Close every past day that has no result: score it, and count a deferral for each open task that was
 * planned that day and not done. Days in the current week with no record at all count as losses.
 */
export function finalizePast(s: Snapshot, today: string): { days: DayRecord[]; taskIds: string[] } {
  const known = Object.keys(s.days).sort();
  const first = known[0];
  const out: DayRecord[] = [];
  const deferred = new Set<string>();
  if (!first) return { days: out, taskIds: [] };
  const from = first > weekStart(today) ? first : weekStart(today);
  const dates = new Set(known.filter((d) => d < today && !s.days[d]!.result));
  for (let d = from; d < today; d = addDays(d, 1)) if (!s.days[d]) dates.add(d);
  for (const d of [...dates].sort()) {
    out.push({ ...dayOf(s, d), result: resultFor(s, d) });
    for (const b of s.blocks.filter((x) => x.date === d && isWork(x) && x.taskId)) {
      const t = s.tasks.find((x) => x.id === b.taskId);
      if (t && t.status === 'open' && !s.blocks.some((x) => x.date === d && x.taskId === t.id && x.status === 'done')) deferred.add(t.id);
    }
  }
  return { days: out, taskIds: [...deferred] };
}

/** Results for Monday to Sunday of the week containing date (null = upcoming or not scored). */
export function weekResults(s: Snapshot, date: string): (DayResult | null)[] {
  const start = weekStart(date);
  return Array.from({ length: 7 }, (_, i) => s.days[addDays(start, i)]?.result ?? null);
}

/** Series won and lost across all finished weeks. */
export function seasonRecord(s: Snapshot, today: string): { won: number; lost: number } {
  const weeks = new Set(Object.keys(s.days).map(weekStart));
  let won = 0;
  let lost = 0;
  for (const w of weeks) {
    if (w >= weekStart(today)) continue;
    if (scoreWeek(weekResults(s, w)).won) won += 1;
    else lost += 1;
  }
  return { won, lost };
}

export function anchorStreaks(s: Snapshot, today: string): { coldShower: number; walk: number } {
  return {
    coldShower: streak(today, (d) => !!s.days[d]?.coldShower.done),
    walk: streak(today, (d) => !!s.days[d]?.walk.done),
  };
}

/** Quote by situation: regret after a Loss, hard day after a Half, win after a Win, general otherwise. */
export function quoteFor(s: Snapshot, today: string): Quote | null {
  const yesterday = s.days[addDays(today, -1)]?.result ?? null;
  const tag: QuoteTag = yesterday === 'loss' ? 'regret' : yesterday === 'half' ? 'hard_day' : yesterday === 'win' ? 'win' : 'general';
  const pool = s.quotes.filter((q) => q.tags.includes(tag));
  const list = pool.length ? pool : s.quotes;
  if (!list.length) return null;
  const n = [...today].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 9973, 7);
  return list[n % list.length]!;
}

/** Progress for the Home ring: anchors plus the Big 3. */
export function todayProgress(s: Snapshot, date: string): { done: number; total: number } {
  const rec = dayOf(s, date);
  const big3Done = rec.big3.filter((i) => isTaskDone(s, i.taskId)).length;
  return { done: Number(rec.coldShower.done) + Number(rec.walk.done) + big3Done, total: 2 + rec.big3.length };
}

/** The next thing to do: the first planned block that has not ended yet. */
export function nextBlock(s: Snapshot, now: Now): Block | null {
  return (
    s.blocks
      .filter((b) => b.date === now.date && b.end > now.min && b.status !== 'done' && b.status !== 'skipped')
      .filter((b) => b.kind !== 'travel' && b.kind !== 'bed')
      .sort((a, b) => a.start - b.start)[0] ?? null
  );
}
