// Same thing, different words: matching task titles to each other and to what is already on the day.
// Pure and deterministic. Used to stop duplicate tasks, and to let a Big 3 item be something already
// planned (the workout, dinner, an event) instead of a second block for the same thing.
import type { Block, BlockKind } from './types';

const STOP = new Set(['a', 'an', 'the', 'and', 'with', 'at', 'to', 'for', 'of', 'my', 'in', 'on', 'go', 'do', 'get', 'some', 'time', 'today', 'tonight']);

export function tokens(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((w) => w && !STOP.has(w));
}

/** Plural and simple verb endings: "workshops" = "workshop", "lifting" = "lift". */
function stem(w: string): string {
  if (w.length > 5 && w.endsWith('ing')) return w.slice(0, -3);
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}

/** Edit distance, capped (only small distances matter here). */
function distance(a: string, b: string, cap = 3): number {
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
      best = Math.min(best, cur[j]!);
    }
    if (best > cap) return cap + 1;
    prev = cur;
  }
  return prev[b.length]!;
}

/** "dship" is short for "discipleship": same first letter, letters in order, at least half the length. */
function abbreviates(short: string, long: string): boolean {
  if (short.length < 3 || short[0] !== long[0] || short.length < long.length * 0.5) return false;
  let i = 0;
  for (const c of long) if (c === short[i]) i += 1;
  return i === short.length;
}

function wordsMatch(a: string, b: string): boolean {
  const x = stem(a);
  const y = stem(b);
  if (x === y) return true;
  if (Math.min(x.length, y.length) >= 4 && (x.startsWith(y) || y.startsWith(x))) return true;
  return Math.min(x.length, y.length) >= 5 && distance(x, y, 1) <= 1;
}

/**
 * True when two titles name the same thing: a typo or one letter apart ("Lift" / "Lifts"),
 * the same words in another order or with extras ("Intentional dinner" / "Dinner and intentional hangout"),
 * or an abbreviation ("D Ship Workshop" / "Discipleship workshop").
 */
export function sameThing(a: string, b: string): boolean {
  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.length || !tb.length) return false;
  const ja = ta.join('');
  const jb = tb.join('');
  if (ja === jb || ta.map(stem).join('') === tb.map(stem).join('')) return true;
  const longer = Math.max(ja.length, jb.length);
  if (longer >= 6 && distance(ja, jb, 2) <= (longer >= 12 ? 2 : 1)) return true;
  const [short, long] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  // Every word of the shorter title appears in the longer one (needs two real words, so "Tax" never
  // swallows "Tax class").
  if (short.length >= 2 && short.every((w) => long.some((v) => wordsMatch(w, v)))) return true;
  const [js, jl] = ja.length <= jb.length ? [ja, jb] : [jb, ja];
  return abbreviates(js, jl) && short.length >= 2;
}

const WORKOUT_WORDS = ['lift', 'lifting', 'weights', 'weight', 'workout', 'gym', 'train', 'training', 'run', 'running', 'field', 'sprints', 'conditioning', 'rec'];
const MEALS: Record<'breakfast' | 'lunch' | 'dinner', string[]> = {
  breakfast: ['breakfast', 'brunch'],
  lunch: ['lunch', 'brunch'],
  dinner: ['dinner', 'supper'],
};

/** Which meal a title is about, if any. */
export function mealIn(title: string): 'breakfast' | 'lunch' | 'dinner' | null {
  const t = tokens(title);
  for (const m of ['dinner', 'lunch', 'breakfast'] as const) if (t.some((w) => MEALS[m].includes(w))) return m;
  return null;
}

const isWorkoutTitle = (title: string) => tokens(title).some((w) => WORKOUT_WORDS.includes(w));

/** Blocks a task can be linked to: things that happen anyway. Planner work blocks, travel and the night are not. */
const LINKABLE: BlockKind[] = ['event', 'practice', 'class', 'workout', 'meal', 'breakfast', 'shs_floor', 'misc', 'library_work', 'work'];

/**
 * The block on this day that already is this task, if any. Manual blocks and events win over planner
 * blocks; within a kind, the earliest. A block that belongs to another task is skipped.
 */
export function linkTarget(title: string, blocks: readonly Block[], taken: Set<string> = new Set(), taskId: string | null = null): Block | null {
  const meal = mealIn(title);
  const workout = isWorkoutTitle(title);
  const candidates = blocks.filter(
    (b) =>
      LINKABLE.includes(b.kind) &&
      !taken.has(b.id) &&
      // Planner work, library and misc blocks are never targets; manual ones are.
      !((b.kind === 'work' || b.kind === 'library_work' || b.kind === 'misc') && b.source !== 'manual') &&
      // Already another task's block (a block linked to this same task stays its target across replans).
      !(b.taskId && b.taskId !== taskId),
  );
  const score = (b: Block): number => {
    if (sameThing(title, b.title)) return 3;
    if (workout && b.kind === 'workout') return 2;
    if (meal && (mealIn(b.title) === meal || (b.kind === 'meal' && b.id.endsWith(`:${meal}`)) || (meal === 'breakfast' && b.kind === 'breakfast'))) return 2;
    if (tokens(title).some((w) => w === 'outreach' || w === 'shs' || w === 'dms') && b.kind === 'shs_floor') return 2;
    return 0;
  };
  const rank = (b: Block) => score(b) * 10 + (b.source === 'manual' || b.kind === 'event' ? 1 : 0);
  return (
    candidates
      .filter((b) => score(b) > 0)
      .sort((a, b) => rank(b) - rank(a) || a.start - b.start || (a.id < b.id ? -1 : 1))[0] ?? null
  );
}
