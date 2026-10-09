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
}

export interface Quote {
  id: string;
  text: string;
  tags: QuoteTag[];
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
  };
}

export const JOURNEYS: { id: Journey; label: string }[] = [
  { id: 'body', label: 'Body' },
  { id: 'sport', label: 'Sport' },
  { id: 'shs', label: 'Side Hustle Summit' },
  { id: 'school', label: 'School' },
  { id: 'faith', label: 'Faith and Epic' },
  { id: 'life', label: 'Life and Social' },
];

export const journeyLabel = (j: Journey): string => JOURNEYS.find((x) => x.id === j)?.label ?? j;
