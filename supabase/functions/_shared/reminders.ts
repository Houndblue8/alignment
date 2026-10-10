// Which reminders are due today (Appendix E 4). Pure: shared by the send-due Edge Function and by the app's
// in-app fallback, so both always agree. Times are minutes from local (America/Los_Angeles) midnight.

export interface ReminderPrefs {
  photo?: boolean;
  /** A ping when an open window of 30 minutes or more starts. */
  open?: boolean;
  morning: boolean;
  evening: boolean;
  bedtime: boolean;
  blocks: boolean;
}

export interface ReminderBlock {
  id: string;
  start: number;
  end: number;
  kind: string;
  title: string;
  status: string;
  source?: string;
  pinned?: boolean;
  taskId?: string | null;
  placeId?: string | null;
}

export interface ReminderInput {
  date: string;
  prefs: ReminderPrefs;
  /** Last night's recommended wake, or the wake target. */
  expectedWakeMin: number;
  checkinDone: boolean;
  anchorsDone: boolean;
  bedMin: number | null;
  blocks: ReminderBlock[];
  /** The photo can be taken any time; the reminder goes out at this time if today has none yet. */
  photoMin?: number;
  photoTaken?: boolean;
  /** Today's Big 3 task ids (open-time suggestions name them first). */
  big3?: string[];
}

export interface Reminder {
  /** Unique per day: the sender logs it so it goes out once. */
  key: string;
  kind: 'morning' | 'photo' | 'evening' | 'bedtime' | 'block' | 'open';
  dueMin: number;
  title: string;
  body: string;
  url: string;
}

export function clock(min: number): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m % 60).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

const QUIET = new Set(['travel', 'bed', 'winddown', 'anchor_cold_shower', 'anchor_walk', 'buffer']);

export function remindersFor(r: ReminderInput): Reminder[] {
  const out: Reminder[] = [];
  if (r.prefs.morning && !(r.checkinDone && r.anchorsDone)) {
    out.push({
      key: `${r.date}:morning`,
      kind: 'morning',
      dueMin: r.expectedWakeMin,
      title: 'Good morning',
      body: 'Cold shower, then the walk with God. Check in and the day builds itself around your Big 3.',
      url: '/',
    });
  }
  if (r.prefs.photo && !r.photoTaken && r.photoMin !== undefined) {
    out.push({
      key: `${r.date}:photo`,
      kind: 'photo',
      dueMin: r.photoMin,
      title: "Today's photo",
      body: 'One photo and one line. Whenever the moment is right.',
      url: '/?photo=1',
    });
  }
  const winddown = r.blocks.find((b) => b.kind === 'winddown');
  if (r.prefs.evening && (winddown || r.bedMin !== null)) {
    // Sunday's close-out also closes the week: the scouting report opens on Home.
    const sunday = new Date(`${r.date}T12:00:00Z`).getUTCDay() === 0;
    const body = r.photoTaken === false ? "Check off what got done. Today's photo is still open." : 'Check off what got done.';
    out.push({
      key: `${r.date}:evening`,
      kind: 'evening',
      dueMin: winddown ? winddown.start : r.bedMin! - 60,
      title: sunday ? 'Close the week' : 'Close the day',
      body: sunday ? `${body} Then your scouting report is ready on Home.` : body,
      url: '/today',
    });
  }
  if (r.prefs.bedtime && r.bedMin !== null && r.bedMin < 1440) {
    out.push({
      key: `${r.date}:bedtime`,
      kind: 'bedtime',
      dueMin: r.bedMin,
      title: 'Bedtime',
      body: `Bed by ${clock(r.bedMin)} protects tomorrow. Phone down.`,
      url: '/',
    });
  }
  if (r.prefs.open) {
    const wake = r.blocks.find((b) => b.kind === 'anchor_cold_shower')?.start ?? r.expectedWakeMin;
    for (const w of openWindows(r.blocks, wake, winddown?.start ?? r.bedMin ?? 1440)) {
      if (w.end - w.start < OPEN_PING_MIN || !w.uses.length) continue;
      const names = w.uses.slice(0, 2).map((u) => (r.big3?.includes(u.taskId ?? '') ? `${u.title} (Big 3)` : u.title));
      out.push({
        key: `${r.date}:open:${w.start}`,
        kind: 'open',
        dueMin: w.start,
        title: `Open time: ${span(w.end - w.start)}`,
        body: `Until ${clock(w.end)}. Best use: ${names.join(', then ')}.`,
        url: `/today#open-${w.start}`,
      });
    }
  }
  if (r.prefs.blocks) {
    for (const b of r.blocks) {
      if (QUIET.has(b.kind) || b.status === 'done' || b.status === 'skipped') continue;
      out.push({
        key: `${r.date}:block:${b.id}`,
        kind: 'block',
        dueMin: b.start - 5,
        title: b.title,
        body: `Starts at ${clock(b.start)}.`,
        url: `/today#${encodeURIComponent(b.id)}`,
      });
    }
  }
  return out.sort((a, b) => a.dueMin - b.dueMin || a.key.localeCompare(b.key));
}

