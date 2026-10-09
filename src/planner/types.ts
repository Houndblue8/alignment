// Planner types. The planner is pure: no network, no database, no clock.
// Dates are local America/Los_Angeles date strings (YYYY-MM-DD).
// Times are minutes from local midnight.

export type Journey = 'body' | 'sport' | 'shs' | 'school' | 'faith' | 'life';
export type WorkType = 'deep' | 'easy' | 'errand';
export type Mode = 'normal' | 'codeRed' | 'lostDay';
export type WorkoutType = 'field' | 'weights';

export type CodeRedLevel = 'standard' | 'severe';

export type RankKey =
  | 'trip'
  | 'church'
  | 'epic_large'
  | 'retreat'
  | 'tournament'
  | 'club_practice'
  | 'flag_football'
  | 'school'
  | 'client'
  | 'shs'
  | 'epic_small'
  | 'workout'
  | 'discipleship'
  | 'social'
  | 'general';

export type EventKind = 'class' | 'exam' | 'practice' | 'event' | 'social';

export type BlockKind =
  | 'anchor_cold_shower'
  | 'anchor_walk'
  | 'shs_floor'
  | 'breakfast'
  | 'meal'
  | 'class'
  | 'event'
  | 'practice'
  | 'library_work'
  | 'work'
  | 'workout'
  | 'shower'
  | 'misc'
  | 'travel'
  | 'buffer'
  | 'winddown'
  | 'bed';

export type BlockStatus = 'planned' | 'in_progress' | 'done' | 'skipped';

export interface Block {
  id: string;
  date: string;
  start: number;
  end: number;
  kind: BlockKind;
  title: string;
  placeId: string | null;
  taskId: string | null;
  eventId: string | null;
  status: BlockStatus;
  pinned: boolean;
  source: 'planner' | 'manual';
  howto: string[] | null;
}

export interface Place {
  id: string;
  name: string;
  notes?: string;
  minutesFromHome: number;
  minutesFromCampus: number;
  goodFor: (WorkType | 'meal')[];
}

/** An event as stored (weekly or one-time). */
export interface EventDef {
  id: string;
  title: string;
  kind: EventKind;
  weekday?: number;
  date?: string;
  endDate?: string;
  start: number;
  end: number;
  location: string;
  rankKey: RankKey;
  immovable: boolean;
  overridableByCodeRed: boolean;
  recurringWeekly: boolean;
  activeFrom?: string;
  activeTo?: string;
  skipDates?: string[];
  practiceBlock?: 'A' | 'B';
  allDay?: boolean;
  noWork?: boolean;
  away?: boolean;
  /** A weekly "maybe" (discipleship with Isaac). Never planned until confirmed for a date as a one-time event. */
  tentative?: boolean;
}

/** An event expanded onto one date. */
export interface EventInstance {
  id: string;
  title: string;
  kind: EventKind;
  start: number;
  end: number;
  location: string;
  rankKey: RankKey;
  rank: number;
  immovable: boolean;
  overridableByCodeRed: boolean;
  allDay: boolean;
  noWork: boolean;
  away: boolean;
  /** Set when a social or discipleship event was moved here from an earlier day. */
  movedFrom?: string;
}

export interface Task {
  id: string;
  title: string;
  journey: Journey;
  importance: number;
  deadline: string | null;
  estimatedMinutes: number;
  deferralCount: number;
  workType: WorkType;
  createdAt: string;
  steps?: { text: string; guess: boolean }[];
}

export interface PlannerSettings {
  wakeTargetMin: number;
  sleepHours: number;
  latestWakeMin: number;
  outreachCount: number;
  practiceBlock: 'A' | 'B';
}

export interface AnchorStatus {
  done: boolean;
  startMin?: number | null;
}

export interface DayInput {
  date: string;
  /** Minutes from midnight. When set, nothing new is planned before ceil5(now). */
  now?: number | null;
  wakeMin: number;
  /** The wake time the plan expected (last night's recommendation). Later than this counts as a late wake. Default: the wake target. */
  expectedWakeMin?: number;
  anchors: { coldShower: AnchorStatus; walk: AnchorStatus };
  events: EventInstance[];
  /** Open tasks. remaining maps task id to minutes still to plan (defaults to estimatedMinutes). */
  tasks: Task[];
  remaining?: Record<string, number>;
  big3: string[];
  places: Place[];
  settings: PlannerSettings;
  mode: Mode;
  /** Only used in Code Red. Standard keeps practices; severe pauses them too. Default standard. */
  codeRedLevel?: CodeRedLevel;
  pinned: Block[];
  workout: WorkoutType | null;
  tomorrowFirst: { start: number; location: string; title: string } | null;
  examWithin7: boolean;
}

export interface Bedtime {
  bedMin: number;
  wakeMin: number;
  targetWakeMin: number;
  sleepMinutes: number;
  warning: string | null;
}

export interface BelowTheLine {
  taskId: string;
  title: string;
  minutes: number;
  reason: string;
}

export interface DayPlan {
  date: string;
  wakeMin: number;
  blocks: Block[];
  belowTheLine: BelowTheLine[];
  warnings: string[];
  notes: string[];
  bedtime: Bedtime;
  /** Minutes still needed per task after this day. */
  remaining: Record<string, number>;
  /** Social or flexible events that did not fit and move to the next day. */
  carryEvents: EventInstance[];
  workoutPlaced: WorkoutType | null;
}
