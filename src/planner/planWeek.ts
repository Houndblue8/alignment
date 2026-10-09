// planWeek: today plus the next 6 days, in order, carrying unfinished tasks and moved events forward.
import { expandEvents, isFlexibleEvent, pausedByCodeRed } from './expand';
import { planDay } from './planDay';
import { pickBig3 } from './priority';
import { RULES, WEEKLY_TARGET, WORKOUT_BY_WEEKDAY } from './rules';
import { addDays, fmtDate, weekday } from './time';
import type {
  AnchorStatus,
  Block,
  CodeRedLevel,
  DayPlan,
  EventDef,
  EventInstance,
  Mode,
  Place,
  PlannerSettings,
  Task,
  WorkoutType,
} from './types';

export interface WeekInput {
  startDate: string;
  now?: number | null;
  today: {
    wakeMin: number;
    anchors: { coldShower: AnchorStatus; walk: AnchorStatus };
    big3: string[];
    mode: Mode;
  };
  /** Code Red stays on for every planned day until switched off. */
  codeRed: boolean;
  codeRedLevel?: CodeRedLevel;
  eventDefs: EventDef[];
  tasks: Task[];
  places: Place[];
  settings: PlannerSettings;
  pinnedByDate?: Record<string, Block[]>;
  /** Workouts already done this week (Monday to Sunday) before startDate. */
  workoutsThisWeek: Record<WorkoutType, number>;
  /** Events moved into startDate from an earlier day. */
  carriedIn?: EventInstance[];
  days?: number;
}

/** Today's default workout, or a catch-up if the rest of the week can't reach the targets. */
export function chooseWorkout(date: string, done: Record<WorkoutType, number>): WorkoutType | null {
  const wd = weekday(date);
  const def = WORKOUT_BY_WEEKDAY[wd] ?? null;
  if (def && done[def] < WEEKLY_TARGET[def]) return def;
  const daysLeft = wd === 0 ? 0 : 7 - wd; // days after today until Sunday
  for (const type of ['weights', 'field'] as WorkoutType[]) {
    const need = WEEKLY_TARGET[type] - done[type];
    let slots = 0;
    for (let i = 1; i <= daysLeft; i++) if (WORKOUT_BY_WEEKDAY[(wd + i) % 7] === type) slots += 1;
    if (need > slots) return type;
  }
  return null;
}

function modeFor(i: number, input: WeekInput): Mode {
  if (i === 0) return input.today.mode;
  return input.codeRed ? 'codeRed' : 'normal';
}

/** The first timed commitment of a day that bedtime has to protect. */
export function firstCommitment(events: EventInstance[], mode: Mode, level: CodeRedLevel = 'standard'): EventInstance | null {
  return (
    events
      .filter((e) => !e.allDay && !isFlexibleEvent(e))
      .filter((e) => (mode === 'codeRed' ? !pausedByCodeRed(e, level) : true))
      .filter((e) => (mode === 'lostDay' ? e.immovable : true))
      .sort((a, b) => a.start - b.start || (a.id < b.id ? -1 : 1))[0] ?? null
  );
}

/** True when an exam falls on date or within the next 7 days. */
export function examWithinWindow(defs: EventDef[], date: string, settings: Pick<PlannerSettings, 'practiceBlock'>): boolean {
  for (let k = 0; k <= RULES.examWindowDays; k++) {
    if (expandEvents(defs, addDays(date, k), settings).some((e) => e.kind === 'exam')) return true;
  }
  return false;
}

export function planWeek(input: WeekInput): DayPlan[] {
  const n = input.days ?? 7;
  const plans: DayPlan[] = [];
  let remaining: Record<string, number> = Object.fromEntries(input.tasks.map((t) => [t.id, t.estimatedMinutes]));
  let carried: EventInstance[] = input.carriedIn ?? [];
  const done = { ...input.workoutsThisWeek };
  let wake = input.today.wakeMin;

  for (let i = 0; i < n; i++) {
    const date = addDays(input.startDate, i);
    const mode = modeFor(i, input);
    const events = [...expandEvents(input.eventDefs, date, input.settings), ...carried];
    const next = expandEvents(input.eventDefs, addDays(date, 1), input.settings);
    const first = firstCommitment(next, modeFor(i + 1, input), input.codeRedLevel);
    const examWithin7 = examWithinWindow(input.eventDefs, date, input.settings);
    const open = input.tasks.filter((t) => (remaining[t.id] ?? 0) > 0);
    const big3 = i === 0 ? input.today.big3 : pickBig3(open, date).ids;

    const plan = planDay({
      date,
      now: i === 0 ? input.now : null,
      wakeMin: wake,
      anchors: i === 0 ? input.today.anchors : { coldShower: { done: false }, walk: { done: false } },
      events,
      tasks: open,
      remaining,
      big3,
      places: input.places,
      settings: input.settings,
      mode,
      codeRedLevel: input.codeRedLevel,
      pinned: input.pinnedByDate?.[date] ?? [],
      workout: chooseWorkout(date, done),
      tomorrowFirst: first ? { start: first.start, location: first.location, title: first.title } : null,
      examWithin7,
    });

    if (plan.workoutPlaced) done[plan.workoutPlaced] += 1;
    if (weekday(date) === 0) {
      done.field = 0;
      done.weights = 0;
    }
    remaining = plan.remaining;
    carried = plan.carryEvents.map((e) => ({ ...e, movedFrom: e.movedFrom ?? date }));
    if (i === n - 1 && carried.length) {
      plan.warnings.push(`Moved past ${fmtDate(date)}: ${carried.map((e) => e.title).join(', ')}. Pick a new time with the talk box.`);
    }
    wake = plan.bedtime.wakeMin;
    plans.push(plan);
  }
  return plans;
}
