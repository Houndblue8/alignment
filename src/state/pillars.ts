// The building: the anchors are the foundation, the six pillars rise with each step taken toward them, God is
// the roof that never comes down, and the Big 3 are three torches that feed the fire at the center (fire.ts).
// Pure: what counts as a step for each pillar on a day.
import { JOURNEYS, type DayRecord, type Snapshot } from '../data/model';
import type { Now } from '../lib/clock';
import { addDays, tokens, type Block, type Journey, type RankKey } from '../planner';
import { counts, dayOf, isItemDone } from './planning';

export interface Step {
  text: string;
  /** auto: the app saw it happen; logged: Eli added it by hand (index into the day's steps). */
  source: 'auto' | 'logged';
  index?: number;
  /** What this step is, the same across days (an event, a task, the workout), so an edit can be remembered. */
  key: string;
  /** A training session (a workout or a practice). Athletics counts every one of its steps as a session. */
  session?: boolean;
}

const RANK_PILLAR: Partial<Record<RankKey, Journey>> = {
  church: 'faith',
  epic_large: 'faith',
  epic_small: 'faith',
  discipleship: 'faith',
  retreat: 'faith',
  tournament: 'sport',
  club_practice: 'sport',
  flag_football: 'sport',
  workout: 'sport',
  client: 'shs',
  shs: 'shs',
  social: 'life',
};

// 'sport' is Athletics; 'body' is Stewardship (health, chores, errands, productivity, the basics).
const WORDS: [Journey, string[]][] = [
  ['faith', ['epic', 'church', 'bible', 'pray', 'prayer', 'worship', 'discipleship', 'god', 'devotional']],
  ['sport', ['lift', 'lifting', 'gym', 'run', 'workout', 'weights', 'practice', 'volleyball', 'football', 'game', 'tournament', 'scrimmage', 'swim', 'hike', 'shots']],
  ['school', ['study', 'homework', 'exam', 'midterm', 'final', 'library', 'tax', 'accounting', 'essay', 'reading']],
  ['shs', ['outreach', 'client', 'shs', 'hustle', 'summit', 'pitch', 'sales']],
  ['body', ['laundry', 'clean', 'cleaning', 'chores', 'groceries', 'grocery', 'errand', 'errands', 'dentist', 'doctor', 'bills', 'budget', 'prep', 'cook', 'cooking', 'haircut', 'sleep', 'nap', 'stretch']],
  ['life', ['dinner', 'lunch', 'hangout', 'friends', 'family', 'call', 'coffee', 'social', 'party', 'community']],
];

/** Which pillar a free-text title belongs to (manual blocks), if any. */
export function pillarFromTitle(title: string): Journey | null {
  const t = tokens(title);
  for (const [p, words] of WORDS) if (t.some((w) => words.includes(w))) return p;
  return null;
}

/** The pillar an event block counts toward (Epic, church: Faith), if any. */
export function eventPillar(s: Snapshot, b: Block): Journey | null {
  const def = b.eventId ? s.events.find((e) => e.id === b.eventId) : undefined;
  return (def && RANK_PILLAR[def.rankKey]) ?? pillarFromTitle(b.title);
}

/** A block that stands for a task without being work time (the workout for "Lift"). */
const isLinked = (b: Block) => !!b.taskId && b.kind !== 'work' && b.kind !== 'library_work';

/**
 * Steps toward each pillar on a day.
 * - Showing up counts once it ends, unless skipped: practices and workouts (Athletics sessions), events like Epic
 *   and church, and blocks Eli added. Classes never count: studying does, not sitting in class.
 * - Effort counts when checked: Big 3 items, tasks finished that day, the Side Hustle Summit floor, work and
 *   library time, misc and catch-up time (Stewardship), and the anchors (cold shower: Stewardship; walk: Faith).
 * - A Big 3 item that is a block on the schedule counts once, under the Big 3 name.
 * - Then Eli's edits: one for today, or a rule he chose to always apply (move to another pillar, or never count).
 * - Plus what he logged by hand.
 */
