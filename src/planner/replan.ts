// replan(now): keep what happened or was placed by hand, rebuild the rest. No AI, no network.
import { planDay } from './planDay';
import { ceil5 } from './time';
import type { Block, BlockKind, DayInput, DayPlan } from './types';

/** Past planned blocks of these kinds are dropped (not kept as history) so they are planned again. */
const REPLAN_IF_MISSED: BlockKind[] = ['work', 'library_work', 'anchor_cold_shower', 'anchor_walk', 'shs_floor', 'workout', 'shower', 'travel'];

export function keptForReplan(existing: Block[], cutoff: number): Block[] {
  return existing.filter((b) => {
    if (b.kind === 'travel') return false;
    if (b.status === 'done' || b.status === 'in_progress' || b.pinned || b.source === 'manual') return true;
    return b.end <= cutoff && !REPLAN_IF_MISSED.includes(b.kind);
  });
}

export function replan(input: Omit<DayInput, 'pinned' | 'now'> & { existing: Block[] }, now: number): DayPlan {
  const cutoff = ceil5(now);
  const { existing, ...rest } = input;
  return planDay({ ...rest, now: cutoff, pinned: keptForReplan(existing, cutoff) });
}
