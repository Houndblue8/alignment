// Intention notes on the Big 3 (Eli, Oct 16): one short line that says what the item is really for.
// Pure: the prompt that fits each item.
import type { TaskRow } from '../data/model';
import { tokens } from '../planner';

const has = (t: Pick<TaskRow, 'title'>, words: string[]) => tokens(t.title).some((w) => words.includes(w));

export function intentionPrompt(t: Pick<TaskRow, 'title' | 'journey'>): string {
  if (t.journey === 'school') return 'What are you studying for?';
  if (t.journey === 'sport') {
    if (has(t, ['lift', 'lifting', 'weights', 'gym', 'workout', 'field', 'run', 'sprints', 'conditioning'])) return 'What are you targeting?';
    return 'One thing to work on';
  }
  if (t.journey === 'shs') {
    if (has(t, ['outreach', 'dms', 'dm', 'calls', 'call', 'emails', 'leads'])) return 'Your outreach number today';
    return 'What does done look like?';
  }
  if (t.journey === 'faith') return 'One thing to focus on with God';
  if (t.journey === 'life') return 'One person or thing to focus on';
  return 'What does done look like?';
}
