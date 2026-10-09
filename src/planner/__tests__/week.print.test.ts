// Prints a seeded week for eyeballing. Run with PRINT=1 npx vitest run week.print
import { test } from 'vitest';
import { planDay } from '../planDay';
import { planWeek } from '../planWeek';
import { lateWakeFloorOnly, lateWakeWithSocial, lateWakeWithWorkout } from './scenarios';
import { EVENTS, MON, PLACES, SETTINGS, at, describePlan, task } from './fixtures';

test.skipIf(!process.env.PRINT)('print week', () => {
  const tasks = [
    task('essay', { title: 'Tax research memo', journey: 'school', importance: 4, deadline: '2026-10-16', estimatedMinutes: 180 }),
    task('course', { title: 'Course module 2', journey: 'shs', importance: 5, estimatedMinutes: 240 }),
    task('email', { title: 'Reply to clients', journey: 'shs', importance: 3, estimatedMinutes: 30, workType: 'easy' }),
    task('laundry', { title: 'Laundry', journey: 'life', importance: 2, estimatedMinutes: 45, workType: 'errand' }),
  ];
  const plans = planWeek({
    startDate: MON,
    today: { wakeMin: at(6, 30), anchors: { coldShower: { done: false }, walk: { done: false } }, big3: ['essay', 'course', 'email'], mode: 'normal' },
    codeRed: false,
    eventDefs: EVENTS,
    tasks,
    places: PLACES,
    settings: SETTINGS,
    workoutsThisWeek: { field: 0, weights: 0 },
  });
  console.log(plans.map(describePlan).join('\n\n'));
});

test.skipIf(!process.env.PRINT)('print scenarios', () => {
  console.log([lateWakeWithSocial(), lateWakeWithWorkout(), lateWakeFloorOnly()].map((d) => describePlan(planDay(d))).join('\n\n'));
});
