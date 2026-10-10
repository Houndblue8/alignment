// Which reminders are due today (Appendix E 4). Pure: shared by the send-due Edge Function and by the app's
// in-app fallback, so both always agree. Times are minutes from local (America/Los_Angeles) midnight.

export interface ReminderPrefs {
  photo?: boolean;
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
}

export interface Reminder {
  /** Unique per day: the sender logs it so it goes out once. */
  key: string;
  kind: 'morning' | 'photo' | 'evening' | 'bedtime' | 'block';
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
    out.push({
      key: `${r.date}:evening`,
      kind: 'evening',
      dueMin: winddown ? winddown.start : r.bedMin! - 60,
      title: 'Close the day',
      body: r.photoTaken === false ? "Check off what got done. Today's photo is still open." : 'Check off what got done.',
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

/** Reminders whose time has come within the last `windowMin` minutes. */
export function dueNow(list: Reminder[], nowMin: number, windowMin = 3): Reminder[] {
  return list.filter((x) => x.dueMin <= nowMin && x.dueMin > nowMin - windowMin);
}
