// The building: the anchors are the foundation, the six pillars rise with each step taken toward them,
// and the Big 3 is the roof. Pure: what counts as a step for each pillar on a day.
import { JOURNEYS, type DayRecord, type Snapshot } from '../data/model';
import type { Now } from '../lib/clock';
import { addDays, tokens, type Block, type Journey, type RankKey } from '../planner';
import { dayOf, isItemDone } from './planning';

export interface Step {
  text: string;
  /** auto: the app saw it happen; logged: Eli added it by hand (index into the day's steps). */
  source: 'auto' | 'logged';
  index?: number;
}

const RANK_PILLAR: Partial<Record<RankKey, Journey>> = {
  school: 'school',
  church: 'faith',
  epic_large: 'faith',
  epic_small: 'faith',
  discipleship: 'faith',
  retreat: 'faith',
  tournament: 'sport',
  club_practice: 'sport',
  flag_football: 'sport',
  client: 'shs',
  shs: 'shs',
  workout: 'body',
  social: 'life',
};

const WORDS: [Journey, string[]][] = [
  ['faith', ['epic', 'church', 'bible', 'pray', 'prayer', 'worship', 'discipleship', 'god', 'devotional']],
  ['school', ['study', 'class', 'homework', 'exam', 'midterm', 'final', 'library', 'tax', 'accounting', 'essay', 'reading']],
  ['body', ['lift', 'gym', 'run', 'workout', 'weights', 'stretch', 'swim', 'hike']],
  ['sport', ['practice', 'volleyball', 'football', 'game', 'tournament', 'scrimmage']],
  ['shs', ['outreach', 'client', 'shs', 'hustle', 'summit', 'pitch', 'sales']],
  ['life', ['dinner', 'lunch', 'hangout', 'friends', 'family', 'call', 'coffee', 'social', 'party', 'community']],
];

/** Which pillar a free-text title belongs to (manual blocks), if any. */
export function pillarFromTitle(title: string): Journey | null {
  const t = tokens(title);
  for (const [p, words] of WORDS) if (t.some((w) => words.includes(w))) return p;
  return null;
}

const SHOW_UP: Block['kind'][] = ['class', 'practice', 'event'];
const NEVER: Block['kind'][] = ['travel', 'bed', 'winddown', 'anchor_cold_shower', 'anchor_walk', 'buffer', 'shower', 'breakfast'];

function blockPillar(s: Snapshot, b: Block): Journey | null {
  if (b.taskId) {
    const t = s.tasks.find((x) => x.id === b.taskId);
    if (t) return t.journey;
  }
  if (b.eventId) {
    const def = s.events.find((e) => e.id === b.eventId);
    const p = def ? RANK_PILLAR[def.rankKey] : undefined;
    if (p) return p;
  }
  switch (b.kind) {
    case 'workout':
      return 'body';
    case 'practice':
      return 'sport';
    case 'class':
    case 'library_work':
      return 'school';
    case 'shs_floor':
      return 'shs';
    default:
      return pillarFromTitle(b.title);
  }
}

/**
 * Steps toward each pillar on a day. Showing up counts: classes, practices, events and blocks Eli added
 * count once they end unless he skipped them. Effort counts when checked: the workout, the Side Hustle
 * Summit floor, work blocks, Big 3 items, finished tasks, the anchors. Plus what he logged by hand.
 */
export function pillarSteps(s: Snapshot, date: string, now: Now): Record<Journey, Step[]> {
  const out = Object.fromEntries(JOURNEYS.map((j) => [j.id, [] as Step[]])) as Record<Journey, Step[]>;
  const seen = new Set<string>();
  const add = (p: Journey | null, step: Step) => {
    if (!p) return;
    const key = `${p}:${step.text.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    out[p].push(step);
  };
  const rec: DayRecord = dayOf(s, date);
  if (rec.coldShower.done) add('body', { text: 'Cold shower', source: 'auto' });
  if (rec.walk.done) add('faith', { text: 'Walk with God', source: 'auto' });
  for (const i of rec.big3) {
    const t = s.tasks.find((x) => x.id === i.taskId);
    if (t && isItemDone(s, i)) add(t.journey, { text: t.title, source: 'auto' });
  }
  for (const t of s.tasks) {
    if (t.status === 'done' && t.completedAt && localDate(t.completedAt) === date) add(t.journey, { text: t.title, source: 'auto' });
  }
  const ended = (b: Block) => date < now.date || (date === now.date && b.end <= now.min);
  for (const b of s.blocks) {
    if (b.date !== date || NEVER.includes(b.kind) || b.status === 'skipped') continue;
    const counts = b.status === 'done' || ((SHOW_UP.includes(b.kind) || b.source === 'manual') && ended(b));
    if (counts) add(blockPillar(s, b), { text: b.title, source: 'auto' });
  }
  (rec.steps ?? []).forEach((st, index) => add(st.pillar, { text: st.text, source: 'logged', index }));
  return out;
}

/** America/Los_Angeles calendar date of an ISO timestamp. */
function localDate(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
}

/** For each pillar: did it rise on each of the last 7 days (oldest first), and on how many of the last 30. */
export function pillarHistory(s: Snapshot, now: Now): Record<Journey, { week: boolean[]; last30: number }> {
  const days = Array.from({ length: 30 }, (_, i) => addDays(now.date, i - 29));
  const steps = days.map((d) => pillarSteps(s, d, now));
  return Object.fromEntries(
    JOURNEYS.map((j) => {
      const rose = steps.map((st) => st[j.id].length > 0);
      return [j.id, { week: rose.slice(-7), last30: rose.filter(Boolean).length }];
    }),
  ) as Record<Journey, { week: boolean[]; last30: number }>;
}

export interface BuildingState {
  foundation: { coldShower: boolean; walk: boolean };
  pillars: { id: Journey; label: string; steps: number }[];
  roof: { done: number; total: number };
  complete: boolean;
}

export function buildingFor(s: Snapshot, date: string, now: Now): BuildingState {
  const rec = dayOf(s, date);
  const steps = pillarSteps(s, date, now);
  const done = rec.big3.filter((i) => isItemDone(s, i)).length;
  const foundation = { coldShower: rec.coldShower.done, walk: rec.walk.done };
  return {
    foundation,
    pillars: JOURNEYS.map((j) => ({ id: j.id, label: j.label, steps: steps[j.id].length })),
    roof: { done, total: rec.big3.length },
    complete: foundation.coldShower && foundation.walk && rec.big3.length > 0 && done === rec.big3.length,
  };
}

/** One line under the building, in the coach voice. */
export function buildingLine(b: BuildingState): string {
  const risen = b.pillars.filter((p) => p.steps > 0).length;
  const pillars = `${risen} of 6 pillars rose today.`;
  if (b.complete) return `The building stands. That day is a Win. ${pillars}`;
  if (!b.foundation.coldShower && !b.foundation.walk) return 'Lay the foundation first: the cold shower, then the walk.';
  if (!b.foundation.coldShower || !b.foundation.walk) return `Half the foundation is set. Finish it. ${pillars}`;
  if (b.roof.total === 0) return `Foundation laid. Pick your Big 3 to raise the roof. ${pillars}`;
  if (b.roof.done === 0) return `Foundation laid. Now raise the roof: your Big 3. ${pillars}`;
  return `${b.roof.done} of ${b.roof.total} roof beams set. ${pillars}`;
}
