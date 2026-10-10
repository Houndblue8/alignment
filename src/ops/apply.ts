// Applies validated talk box operations to the data (Part 8 step 7). Pure: returns the new data and a
// plain-language result. The store then replans the week, saves, and logs the dump for Undo.
import { emptyDay, journeyLabel, type Big3Item, type DayRecord, type Snapshot, type TaskRow } from '../data/model';
import type { Now } from '../lib/clock';
import { addDays, fmtDate, fmtTime, sameThing, type Block, type EventDef, type RankKey } from '../planner';
import { dayOf } from '../state/planning';
import type { Op, ParseReply } from './schema';
import { toMin } from './validate';

export interface ApplyResult {
  next: Snapshot;
  done: string[];
  cantDo: { text: string; reason: string }[];
  question: string | null;
  /** Rebuild from this time instead of now ("I'm running 30 minutes behind"). */
  replanFromMin: number | null;
}

/** Everything a dump can change, for Undo. Days and blocks cover today and the next 7 days. */
export interface UndoSnapshot {
  dates: string[];
  settings: Snapshot['settings'];
  tasks: TaskRow[];
  events: EventDef[];
  quotes: Snapshot['quotes'];
  days: DayRecord[];
  blocks: Block[];
}

export function undoSnapshot(s: Snapshot, today: string): UndoSnapshot {
  const dates = Array.from({ length: 8 }, (_, i) => addDays(today, i));
  return {
    dates,
    settings: s.settings,
    tasks: s.tasks,
    events: s.events,
    quotes: s.quotes,
    days: dates.map((d) => s.days[d]).filter((d): d is DayRecord => !!d),
    blocks: s.blocks.filter((b) => dates.includes(b.date)),
  };
}

/** The data exactly as it was before a dump. farBlockIds are manual blocks the dump added beyond the week. */
export function restoreSnapshot(s: Snapshot, b: UndoSnapshot, farBlockIds: string[]): Snapshot {
  const days = { ...s.days };
  for (const d of b.dates) delete days[d];
  for (const d of b.days) days[d.date] = d;
  return {
    ...s,
    settings: b.settings,
    tasks: b.tasks,
    events: b.events,
    quotes: b.quotes,
    days,
    blocks: [...s.blocks.filter((x) => !b.dates.includes(x.date) && !farBlockIds.includes(x.id)), ...b.blocks],
  };
}

const ANCHOR_LABEL ={ cold_shower: 'Cold shower', walk: 'Walk with God' } as const;
const RANK_FOR_KIND: Record<string, RankKey> = { social: 'social', class: 'school', exam: 'school', practice: 'club_practice', event: 'general' };
const shortId = () => crypto.randomUUID().slice(0, 8);
const dateLabel = (d: string) => fmtDate(d).replace(/^\w+, /, '');

