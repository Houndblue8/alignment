// Priority rules (Appendix B section 7, DECISIONS D4).
import { RULES } from './rules';
import { diffDays } from './time';
import type { Task } from './types';

/** Urgency 1 to 5 from the deadline alone. */
export function baseUrgency(deadline: string | null, today: string): number {
  if (!deadline) return 1;
  const days = diffDays(today, deadline);
  if (days <= 1) return 5;
  if (days <= 3) return 4;
  if (days <= 7) return 3;
  if (days <= 14) return 2;
  return 1;
}

/** Urgency with the deferral bonus: +1 per deferral, at most +2, never above 5. */
export function urgency(task: Pick<Task, 'deadline' | 'deferralCount'>, today: string): number {
  return Math.min(5, baseUrgency(task.deadline, today) + Math.min(2, Math.max(0, task.deferralCount)));
}

/** Priority score = 2 x importance + urgency. */
export function priorityScore(task: Pick<Task, 'importance' | 'deadline' | 'deferralCount'>, today: string): number {
  return 2 * task.importance + urgency(task, today);
}

/** A School task due within 7 days. These outrank every Side Hustle Summit task. */
export function isSchoolUrgent(task: Pick<Task, 'journey' | 'deadline'>, today: string): boolean {
  return task.journey === 'school' && task.deadline !== null && diffDays(today, task.deadline) <= RULES.examWindowDays;
}

function comparator(today: string, withDeferral: boolean) {
  const score = (t: Task) => (withDeferral ? priorityScore(t, today) : 2 * t.importance + baseUrgency(t.deadline, today));
  return (a: Task, b: Task): number => {
    const tier = Number(!isSchoolUrgent(a, today)) - Number(!isSchoolUrgent(b, today));
    if (tier !== 0) return tier;
    const s = score(b) - score(a);
    if (s !== 0) return s;
    if (a.deadline !== b.deadline) {
      if (a.deadline === null) return 1;
      if (b.deadline === null) return -1;
      return a.deadline < b.deadline ? -1 : 1;
    }
    if (a.importance !== b.importance) return b.importance - a.importance;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  };
}

/** Tasks sorted highest priority first. Deterministic: ties break on deadline, importance, then id. */
export function rankTasks(tasks: Task[], today: string): Task[] {
  return [...tasks].sort(comparator(today, true));
}

/** Importance at or below this is "low": it cannot enter the Big 3 through deferral alone. */
export const LOW_IMPORTANCE = 2;

/**
 * Pick the Big 3. Locked ids stay (in order). Empty slots are filled with the highest ranked tasks.
 * A low-importance task is only eligible if it would make the Big 3 without its deferral bonus.
 * Returns the full list and which ids were suggested (not locked).
 */
export function pickBig3(tasks: Task[], today: string, locked: string[] = []): { ids: string[]; suggested: string[] } {
  const open = new Set(tasks.map((t) => t.id));
  const ids = locked.filter((id) => open.has(id)).slice(0, 3);
  const withoutDeferral = [...tasks].sort(comparator(today, false)).slice(0, 3).map((t) => t.id);
  const suggested: string[] = [];
  for (const t of rankTasks(tasks, today)) {
    if (ids.length >= 3) break;
    if (ids.includes(t.id)) continue;
    if (t.importance <= LOW_IMPORTANCE && !withoutDeferral.includes(t.id)) continue;
    ids.push(t.id);
    suggested.push(t.id);
  }
  return { ids, suggested };
}

/** The decision screen shows after this many deferrals. */
export const DECISION_AFTER_DEFERRALS = 3;
export const needsDecision = (task: Pick<Task, 'deferralCount'>): boolean => task.deferralCount >= DECISION_AFTER_DEFERRALS;
