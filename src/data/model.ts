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
}

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
  big3: Big3Item[];
  result: DayResult | null;
  lostDay: boolean;
  lostDayReason: string | null;
  codeRed: boolean;
  notes: string;
  plan: PlanMeta;
  isaacAnswer: 'yes' | 'no' | null;
  /** Small steps Eli logged by hand toward a pillar ("Texted Josh", "Read Romans 8"). */
  steps?: PillarStep[];
  /** One thing to do 1% better tomorrow, written this day and shown the next morning. */
  kaizen?: string | null;
  /** The night check: Mind, Heart, Spirit, 1 to 5, and an optional line. */
  inner?: { mind: number; heart: number; spirit: number; note?: string } | null;
}

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
  };
}

/** The six pillars (journeys in the code). Order is the order they stand in the building. */
export const JOURNEYS: { id: Journey; label: string }[] = [
  { id: 'faith', label: 'Faith and Epic' },
  { id: 'body', label: 'Body' },
  { id: 'sport', label: 'Sports' },
  { id: 'school', label: 'Academics' },
  { id: 'shs', label: 'Side Hustle' },
  { id: 'life', label: 'Social and Community' },
];

export const journeyLabel = (j: Journey): string => JOURNEYS.find((x) => x.id === j)?.label ?? j;