export function applyOps(s: Snapshot, reply: ParseReply, now: Now): ApplyResult {
  let next: Snapshot = { ...s, days: { ...s.days }, tasks: [...s.tasks], events: [...s.events], blocks: [...s.blocks], quotes: [...s.quotes] };
  const done: string[] = [];
  let question: string | null = null;
  let replanFromMin: number | null = null;
  const today = now.date;

  const day = (d = today): DayRecord => next.days[d] ?? emptyDay(d);
  const setDay = (d: DayRecord) => (next.days[d.date] = d);
  const taskTitle = (id: string) => next.tasks.find((t) => t.id === id)?.title ?? 'task';

  for (const op of reply.ops) {
    switch (op.op) {
      case 'set_wake_time': {
        const wakeMin = toMin(op.time);
        setDay({ ...day(), wakeMin, checkinDone: true });
        // Planned (not done) anchors move with the new wake time.
        next.blocks = next.blocks.filter((b) => !(b.date === today && b.kind.startsWith('anchor_') && b.status !== 'done'));
        done.push(`Wake time set to ${fmtTime(wakeMin)}.`);
        break;
      }
      case 'set_anchor': {
        const key = op.anchor === 'cold_shower' ? 'coldShower' : 'walk';
        const kind = op.anchor === 'cold_shower' ? 'anchor_cold_shower' : 'anchor_walk';
        const startMin = op.time ? toMin(op.time) : null;
        setDay({ ...day(), [key]: { done: op.done, startMin } });
        next.blocks = next.blocks.flatMap((b) => {
          if (b.date !== today || b.kind !== kind) return [b];
          if (!op.done) return b.status === 'done' ? [] : [b];
          if (startMin === null) return [{ ...b, status: 'done' as const }];
          return [];
        });
        done.push(op.done ? `${ANCHOR_LABEL[op.anchor]} marked done${startMin !== null ? ` at ${fmtTime(startMin)}` : ''}.` : `${ANCHOR_LABEL[op.anchor]} set to not yet.`);
        break;
      }
      case 'add_task': {
        // The same task in other words ("Lift" / "Lifts") is not added twice.
        const existing = next.tasks.find((x) => x.status === 'open' && sameThing(x.title, op.title));
        if (existing) {
          done.push(`${existing.title} is already on your list.`);
          break;
        }
        const t: TaskRow = {
          id: crypto.randomUUID(),
          title: op.title,
          journey: op.journey,
          importance: op.importance,
          deadline: op.deadline,
          estimatedMinutes: op.minutes,
          deferralCount: 0,
          workType: op.work_type,
          steps: op.steps,
          createdAt: new Date().toISOString(),
          status: 'open',
          notes: '',
          completedAt: null,
        };
        next.tasks.push(t);
        done.push(`Added ${t.title}: ${journeyLabel(t.journey)}, ${t.estimatedMinutes} minutes${t.deadline ? `, due ${dateLabel(t.deadline)}` : ''}.`);
        break;
      }
      case 'update_task': {
        next.tasks = next.tasks.map((t) =>
          t.id !== op.task_id
            ? t
            : {
                ...t,
                ...(op.title !== undefined && { title: op.title }),
                ...(op.journey !== undefined && { journey: op.journey }),
                ...(op.importance !== undefined && { importance: op.importance }),
                ...(op.deadline !== undefined && { deadline: op.deadline }),
                ...(op.minutes !== undefined && { estimatedMinutes: op.minutes }),
              },
        );
        done.push(`Updated ${taskTitle(op.task_id)}.`);
        break;
      }
      case 'complete_task':
        next.tasks = next.tasks.map((t) => (t.id === op.task_id ? { ...t, status: 'done' as const, completedAt: new Date().toISOString() } : t));
        done.push(`${taskTitle(op.task_id)} marked done.`);
        break;
      case 'delete_task':
        done.push(`Removed ${taskTitle(op.task_id)}.`);
        next.tasks = next.tasks.map((t) => (t.id === op.task_id ? { ...t, status: 'dropped' as const } : t));
        next.days[today] = { ...day(), big3: day().big3.filter((i) => i.taskId !== op.task_id) };
        break;
      case 'add_event': {
        const ev: EventDef = {
          id: `talk-${shortId()}`,
          title: op.title,
          kind: op.kind,
          start: toMin(op.start),
          end: toMin(op.end),
          location: op.location ?? 'other',
          rankKey: RANK_FOR_KIND[op.kind] ?? 'general',
          immovable: op.immovable,
          overridableByCodeRed: !op.immovable && op.kind !== 'class' && op.kind !== 'exam',
          recurringWeekly: op.weekday !== null,
          ...(op.weekday !== null ? { weekday: op.weekday } : { date: op.date! }),
        };
        next.events.push(ev);
        const when = ev.recurringWeekly ? `every ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][ev.weekday!]}` : dateLabel(ev.date!);
        done.push(`Added ${ev.title}, ${when}, ${fmtTime(ev.start)} to ${fmtTime(ev.end)}.`);
        break;
      }
      case 'update_event':
        updateEvent(next, op, done);
        break;
      case 'delete_event': {
        const ev = next.events.find((e) => e.id === op.event_id)!;
        if (op.scope === 'all' || !ev.recurringWeekly) {
          next.events = next.events.filter((e) => e.id !== ev.id);
          done.push(`Removed ${ev.title}${ev.recurringWeekly ? ' from every week' : ''}.`);
        } else {
          next.events = next.events.map((e) => (e.id === ev.id ? { ...e, skipDates: [...(e.skipDates ?? []), op.date!] } : e));
          done.push(`Removed ${ev.title} on ${dateLabel(op.date!)}.`);
        }
        break;
      }
      case 'move_block': {
        const b = next.blocks.find((x) => x.id === op.block_id)!;
        const start = toMin(op.start);
        next.blocks = next.blocks.map((x) => (x.id === b.id ? { ...x, start, end: start + (x.end - x.start), pinned: true } : x));
        done.push(`${b.title} moved to ${fmtTime(start)}. The rest of the day was rebuilt around it.`);
        break;
      }
      case 'resize_block': {
        const b = next.blocks.find((x) => x.id === op.block_id)!;
        next.blocks = next.blocks.map((x) => (x.id === b.id ? { ...x, end: x.start + op.minutes, pinned: true } : x));
        done.push(`${b.title} is now ${op.minutes} minutes.`);
        break;
      }
      case 'delete_block': {
        const b = next.blocks.find((x) => x.id === op.block_id)!;
        next.blocks = next.blocks.filter((x) => x.id !== b.id);
        const rec = day(b.date);
        setDay({ ...rec, plan: { ...rec.plan, suppressed: [...(rec.plan.suppressed ?? []), b.id] } });
        done.push(`${b.title} taken off ${b.date === today ? 'today' : dateLabel(b.date)}.`);
        break;
      }
      case 'add_block': {
        const start = toMin(op.start);
        const end = toMin(op.end);
        const twin = next.blocks.find(
          (b) => b.date === op.date && b.source === 'manual' && b.start < end && start < b.end && sameThing(b.title, op.title),
        );
        if (twin) {
          done.push(`${twin.title} is already planned at ${fmtTime(twin.start)}.`);
          break;
        }
        const block: Block = {
          id: `${op.date}:misc:manual-${shortId()}`,
          date: op.date,
          start,
          end,
          kind: 'misc',
          title: op.title,
          placeId: op.location ?? 'home',
          taskId: null,
          eventId: null,
          status: 'planned',
          pinned: true,
          source: 'manual',
          howto: null,
        };
        next.blocks.push(block);
        done.push(`Added ${op.title}, ${op.date === today ? 'today' : dateLabel(op.date)} ${fmtTime(start)} to ${fmtTime(end)}.`);
        break;
      }
      case 'set_big3': {
        const big3: Big3Item[] = op.task_ids.map((taskId) => ({ taskId, locked: true, accepted: true }));
        setDay({ ...day(), big3 });
        done.push(`Big 3 set: ${op.task_ids.map(taskTitle).join(', ')}.`);
        break;
      }
      case 'shift_day':
        replanFromMin = now.min + op.minutes;
        done.push(`Rest of the day pushed back ${op.minutes} minutes. Fixed events stay where they are.`);
        break;
      case 'set_practice_block':
        next.settings = { ...next.settings, practiceBlock: op.block };
        done.push(`Practice block set to ${op.block}.`);
        break;
      case 'set_code_red':
        next.settings = { ...next.settings, codeRed: op.on, codeRedLevel: op.level ?? next.settings.codeRedLevel };
        done.push(op.on ? `Code Red is on${(op.level ?? next.settings.codeRedLevel) === 'severe' ? ', all in' : ''}.` : 'Code Red is off.');
        break;
      case 'start_lost_day':
        setDay({ ...day(), lostDay: true, lostDayReason: op.reason });
        done.push('Lost Day started. The rest of today is cut to the easiest salvage wins.');
        break;
      case 'add_quote':
        next.quotes.push({ id: crypto.randomUUID(), text: op.text, tags: op.tags });
        done.push('Quote saved.');
        break;
      case 'replan':
        done.push('Replanned from now.');
        break;
      case 'ask':
        question = op.question;
        break;
    }
  }
  return { next, done, cantDo: reply.unhandled, question, replanFromMin };
}

