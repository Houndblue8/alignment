// Part 14 dump tests 13 to 19, with a fake AI (the live script is scripts/live-dump-test.ts).
import { describe, expect, test, vi } from 'vitest';
import { emptyDay, type Snapshot, type TaskRow } from '../data/model';
import { seedSnapshot } from '../data/seedData';
import type { Now } from '../lib/clock';
import { buildWeek, dayOf } from '../state/planning';
import { anchorLines, applyOps, restoreSnapshot, undoSnapshot } from './apply';
import { buildContext } from './context';
import { runDump } from './pipeline';
import { toolInputSchema, type ParseReply } from './schema';
import { checkReply } from './validate';

const THU = '2026-10-15';

/** A seeded Thursday that was checked in at wake 6:30 and planned at `now`. */
function plannedDay(now: Now, tasks: TaskRow[] = []): Snapshot {
  const s0: Snapshot = { ...seedSnapshot(), tasks, days: { [now.date]: { ...emptyDay(now.date), wakeMin: 390, checkinDone: true } } };
  const built = buildWeek(s0, { date: now.date, min: 390 });
  return { ...s0, blocks: built.blocks, days: { ...s0.days, ...Object.fromEntries(built.days.map((d) => [d.date, d])) } };
}

/** Apply a reply the way the store does: validate, apply, replan, describe. */
function runReply(s: Snapshot, reply: ParseReply, now: Now) {
  const checked = checkReply(reply, s, now);
  if (!checked.ok) throw new Error(checked.errors.join('; '));
  const applied = applyOps(s, checked.reply, now);
  const built = buildWeek(applied.next, applied.replanFromMin === null ? now : { date: now.date, min: applied.replanFromMin });
  const after: Snapshot = {
    ...applied.next,
    blocks: [...applied.next.blocks.filter((b) => !built.dates.includes(b.date)), ...built.blocks],
    days: { ...applied.next.days, ...Object.fromEntries(built.days.map((d) => [d.date, d])) },
  };
  return { applied, after, lines: [...applied.done, ...anchorLines(after, now.date, checked.reply.ops)] };
}

const reply = (ops: ParseReply['ops'], unhandled: ParseReply['unhandled'] = []): ParseReply => ({ ops, unhandled, summary: 'ok' });

