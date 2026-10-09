// What the talk box sends along with Eli's words (Part 8 step 1). Compact on purpose: one AI call per dump.
import type { Snapshot } from '../data/model';
import type { Now } from '../lib/clock';
import { addDays, expandEvents, fmtDate, priorityScore } from '../planner';
import { dayOf } from '../state/planning';

export interface DumpContext {
  now: { date: string; weekday: string; time: string };
  today: {
    wake_time: string | null;
    cold_shower_done: boolean;
    walk_done: boolean;
    lost_day: boolean;
    big3_task_ids: string[];
    blocks: { id: string; title: string; kind: string; start: string; end: string; status: string; event_id: string | null; task_id: string | null }[];
  };
  open_tasks: { id: string; title: string; journey: string; importance: number; deadline: string | null; minutes: number; priority: number }[];
  events_next_7_days: { id: string; date: string; title: string; start: string; end: string; weekly: boolean; immovable: boolean }[];
  weekly_events: { id: string; title: string; weekday: number; start: string; end: string }[];
  places: { id: string; name: string }[];
  /** For grading importance 1 to 5 against what Eli is building toward. */
  vision: { identity: string; end_result: string };
  settings: { practice_block: 'A' | 'B'; code_red: boolean; code_red_level: string; outreach_count: number };
}

const hhmm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

export function buildContext(s: Snapshot, now: Now): DumpContext {
  const rec = dayOf(s, now.date);
  const events: DumpContext['events_next_7_days'] = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(now.date, i);
    for (const e of expandEvents(s.events, date, s.settings)) {
      if (e.allDay) continue;
      const def = s.events.find((d) => d.id === e.id);
      events.push({ id: e.id, date, title: e.title, start: hhmm(e.start), end: hhmm(Math.min(e.end, 1439)), weekly: !!def?.recurringWeekly, immovable: e.immovable });
    }
  }
  return {
    now: { date: now.date, weekday: fmtDate(now.date).split(',')[0]!, time: hhmm(now.min) },
    today: {
      wake_time: rec.wakeMin === null ? null : hhmm(rec.wakeMin),
      cold_shower_done: rec.coldShower.done,
      walk_done: rec.walk.done,
      lost_day: rec.lostDay,
      big3_task_ids: rec.big3.map((i) => i.taskId),
      blocks: s.blocks
        .filter((b) => b.date === now.date && b.kind !== 'travel')
        .sort((a, b) => a.start - b.start)
        .map((b) => ({ id: b.id, title: b.title, kind: b.kind, start: hhmm(b.start), end: hhmm(Math.min(b.end, 1439)), status: b.status, event_id: b.eventId, task_id: b.taskId })),
    },
    open_tasks: s.tasks
      .filter((t) => t.status === 'open')
      .map((t) => ({ id: t.id, title: t.title, journey: t.journey, importance: t.importance, deadline: t.deadline, minutes: t.estimatedMinutes, priority: priorityScore(t, now.date) })),
    events_next_7_days: events,
    weekly_events: s.events
      .filter((e) => e.recurringWeekly && !e.tentative)
      .map((e) => ({ id: e.id, title: e.title, weekday: e.weekday!, start: hhmm(e.start), end: hhmm(Math.min(e.end, 1439)) })),
    places: s.places.map((p) => ({ id: p.id, name: p.name })),
    vision: { identity: s.vision.identity, end_result: s.vision.endResult },
    settings: { practice_block: s.settings.practiceBlock, code_red: s.settings.codeRed, code_red_level: s.settings.codeRedLevel, outreach_count: s.settings.outreachCount },
  };
}
