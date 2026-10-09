// Checks an AI reply against the real data and the hard rules (Part 8 step 3). Any error means the reply is
// rejected as a whole: the app retries once with these errors, then shows an error and changes nothing.
import type { Snapshot } from '../data/model';
import type { Now } from '../lib/clock';
import { addDays, diffDays, fmtTime } from '../planner';
import { dayOf } from '../state/planning';
import { ParseReplySchema, type Op, type ParseReply } from './schema';

export const toMin = (t: string): number => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

export type Checked = { ok: true; reply: ParseReply } | { ok: false; errors: string[] };

/** Shape check (Zod) then meaning check (ids, times, hard rules). */
export function checkReply(raw: unknown, s: Snapshot, now: Now): Checked {
  const parsed = ParseReplySchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.slice(0, 12).map((i) => `${i.path.join('.') || 'reply'}: ${i.message}`) };
  }
  const errors = validateOps(parsed.data, s, now);
  return errors.length ? { ok: false, errors } : { ok: true, reply: parsed.data };
}

export function validateOps(reply: ParseReply, s: Snapshot, now: Now): string[] {
  const errors: string[] = [];
  const openTasks = new Set(s.tasks.filter((t) => t.status === 'open').map((t) => t.id));
  const createdTitles = new Set<string>();
  const places = new Set([...s.places.map((p) => p.id), 'other']);
  const blocks = new Map(s.blocks.filter((b) => b.date >= now.date && b.date <= addDays(now.date, 7)).map((b) => [b.id, b]));
  const wake = dayOf(s, now.date).wakeMin;
  const inRange = (d: string, before: number, after: number) => {
    const n = diffDays(now.date, d);
    return Number.isFinite(n) && n >= -before && n <= after;
  };

  if (reply.ops.filter((o) => o.op === 'ask').length > 1) errors.push('Only one ask operation is allowed.');

  reply.ops.forEach((op: Op, i) => {
    const at = `ops[${i}] ${op.op}`;
    const fail = (m: string) => errors.push(`${at}: ${m}`);
    switch (op.op) {
      case 'set_wake_time':
        if (toMin(op.time) > now.min + 5) fail(`wake time ${op.time} is later than now (${String(Math.floor(now.min / 60)).padStart(2, '0')}:${String(now.min % 60).padStart(2, '0')}).`);
        break;
      case 'set_anchor':
        if (op.time && toMin(op.time) > now.min + 5) fail('an anchor time cannot be in the future.');
        if (op.time && wake !== null && toMin(op.time) < wake) fail('an anchor time cannot be before the wake time.');
        break;
      case 'add_task':
        if (op.deadline && !inRange(op.deadline, 0, 400)) fail(`deadline ${op.deadline} must be today or later.`);
        createdTitles.add(op.title);
        break;
      case 'update_task':
        if (!openTasks.has(op.task_id)) fail(`task "${op.task_id}" is not an open task id.`);
        if (op.deadline && !inRange(op.deadline, 0, 400)) fail(`deadline ${op.deadline} must be today or later.`);
        break;
      case 'complete_task':
      case 'delete_task':
        if (!openTasks.has(op.task_id)) fail(`task "${op.task_id}" is not an open task id.`);
        break;
      case 'set_big3': {
        const bad = op.task_ids.filter((id) => !openTasks.has(id));
        if (bad.length) fail(`not open task ids: ${bad.join(', ')}.`);
        if (new Set(op.task_ids).size !== op.task_ids.length) fail('task ids repeat.');
        break;
      }
      case 'add_event':
        if ((op.date === null) === (op.weekday === null)) fail('set exactly one of date (one time) or weekday (weekly).');
        if (op.date && !inRange(op.date, 0, 400)) fail(`date ${op.date} must be today or later.`);
        if (toMin(op.end) <= toMin(op.start)) fail('end must be after start.');
        if (op.location && !places.has(op.location)) fail(`location "${op.location}" is not a place id.`);
        break;
      case 'update_event':
      case 'delete_event': {
        const ev = s.events.find((e) => e.id === op.event_id);
        if (!ev) {
          fail(`event "${op.event_id}" does not exist.`);
          break;
        }
        if (op.scope === 'this' && !op.date) fail('scope "this" needs the date of the occurrence.');
        if (op.date && !inRange(op.date, 0, 400)) fail(`date ${op.date} must be today or later.`);
        if (op.op === 'update_event') {
          const moves = op.start !== undefined || op.end !== undefined || op.weekday !== undefined;
          if (ev.immovable && moves) fail(`"${ev.title}" is immovable and cannot be moved.`);
          const start = op.start ? toMin(op.start) : ev.start;
          const end = op.end ? toMin(op.end) : ev.end;
          if (end <= start) fail('end must be after start.');
          if (op.location && !places.has(op.location)) fail(`location "${op.location}" is not a place id.`);
        } else if (ev.immovable && op.scope === 'all') {
          fail(`"${ev.title}" is immovable. Delete only one occurrence (scope this), or Eli can delete it in Settings.`);
        }
        break;
      }
      case 'move_block':
      case 'resize_block':
      case 'delete_block': {
        const b = blocks.get(op.block_id);
        if (!b) {
          fail(`block "${op.block_id}" is not on the plan.`);
          break;
        }
        const ev = b.eventId ? s.events.find((e) => e.id === b.eventId) : undefined;
        if (ev?.immovable) fail(`"${b.title}" is an immovable event and cannot be moved, resized or removed.`);
        if (b.kind.startsWith('anchor_')) fail('use set_anchor for the cold shower and the walk.');
        if (b.kind === 'travel' || b.kind === 'bed' || b.kind === 'winddown') fail(`"${b.title}" follows the plan and cannot be changed directly.`);
        if (op.op === 'move_block') {
          const start = toMin(op.start);
          if (b.date === now.date && wake !== null && start < wake) fail(`nothing can start before the wake time.`);
          if (start + (b.end - b.start) > 1440) fail('the block would run past midnight.');
          const clash = s.blocks.find((x) => x.date === b.date && x.eventId && x.id !== b.id && start < x.end && x.start < start + (b.end - b.start));
          if (clash) fail(`that time overlaps ${clash.title} (${fmtTime(clash.start)} to ${fmtTime(clash.end)}). Pick a free time.`);
        }
        if (op.op === 'resize_block' && b.start + op.minutes > 1440) fail('the block would run past midnight.');
        break;
      }
      case 'add_block':
        if (!inRange(op.date, 0, 60)) fail(`date ${op.date} must be today or within 60 days.`);
        if (toMin(op.end) <= toMin(op.start)) fail('end must be after start.');
        if (op.date === now.date && wake !== null && toMin(op.start) < wake) fail('nothing can start before the wake time.');
        if (op.location && !places.has(op.location)) fail(`location "${op.location}" is not a place id.`);
        break;
      default:
        break;
    }
  });
  return errors;
}