describe('dump pipeline', () => {
  test('13. "I woke up at 7:30" sets the wake time and the anchors', () => {
    const now = { date: THU, min: 470 };
    const s: Snapshot = { ...seedSnapshot(), days: { [THU]: { ...emptyDay(THU), checkinDone: true, wakeMin: 390 } } };
    const { after, lines } = runReply(s, reply([{ op: 'set_wake_time', source_text: 'I woke up at 7:30', time: '07:30' }]), now);
    expect(dayOf(after, THU).wakeMin).toBe(450);
    expect(lines).toEqual(['Wake time set to 7:30 AM.', 'Cold shower set to 7:50 AM.', 'Walk with God set to 8:00 AM.']);
    // Not-yet anchors start at max(wake + 5, now): checked in at 7:50, so the cold shower is 7:50, never a fixed clock time.
    const shower = after.blocks.find((b) => b.date === THU && b.kind === 'anchor_cold_shower')!;
    expect(shower.start).toBe(470);
  });

  test('13b. "I woke up at 7:30 and already did my cold shower" marks it done at 7:35', () => {
    const now = { date: THU, min: 500 };
    const s: Snapshot = { ...seedSnapshot(), days: { [THU]: { ...emptyDay(THU), checkinDone: true, wakeMin: 390 } } };
    const { after, lines } = runReply(
      s,
      reply([
        { op: 'set_wake_time', source_text: 'I woke up at 7:30', time: '07:30' },
        { op: 'set_anchor', source_text: 'already did my cold shower', anchor: 'cold_shower', done: true, time: null },
      ]),
      now,
    );
    const shower = after.blocks.find((b) => b.date === THU && b.kind === 'anchor_cold_shower')!;
    expect(shower).toMatchObject({ start: 455, end: 465, status: 'done' });
    expect(lines).toContain('Cold shower marked done.');
  });

  test('14. "Move my library block to 1 PM" moves it and rebuilds everything after it', () => {
    const now = { date: THU, min: 400 };
    const s = plannedDay(now, [task('memo', 120)]);
    const lib = s.blocks.find((b) => b.date === THU && b.kind === 'library_work')!;
    const { after } = runReply(s, reply([{ op: 'move_block', source_text: 'Move my library block to 1 PM', block_id: lib.id, start: '13:00' }]), now);
    const moved = after.blocks.find((b) => b.id === lib.id)!;
    expect(moved).toMatchObject({ start: 780, end: 780 + (lib.end - lib.start), pinned: true });
    const today = after.blocks.filter((b) => b.date === THU).sort((a, b) => a.start - b.start);
    for (let i = 1; i < today.length; i++) expect(today[i]!.start).toBeGreaterThanOrEqual(today[i - 1]!.end);
  });

  test('14c. a missed block moves to later today; moving into the past is rejected', () => {
    const now = { date: THU, min: 840 }; // 2:00 PM
    const s = plannedDay({ date: THU, min: 400 }, [task('memo', 240)]);
    const missed = s.blocks.filter((b) => b.date === THU && b.taskId === 'memo' && b.start < 840).sort((a, b) => a.start - b.start)[0]!;
    expect(missed).toBeDefined();
    const later = runReply(s, reply([{ op: 'move_block', source_text: 'I missed my memo block, move it to 3:30', block_id: missed.id, start: '15:30' }]), now);
    expect(later.after.blocks.find((b) => b.id === missed.id)).toMatchObject({ start: 930, pinned: true });
    expect(checkReply(reply([{ op: 'move_block', source_text: 'move it to noon', block_id: missed.id, start: '12:00' }]), s, now).ok).toBe(false);
  });

  test('14b. moving a block onto a class is rejected', () => {
    const now = { date: THU, min: 400 };
    const s = plannedDay(now, [task('memo', 120)]);
    const lib = s.blocks.find((b) => b.date === THU && b.kind === 'library_work')!;
    const c = checkReply(reply([{ op: 'move_block', source_text: 'move library to 9', block_id: lib.id, start: '09:00' }]), s, now);
    expect(c.ok).toBe(false);
  });

  test('15. "I\'m running an hour late" shifts flexible blocks and keeps immovable events', () => {
    const now = { date: THU, min: 600 };
    const s = plannedDay(now, [task('memo', 240)]);
    const { after, lines } = runReply(s, reply([{ op: 'shift_day', source_text: "I'm running an hour late", minutes: 60 }]), now);
    expect(lines[0]).toBe('Rest of the day pushed back 60 minutes. Fixed events stay where they are.');
    const today = after.blocks.filter((b) => b.date === THU);
    expect(today.find((b) => b.eventId === 'bus-thu')).toMatchObject({ start: 540, end: 620 });
    expect(today.find((b) => b.eventId === 'epic-large-thu')).toMatchObject({ start: 1140, end: 1320 });
    for (const b of today.filter((x) => !x.eventId && x.kind !== 'travel' && x.status !== 'done' && x.start >= 600)) {
      expect(b.start, b.id).toBeGreaterThanOrEqual(660);
    }
  });

  test('16. something the app cannot do appears under Couldn\'t do', () => {
    const now = { date: THU, min: 600 };
    const s = plannedDay(now);
    const r = reply([{ op: 'add_quote', source_text: 'save this quote: keep going', text: 'Keep going.', tags: ['general'] }], [
      { text: 'text my mom happy birthday', reason: 'The app cannot send messages for you.' },
    ]);
    const { applied, lines } = runReply(s, r, now);
    expect(lines).toEqual(['Quote saved.']);
    expect(applied.cantDo).toEqual([{ text: 'text my mom happy birthday', reason: 'The app cannot send messages for you.' }]);
  });

  test('17. a brain dump of 5 items with deadlines creates 5 tasks and they reach the plan', () => {
    const now = { date: THU, min: 600 };
    const s = plannedDay(now);
    const items = ['Tax memo', 'Course module 3', 'Email the printer', 'Pay rent', 'Read chapter 9'];
    const ops = items.map((title, i) => ({
      op: 'add_task' as const,
      source_text: title,
      title,
      journey: (i % 2 ? 'shs' : 'school') as 'shs' | 'school',
      importance: 4,
      deadline: `2026-10-${17 + i}`,
      minutes: 45,
      work_type: 'deep' as const,
      steps: [{ text: 'Start', guess: true }],
    }));
    const { after, lines } = runReply(s, reply(ops), now);
    expect(after.tasks).toHaveLength(5);
    expect(lines).toHaveLength(5);
    const planned = new Set(after.blocks.filter((b) => b.taskId).map((b) => after.tasks.find((t) => t.id === b.taskId)!.title));
    expect([...planned].sort()).toEqual([...items].sort());
  });

  test('18. invalid AI output is retried once, then fails and changes nothing', async () => {
    const now = { date: THU, min: 600 };
    const s = plannedDay(now);
    const before = JSON.stringify(s);
    const bad = vi.fn(async () => ({ ops: [{ op: 'move_block', source_text: 'x', block_id: 'nope', start: '25:00' }], unhandled: [], summary: '' }));
    const out = await runDump('move nope', s, now, { parse: bad });
    expect(bad).toHaveBeenCalledTimes(2);
    expect(out.ok).toBe(false);
    expect(JSON.stringify(s)).toBe(before);
    // The retry carries the validation errors.
    const second = bad.mock.calls[1] as unknown as [{ previousErrors: string[] }];
    expect(second[0].previousErrors.length).toBeGreaterThan(0);

    const good = reply([{ op: 'replan', source_text: 'replan' }]);
    const flaky = vi.fn().mockResolvedValueOnce({ nonsense: true }).mockResolvedValueOnce(good);
    const ok = await runDump('replan', s, now, { parse: flaky });
    expect(ok).toMatchObject({ ok: true, attempts: 2 });
  });

  test('19. Undo restores the exact previous state', () => {
    const now = { date: THU, min: 600 };
    const s = plannedDay(now, [task('memo', 120)]);
    const lib = s.blocks.find((b) => b.date === THU && b.kind === 'library_work')!;
    const before = undoSnapshot(s, THU);
    const { after } = runReply(
      s,
      reply([
        { op: 'add_task', source_text: 'add laundry', title: 'Laundry', journey: 'life', importance: 2, deadline: null, minutes: 30, work_type: 'errand', steps: [] },
        { op: 'set_practice_block', source_text: 'block B', block: 'B' },
        { op: 'delete_block', source_text: 'skip library', block_id: lib.id },
        { op: 'add_block', source_text: 'dentist next month', title: 'Dentist', date: '2026-11-20', start: '10:00', end: '11:00', location: null },
      ]),
      now,
    );
    expect(after).not.toEqual(s);
    const far = after.blocks.filter((b) => b.date === '2026-11-20').map((b) => b.id);
    const restored = restoreSnapshot(after, before, far);
    expect(restored.settings).toEqual(s.settings);
    expect(restored.tasks).toEqual(s.tasks);
    expect(restored.events).toEqual(s.events);
    expect(restored.quotes).toEqual(s.quotes);
    const sort = (x: Snapshot) => [...x.blocks].sort((a, b) => a.id.localeCompare(b.id));
    expect(sort(restored)).toEqual(sort(s));
    expect(restored.days).toEqual(s.days);
  });
});