function updateEvent(next: Snapshot, op: Extract<Op, { op: 'update_event' }>, done: string[]) {
  const ev = next.events.find((e) => e.id === op.event_id)!;
  const changes: Partial<EventDef> = {
    ...(op.title !== undefined && { title: op.title }),
    ...(op.start !== undefined && { start: toMin(op.start) }),
    ...(op.end !== undefined && { end: toMin(op.end) }),
    ...(op.location !== undefined && { location: op.location }),
    ...(op.weekday !== undefined && { weekday: op.weekday }),
  };
  // Moving only the start keeps the same length.
  if (op.start !== undefined && op.end === undefined) changes.end = toMin(op.start) + (ev.end - ev.start);
  const updated = { ...ev, ...changes };
  if (op.scope === 'all' || !ev.recurringWeekly) {
    next.events = next.events.map((e) => (e.id === ev.id ? updated : e));
    done.push(`${updated.title} updated${ev.recurringWeekly ? ' for every week' : ''}: ${fmtTime(updated.start)} to ${fmtTime(updated.end)}.`);
  } else {
    const date = op.date!;
    const { weekday: _w, skipDates: _s, ...rest } = updated;
    const once: EventDef = { ...rest, id: `${ev.id}-${date}`, date, recurringWeekly: false };
    next.events = [...next.events.filter((e) => e.id !== once.id).map((e) => (e.id === ev.id ? { ...e, skipDates: [...(e.skipDates ?? []), date] } : e)), once];
    done.push(`${ev.title} on ${dateLabel(date)} moved to ${fmtTime(once.start)} to ${fmtTime(once.end)}.`);
  }
}

