// The urge button (Appendix E 5): bored, avoiding, or tired. Pure picks; the sheet shows them.
import type { Snapshot, TaskRow } from '../data/model';
import { priorityScore } from '../planner';

const FIRST_STEP: Record<string, string> = {
  deep: 'Open it and write one rough sentence. Messy is fine.',
  easy: 'Open it and do the smallest piece you can see.',
  errand: 'Put what you need for it in one place.',
};

/** The first step, written out: the task's own first step, or a starter for its kind of work. */
export const firstStep = (t: TaskRow): string => t.steps?.find((x) => x.text.trim())?.text ?? FIRST_STEP[t.workType] ?? FIRST_STEP.deep!;

const open = (s: Snapshot) => s.tasks.filter((t) => t.status === 'open');

/** Avoiding: the task pushed off most (ties: the most important now), shrunk to a 5 minute start. */
export function avoidingPick(s: Snapshot, today: string): TaskRow | null {
  return open(s).sort((a, b) => b.deferralCount - a.deferralCount || priorityScore(b, today) - priorityScore(a, today) || a.title.localeCompare(b.title))[0] ?? null;
}

/** Tired: the lightest open task (ties: the most important). */
export function lightestPick(s: Snapshot, today: string): TaskRow | null {
  return open(s).sort((a, b) => a.estimatedMinutes - b.estimatedMinutes || priorityScore(b, today) - priorityScore(a, today) || a.title.localeCompare(b.title))[0] ?? null;
}

export type BoredKind = 'photo' | 'season' | 'quote';

/** Bored: a memory photo, the season record, or a quote; each tap shows the next one that exists. */
export function boredKinds(s: Snapshot): BoredKind[] {
  const out: BoredKind[] = [];
  if (s.photos.length) out.push('photo');
  out.push('season');
  if (s.quotes.length) out.push('quote');
  return out;
}