describe('validation and context', () => {
  const now = { date: THU, min: 600 };
  const s = plannedDay(now, [task('memo', 120)]);

  test('rejects unknown ids, bad times, immovable moves and starts before wake', () => {
    const cases: ParseReply['ops'] = [
      { op: 'complete_task', source_text: 'x', task_id: 'ghost' },
      { op: 'update_event', source_text: 'x', event_id: 'bus-thu', scope: 'all', date: null, start: '10:00' },
      { op: 'add_block', source_text: 'x', title: 'Early', date: THU, start: '05:00', end: '05:30', location: null },
      { op: 'set_wake_time', source_text: 'x', time: '11:00' },
      { op: 'delete_event', source_text: 'x', event_id: 'nope', scope: 'all', date: null },
    ];
    for (const op of cases) expect(checkReply(reply([op]), s, now).ok, op.op).toBe(false);
    expect(checkReply({ ops: [{ op: 'set_wake_time', source_text: 'x', time: '7:30' }], unhandled: [], summary: '' }, s, now).ok).toBe(false);
    expect(checkReply(reply([{ op: 'ask', source_text: 'a', question: 'a?' }, { op: 'ask', source_text: 'b', question: 'b?' }]), s, now).ok).toBe(false);
  });

  test('context carries block, task and event ids for the AI', () => {
    const c = buildContext(s, now);
    expect(c.now).toEqual({ date: THU, weekday: 'Thursday', time: '10:00' });
    expect(c.today.blocks.some((b) => b.kind === 'library_work')).toBe(true);
    expect(c.open_tasks.map((t) => t.id)).toEqual(['memo']);
    expect(c.events_next_7_days.some((e) => e.id === 'bus-thu' && e.date === THU && e.immovable)).toBe(true);
  });

  test('the tool schema is an object with ops, unhandled and summary', () => {
    const j = toolInputSchema() as { type: string; required: string[] };
    expect(j.type).toBe('object');
    expect(j.required).toEqual(['ops', 'unhandled', 'summary']);
  });
});