/** After the replan, add where not-yet anchors landed ("Cold shower set to 7:35 AM."). */
export function anchorLines(s: Snapshot, today: string, ops: Op[]): string[] {
  if (!ops.some((o) => o.op === 'set_wake_time' || o.op === 'set_anchor')) return [];
  const rec = dayOf(s, today);
  const lines: string[] = [];
  for (const [kind, label, status] of [
    ['anchor_cold_shower', 'Cold shower', rec.coldShower.done],
    ['anchor_walk', 'Walk with God', rec.walk.done],
  ] as const) {
    const b = s.blocks.find((x) => x.date === today && x.kind === kind);
    if (b && !status) lines.push(`${label} set to ${fmtTime(b.start)}.`);
  }
  return lines;
}

/**
 * After a change and the replan: what moved into new times today (from now on), so Eli sees how the day
 * reshaped. At most four, in time order.
 */
export function reshapedLine(before: Snapshot, after: Snapshot, date: string, fromMin: number): string | null {
  const was = new Map(before.blocks.filter((b) => b.date === date).map((b) => [b.id, b]));
  const quiet = new Set(['travel', 'bed', 'winddown']);
  const changed = after.blocks
    .filter((b) => b.date === date && b.end > fromMin && !quiet.has(b.kind))
    .filter((b) => {
      const old = was.get(b.id);
      return !old || old.start !== b.start || old.end !== b.end;
    })
    .sort((a, b) => a.start - b.start);
  if (!changed.length) return null;
  const list = changed.slice(0, 4).map((b) => `${b.title} ${fmtTime(b.start)}`);
  return `Day reshaped: ${list.join(', ')}${changed.length > 4 ? `, and ${changed.length - 4} more` : ''}.`;
}