/** Open windows long enough to ping about. */
export const OPEN_PING_MIN = 30;

const span = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}` : `${m}m`);

/** Things with a real time: they shape the day. Everything else floats in open time. */
const SET_KINDS = new Set(['anchor_cold_shower', 'anchor_walk', 'breakfast', 'class', 'event', 'practice', 'workout', 'shower', 'winddown', 'bed']);
/** What the planner suggests for open time (shown as the best use, never as a fixed time). */
const FLEX_KINDS = new Set(['work', 'library_work', 'shs_floor', 'misc', 'meal']);

export const isSetBlock = (b: ReminderBlock): boolean => SET_KINDS.has(b.kind) || b.source === 'manual' || !!b.pinned;

/** The blocks that keep a time on the schedule. A drive counts when it leads to something set. */
export function setBlocks<T extends ReminderBlock>(blocks: T[]): T[] {
  const sorted = [...blocks].sort((a, b) => a.start - b.start || a.end - b.end);
  return sorted.filter((b) => {
    if (b.kind !== 'travel') return isSetBlock(b);
    // A drive stays when it takes Eli to something set there, before the next drive.
    const after = sorted.filter((x) => x.start >= b.end - 1);
    const nextDrive = after.find((x) => x.kind === 'travel' && x !== b);
    const until = nextDrive ? nextDrive.start : Infinity;
    return after.some((x) => x.kind !== 'travel' && x.start < until && isSetBlock(x) && (x.placeId ?? 'home') === (b.placeId ?? 'home'));
  });
}

export interface OpenWindow {
  start: number;
  end: number;
  /** The planner's picks for this time, in its order: Big 3 work first, then urgent work, the floor, a meal, misc. */
  uses: { id: string; title: string; kind: string; taskId: string | null; done: boolean }[];
}

/**
 * The gaps between things with a set time, from `from` to `until`. Drives to set things count as set;
 * drives to planner work do not. Gaps under 15 minutes are not open time.
 */
export function openWindows(blocks: ReminderBlock[], from: number, until: number, minLen = 15): OpenWindow[] {
  const sorted = [...blocks].sort((a, b) => a.start - b.start || a.end - b.end);
  const set = setBlocks(sorted);
  const out: OpenWindow[] = [];
  let cursor = from;
  const push = (end: number) => {
    if (end - cursor >= minLen) {
      const s0 = cursor;
      const uses = sorted
        .filter((b) => FLEX_KINDS.has(b.kind) && !isSetBlock(b) && b.start < end && b.end > s0 && b.status !== 'skipped')
        .sort((a, b) => order(a) - order(b) || a.start - b.start)
        .map((b) => ({ id: b.id, title: b.kind === 'meal' ? `${b.title} (whenever it fits)` : b.kind === 'misc' && b.title === 'Misc' ? 'Errands and catch-up' : b.title, kind: b.kind, taskId: b.taskId ?? null, done: b.status === 'done' }));
      out.push({ start: s0, end, uses: dedupe(uses) });
    }
  };
  for (const b of set) {
    if (b.end <= cursor) continue;
    if (b.start >= until) break;
    if (b.start > cursor) push(Math.min(b.start, until));
    cursor = Math.max(cursor, b.end);
  }
  if (cursor < until) push(until);
  return out;
}

/** Work first (the planner already put the Big 3 first), then the floor, then a meal, then misc. */
function order(b: ReminderBlock): number {
  return b.kind === 'work' || b.kind === 'library_work' ? 0 : b.kind === 'shs_floor' ? 1 : b.kind === 'meal' ? 2 : 3;
}

/** One line per task: a task split into two chunks in the same window is one use. */
function dedupe(uses: OpenWindow['uses']): OpenWindow['uses'] {
  const seen = new Set<string>();
  return uses.filter((u) => {
    const k = u.taskId ?? u.title;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Reminders whose time has come within the last `windowMin` minutes. */
export function dueNow(list: Reminder[], nowMin: number, windowMin = 3): Reminder[] {
  return list.filter((x) => x.dueMin <= nowMin && x.dueMin > nowMin - windowMin);
}
