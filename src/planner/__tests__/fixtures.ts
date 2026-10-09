import { expect } from 'vitest';
import eventsJson from '../../../seed/events.json';
import placesJson from '../../../seed/places.json';
import settingsJson from '../../../seed/settings.json';
import { expandEvents } from '../expand';
import { examWithinWindow, firstCommitment } from '../planWeek';
import { addDays, fmtTime } from '../time';
import type { Block, BlockKind, DayInput, DayPlan, EventDef, Place, PlannerSettings, Task } from '../types';

export const EVENTS = eventsJson as unknown as EventDef[];
export const PLACES = placesJson as unknown as Place[];
export const SETTINGS: PlannerSettings = {
  wakeTargetMin: settingsJson.wakeTargetMin,
  sleepHours: settingsJson.sleepHours,
  latestWakeMin: settingsJson.latestWakeMin,
  outreachCount: settingsJson.outreachCount,
  practiceBlock: settingsJson.practiceBlock as 'A' | 'B',
};

// A normal week: Monday Oct 12 to Sunday Oct 18, 2026.
export const MON = '2026-10-12';
export const TUE = '2026-10-13';
export const WED = '2026-10-14';
export const THU = '2026-10-15';
export const FRI = '2026-10-16';
export const SAT = '2026-10-17';
export const SUN = '2026-10-18';

/** h:mm as minutes from midnight. at(7, 30) = 450. */
export const at = (h: number, m = 0): number => h * 60 + m;

export function task(id: string, over: Partial<Task> = {}): Task {
  return {
    id,
    title: `Task ${id}`,
    journey: 'shs',
    importance: 3,
    deadline: null,
    estimatedMinutes: 60,
    deferralCount: 0,
    workType: 'deep',
    createdAt: '2026-10-01',
    ...over,
  };
}

/** A DayInput for a seeded date, built the same way planWeek builds it. */
export function dayInput(date: string, over: Partial<DayInput> = {}): DayInput {
  const mode = over.mode ?? 'normal';
  const settings = over.settings ?? SETTINGS;
  const first = firstCommitment(expandEvents(EVENTS, addDays(date, 1), settings), mode === 'codeRed' ? 'codeRed' : 'normal');
  return {
    date,
    now: null,
    wakeMin: at(6, 30),
    anchors: { coldShower: { done: false }, walk: { done: false } },
    events: expandEvents(EVENTS, date, settings),
    tasks: [],
    big3: [],
    places: PLACES,
    settings,
    mode,
    pinned: [],
    workout: null,
    tomorrowFirst: first ? { start: first.start, location: first.location, title: first.title } : null,
    examWithin7: examWithinWindow(EVENTS, date, settings),
    ...over,
  };
}

export const ofKind = (plan: DayPlan, kind: BlockKind): Block[] => plan.blocks.filter((b) => b.kind === kind);
export const one = (plan: DayPlan, kind: BlockKind): Block => {
  const found = ofKind(plan, kind);
  expect(found, `exactly one ${kind}`).toHaveLength(1);
  return found[0]!;
};
export const byEvent = (plan: DayPlan, eventId: string): Block | undefined => plan.blocks.find((b) => b.eventId === eventId);
export const span = (b: Block): string => `${fmtTime(b.start)}-${fmtTime(b.end)}`;

const EM_DASH = /—|–/;
const EMOJI = /\p{Extended_Pictographic}/u;

/** Rules every plan must satisfy. */
export function expectValidPlan(plan: DayPlan): void {
  const ids = new Set<string>();
  for (const b of plan.blocks) {
    expect(b.end, `${b.id} has positive length`).toBeGreaterThan(b.start);
    expect(ids.has(b.id), `duplicate id ${b.id}`).toBe(false);
    ids.add(b.id);
    expect(b.id.startsWith(`${plan.date}:${b.kind}:`), `id format ${b.id}`).toBe(true);
    if (b.source === 'planner' && b.kind !== 'travel' && !b.eventId && b.status !== 'done') {
      expect(b.start, `${b.id} is not before wake`).toBeGreaterThanOrEqual(plan.wakeMin);
    }
  }
  const sorted = [...plan.blocks].sort((a, b) => a.start - b.start);
  for (let i = 1; i < sorted.length; i++) {
    const a = sorted[i - 1]!;
    const b = sorted[i]!;
    expect(b.start, `${a.id} (${span(a)}) overlaps ${b.id} (${span(b)})`).toBeGreaterThanOrEqual(a.end);
  }
  for (const text of [...plan.warnings, ...plan.notes, ...plan.blocks.map((b) => b.title)]) {
    expect(EM_DASH.test(text), `no dashes in "${text}"`).toBe(false);
    expect(EMOJI.test(text), `no emoji in "${text}"`).toBe(false);
  }
}

/** Human-readable plan, for debugging failing tests. */
export function describePlan(plan: DayPlan): string {
  const lines = plan.blocks.map((b) => `${span(b).padEnd(20)} ${b.kind.padEnd(19)} ${b.title} @${b.placeId}${b.status === 'done' ? ' [done]' : ''}`);
  return [`== ${plan.date} wake ${fmtTime(plan.wakeMin)}`, ...lines, ...plan.warnings.map((w) => `WARN ${w}`), ...plan.notes.map((n) => `NOTE ${n}`)].join('\n');
}