function task(id: string, minutes: number): TaskRow {
  return {
    id,
    title: id,
    journey: 'school',
    importance: 4,
    deadline: null,
    estimatedMinutes: minutes,
    deferralCount: 0,
    workType: 'deep',
    createdAt: '2026-10-01',
    status: 'open',
    notes: '',
    completedAt: null,
  };
}

describe('the talk box never adds the same thing twice (Oct 10 feedback)', () => {
  const task = (id: string, title: string): TaskRow => ({
    id,
    title,
    journey: 'body',
    importance: 3,
    deadline: null,
    estimatedMinutes: 60,
    deferralCount: 0,
    workType: 'deep',
    steps: [],
    createdAt: '2026-10-01T12:00:00.000Z',
    status: 'open',
    notes: '',
    completedAt: null,
  });

  test('a task already on the list in other words is reused', () => {
    const now = { date: THU, min: 480 };
    const s = plannedDay(now, [task('lift', 'Lift')]);
    const { after, lines } = runReply(
      s,
      reply([{ op: 'add_task', source_text: 'lifts today', title: 'Lifts', journey: 'body', importance: 3, deadline: null, minutes: 60, work_type: 'deep', steps: [] }]),
      now,
    );
    expect(after.tasks.map((t) => t.title)).toEqual(['Lift']);
    expect(lines[0]).toBe('Lift is already on your list.');
  });

  test('dinner plans become the dinner: one dinner on the day', () => {
    const now = { date: THU, min: 480 };
    const s = plannedDay(now);
    const { after } = runReply(
      s,
      reply([
        { op: 'add_block', source_text: 'dinner with epic', title: 'Dinner and intentional hangout with Epic people', date: THU, start: '17:30', end: '19:00', location: null },
        { op: 'add_block', source_text: 'dinner with epic', title: 'Dinner and hangout with Epic people', date: THU, start: '17:30', end: '19:00', location: null },
      ]),
      now,
    );
    const day = after.blocks.filter((b) => b.date === THU);
    expect(day.filter((b) => /dinner/i.test(b.title))).toHaveLength(1);
  });
});