export function pillarSteps(s: Snapshot, date: string, now: Now): Record<Journey, Step[]> {
  const out = Object.fromEntries(JOURNEYS.map((j) => [j.id, [] as Step[]])) as Record<Journey, Step[]>;
  const rec: DayRecord = dayOf(s, date);
  const edits = new Map((s.settings.pillarRules ?? []).map((r) => [r.key, r.pillar] as const));
  for (const e of rec.stepEdits ?? []) edits.set(e.key, e.pillar);
  const seen = new Set<string>();
  const add = (pillar: Journey | null, step: Omit<Step, 'source'>) => {
    if (!pillar || seen.has(step.key)) return;
    seen.add(step.key);
    const to = edits.has(step.key) ? edits.get(step.key)! : pillar;
    if (to) out[to].push({ ...step, source: 'auto' });
  };
  const task = (id: string | null) => (id ? s.tasks.find((x) => x.id === id) : undefined);

  if (rec.water?.done) add('body', { key: 'anchor:water', text: 'Glass of water' });
  if (rec.coldShower.done) add('body', { key: 'anchor:cold_shower', text: 'Cold shower' });
  if (rec.walk.done) add('faith', { key: 'anchor:walk', text: 'Walk with God' });
  for (const i of rec.big3) {
    const t = task(i.taskId);
    if (t && isItemDone(s, i)) add(t.journey, { key: `task:${t.id}`, text: t.title });
  }
  for (const t of s.tasks) {
    if (t.status === 'done' && t.completedAt && localDate(t.completedAt) === date) add(t.journey, { key: `task:${t.id}`, text: t.title });
  }
  const ended = (b: Block) => date < now.date || (date === now.date && b.end <= now.min);
  const happened = (b: Block) => b.status === 'done' || (b.status !== 'skipped' && ended(b));
  for (const b of s.blocks) {
    if (b.date !== date || b.status === 'skipped') continue;
    const t = isLinked(b) || b.kind === 'work' || b.kind === 'library_work' ? task(b.taskId) : undefined;
    const session = b.kind === 'workout' || b.kind === 'practice';
    if (t && isLinked(b)) {
      // The Big 3 item (or task) this block is: one step, under the task's name.
      if (happened(b)) add(t.journey, { key: `task:${t.id}`, text: t.title, session });
      continue;
    }
    if (session) {
      if (happened(b)) add('sport', { key: b.eventId ? `event:${b.eventId}` : `kind:${b.kind}`, text: b.title, session: true });
      continue;
    }
    if (b.kind === 'event') {
      if (!happened(b)) continue;
      add(eventPillar(s, b), { key: b.eventId ? `event:${b.eventId}` : `title:${tokens(b.title).join(' ')}`, text: b.title });
      continue;
    }
    if (b.status !== 'done' && !(b.source === 'manual' && happened(b))) continue;
    if (t) add(t.journey, { key: `task:${t.id}`, text: t.title });
    else if (b.kind === 'shs_floor') add('shs', { key: 'kind:shs_floor', text: b.title });
    else if (b.kind === 'library_work') add('school', { key: 'kind:library_work', text: b.title });
    else if (b.kind === 'misc' && b.source !== 'manual') add('body', { key: 'kind:misc', text: 'Errands and catch-up' });
    else if (b.source === 'manual' || b.kind === 'work') add(pillarFromTitle(b.title), { key: `title:${tokens(b.title).join(' ')}`, text: b.title });
  }
  (rec.steps ?? []).forEach((st, index) => out[st.pillar].push({ text: st.text, source: 'logged', index, key: `logged:${index}` }));
  return out;
}

/** America/Los_Angeles calendar date of an ISO timestamp. */
function localDate(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
}

/** For each pillar: did it rise on each of the last 7 days (oldest first), and on how many of the last 30. */
export function pillarHistory(s: Snapshot, now: Now): Record<Journey, { week: boolean[]; last30: number }> {
  const days = Array.from({ length: 30 }, (_, i) => addDays(now.date, i - 29));
  const steps = days.map((d) => (counts(s, d) ? pillarSteps(s, d, now) : null));
  return Object.fromEntries(
    JOURNEYS.map((j) => {
      const rose = steps.map((st) => !!st && st[j.id].length > 0);
      return [j.id, { week: rose.slice(-7), last30: rose.filter(Boolean).length }];
    }),
  ) as Record<Journey, { week: boolean[]; last30: number }>;
}
