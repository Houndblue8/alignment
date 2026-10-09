// Hand-built days shared by tests and the printer.
import { toInstance } from '../expand';
import type { DayInput, EventDef } from '../types';
import { FRI, PLACES, SETTINGS, at, task } from './fixtures';

const ev = (over: Partial<EventDef> & Pick<EventDef, 'id' | 'title' | 'start' | 'end'>): EventDef => ({
  kind: 'event',
  location: 'campus',
  rankKey: 'general',
  immovable: false,
  overridableByCodeRed: true,
  recurringWeekly: false,
  date: FRI,
  ...over,
});

const base = (over: Partial<DayInput>): DayInput => ({
  date: FRI,
  now: null,
  wakeMin: at(9),
  anchors: { coldShower: { done: false }, walk: { done: false } },
  events: [],
  tasks: [],
  big3: [],
  places: PLACES,
  settings: SETTINGS,
  mode: 'normal',
  pinned: [],
  workout: null,
  tomorrowFirst: null,
  examWithin7: false,
  ...over,
});

export const advising = ev({ id: 'advising', title: 'Advising appointment', start: at(11), end: at(12), immovable: true, rankKey: 'school', overridableByCodeRed: false });

/** Late wake (9:00 AM), an 11:00 AM immovable event, a social event in the afternoon, an immovable evening. */
export function lateWakeWithSocial(): DayInput {
  return base({
    events: [
      advising,
      ev({ id: 'game-night', title: 'Game night', start: at(13), end: at(15), location: 'home', rankKey: 'social', kind: 'social' }),
      ev({ id: 'team', title: 'Team dinner', start: at(17, 30), end: at(21, 30), immovable: true, rankKey: 'epic_large', overridableByCodeRed: false }),
    ].map(toInstance),
    tasks: [
      task('A', { title: 'Launch page', estimatedMinutes: 150 }),
      task('B', { title: 'Sales email', estimatedMinutes: 60 }),
      task('G', { title: 'Inbox cleanup', importance: 2, estimatedMinutes: 30, workType: 'easy' }),
    ],
    big3: ['A', 'B'],
  });
}

/** Late wake with only 20 minutes free: the floor is cut to 10 minutes. */
export function lateWakeFloorOnly(): DayInput {
  return base({
    events: [
      ev({ id: 'advising', title: 'Advising appointment', start: at(10, 30), end: at(11, 30), immovable: true, rankKey: 'school', overridableByCodeRed: false }),
      ev({ id: 'shift', title: 'Tournament volunteer shift', start: at(11, 35), end: at(21, 30), immovable: true, rankKey: 'tournament', overridableByCodeRed: false }),
    ].map(toInstance),
  });
}

/** Late wake with a workout and two Big 3 items: cuts reach the workout length. */
export function lateWakeWithWorkout(): DayInput {
  return base({
    events: [
      advising,
      ev({ id: 'team', title: 'Team dinner', start: at(16), end: at(21, 30), immovable: true, rankKey: 'epic_large', overridableByCodeRed: false }),
    ].map(toInstance),
    tasks: [task('A', { title: 'Launch page', estimatedMinutes: 60 }), task('B', { title: 'Sales email', estimatedMinutes: 90 })],
    big3: ['A', 'B'],
    workout: 'weights',
  });
}
