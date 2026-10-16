// App data model (camelCase). The database uses snake_case; supabaseRepo maps between them.
import type { AnchorStatus, BelowTheLine, Bedtime, Block, CodeRedLevel, EventDef, Journey, Place, Task } from '../planner';

export type QuoteTag = 'regret' | 'hard_day' | 'win' | 'general';
export type DayResult = 'win' | 'half' | 'loss';
export type TaskStatus = 'open' | 'done' | 'dropped' | 'delegated';

export interface Settings {
  theme: string;
  outreachCount: number;
  wakeTargetMin: number;
  sleepHours: number;
  latestWakeMin: number;
  practiceBlock: 'A' | 'B';
  codeRed: boolean;
  codeRedLevel: CodeRedLevel;
  graduationDate: string | null;
  lastOpenDate: string | null;
  notifyMorning: boolean;
  notifyEvening: boolean;
  notifyBedtime: boolean;
  notifyBlocks: boolean;
  notifyPhoto: boolean;
  /** When the photo reminder goes out (minutes from midnight). The photo itself can be taken any time. */
  photoReminderMin: number;
  /** The photo reminder at a surprise time each day (10 AM to 8 PM) instead of photoReminderMin. */
  photoRandom: boolean;
  /** Stats count from this day on (season, streaks, the fire, temples, reports). Earlier days stay saved. */
  statsFrom: string | null;
  /** A notification when an open window of 30 minutes or more starts. */
  notifyOpen: boolean;
  /** Weekly temple targets per pillar (editable). Athletics counts sessions; the others count days. */
  weeklyTargets: WeeklyTargets;
  /** Pillar edits Eli chose to always apply: move an item to another pillar, or never count it (null). */
  pillarRules: PillarRule[];
}

export interface PillarRule {
  /** What the item is, the same across days (event:..., task:..., kind:..., title:...). */
  key: string;
  pillar: Journey | null;
  /** The name it had when the rule was made, to show in Settings. */
  label: string;
}

export type WeeklyTargets = Record<Journey, number | null>;

export const DEFAULT_TARGETS: WeeklyTargets = { faith: 7, body: 5, sport: 8, school: 5, shs: 6, life: 3 };

export interface Vision {
  identity: string;
  why: string;
  whyShort: string;
  endResult: string;
  perfectDay: string;
  bestVersion: Record<Journey, string>;
}

export interface Contract {
  terms: string[];
  /** Locked contracts can be read but not edited. */
  locked: boolean;
  signedName: string | null;
  signedAt: string | null;
  graduationDate: string | null;
  profitTarget: number;
  firstMilestone: number;
  profitEarned: number;
}

export interface TaskRow extends Task {
  status: TaskStatus;
  notes: string;
  completedAt: string | null;
}

export interface Big3Item {
  taskId: string;
  /** Picked by Eli: never replaced by the automatic pick. */
  locked: boolean;
  /** An automatic suggestion Eli tapped to accept. */
  accepted: boolean;
  /** Checked off for this day only, late (closing out a past day). Unset: the task's own status counts. */
  done?: boolean;
}

export interface PlanMeta {
  warnings: string[];
  notes: string[];
  bedtime: Bedtime | null;
  belowTheLine: BelowTheLine[];
  /** Block ids Eli took off the plan (talk box). Kept across replans. */
  suppressed?: string[];
}

export interface DayRecord {
  date: string;
  wakeMin: number | null;
  checkinDone: boolean;
  coldShower: AnchorStatus;
  walk: AnchorStatus;
  /** The third morning anchor (Oct 16): a glass of water. Required for a Win from WATER_FROM on. */
  water: AnchorStatus;
  big3: Big3Item[];
  result: DayResult | null;
  lostDay: boolean;
  lostDayReason: string | null;
  /** A Lost Day's one faith focus (Oct 16). The original Big 3 waits here in case the Lost Day is ended. */
  lostFocus?: LostFocus | null;
  codeRed: boolean;
  notes: string;
  plan: PlanMeta;
  isaacAnswer: 'yes' | 'no' | null;
  /** Small steps Eli logged by hand toward a pillar ("Texted Josh", "Read Romans 8"). */
  steps?: PillarStep[];
  /** One thing to do 1% better tomorrow, written this day and shown the next morning. */
  kaizen?: string | null;
  /** Pillar edits for this day only (same shape as the rules). */
  stepEdits?: { key: string; pillar: Journey | null }[];
  /** The night tap: pillars Eli showed up for that the app could not see. */
  showedUp?: Journey[];
  /** The night check: Mind, Heart, Spirit, 1 to 5, and an optional line. */
  inner?: { mind: number; heart: number; spirit: number; note?: string; closer?: boolean } | null;
}

export interface LostFocus {
  text: string;
  done: boolean;
  /** Before bed: how he surrendered the day to God. */
  surrender?: string;
  big3: Big3Item[];
}

/** The glass of water became the third anchor on this day; earlier days are scored without it. */
export const WATER_FROM = '2026-10-17';

export interface PillarStep {
  pillar: Journey;
  text: string;
}

export interface Quote {
  id: string;
  text: string;
  tags: QuoteTag[];
}

/** One photo per day (Appendix E 1). */
export interface PhotoRow {
  date: string;
  storagePath: string;
  caption: string;
  milestone: boolean;
}

export interface Snapshot {
  settings: Settings;
  vision: Vision;
  contract: Contract;
  places: Place[];
  events: EventDef[];
  tasks: TaskRow[];
  days: Record<string, DayRecord>;
  blocks: Block[];
  quotes: Quote[];
  photos: PhotoRow[];
}

export const emptyPlan = (): PlanMeta => ({ warnings: [], notes: [], bedtime: null, belowTheLine: [] });

export function emptyDay(date: string): DayRecord {
  return {
    date,
    wakeMin: null,
    checkinDone: false,
    coldShower: { done: false },
    walk: { done: false },
    water: { done: false },
    big3: [],
    result: null,
    lostDay: false,
    lostDayReason: null,
    codeRed: false,
    notes: '',
    plan: emptyPlan(),
    isaacAnswer: null,
    steps: [],
    kaizen: null,
    inner: null,
    showedUp: [],
  };
}

/** The six pillars (journeys in the code). Order is the order they stand in the building. */
export const JOURNEYS: { id: Journey; label: string }[] = [
  { id: 'faith', label: 'Faith and Epic' },
  { id: 'sport', label: 'Athletics' },
  { id: 'body', label: 'Stewardship' },
  { id: 'school', label: 'Academics' },
  { id: 'shs', label: 'Side Hustle' },
  { id: 'life', label: 'Social and Community' },
];

export const journeyLabel = (j: Journey): string => JOURNEYS.find((x) => x.id === j)?.label ?? j;
