// The live-AI dump test (Part 14, tests 13 to 17), run from Settings. It only asks the AI and checks the
// replies; nothing is applied, so no data changes. About 5 AI calls (a few cents).
import type { Snapshot } from '../data/model';
import type { Now } from '../lib/clock';
import type { AI } from './ai';
import { runDump } from './pipeline';
import type { ParseReply } from './schema';

export interface LiveCase {
  name: string;
  text: string;
  check: (r: ParseReply, s: Snapshot) => string | null;
}

const has = (r: ParseReply, op: string) => r.ops.some((o) => o.op === op);

export const LIVE_CASES: LiveCase[] = [
  {
    name: '13. Wake time',
    text: 'I woke up at 7:30',
    check: (r) => (r.ops.some((o) => o.op === 'set_wake_time' && o.time === '07:30') ? null : 'Expected set_wake_time 07:30.'),
  },
  {
    name: '14. Move the library block',
    text: 'Move my library block to 1 PM',
    check: (r, s) => {
      const hasLibrary = s.blocks.some((b) => b.kind === 'library_work');
      if (has(r, 'move_block')) return null;
      if (!hasLibrary && (r.unhandled.length > 0 || has(r, 'ask'))) return null;
      return hasLibrary ? 'Expected move_block for the library block.' : 'No library block today, so it should say so.';
    },
  },
  {
    name: '15. Running late',
    text: "I'm running an hour late",
    check: (r) => (r.ops.some((o) => o.op === 'shift_day' && o.minutes === 60) ? null : 'Expected shift_day of 60 minutes.'),
  },
  {
    name: '16. Something the app cannot do',
    text: 'Text my mom happy birthday and add a task to pick up a birthday card',
    check: (r) => (r.unhandled.length > 0 && has(r, 'add_task') ? null : 'Expected the text in Couldn\'t do and one new task.'),
  },
  {
    name: '17. Brain dump of 5 items',
    text: 'Brain dump: finish the tax memo by Friday, record course module 3 by next Wednesday, email the printer about the flyers by tomorrow, pay rent by the 1st, and read chapter 9 before Thursday class.',
    check: (r) => {
      const tasks = r.ops.filter((o) => o.op === 'add_task');
      if (tasks.length !== 5) return `Expected 5 tasks, got ${tasks.length}.`;
      return tasks.every((t) => t.op === 'add_task' && t.deadline) ? null : 'Every task should have a deadline.';
    },
  },
];

export interface LiveResult {
  name: string;
  pass: boolean;
  detail: string;
  ops: string[];
}

export async function runLiveCheck(s: Snapshot, now: Now, client: Pick<AI, 'parse'>, onResult: (r: LiveResult) => void): Promise<void> {
  for (const c of LIVE_CASES) {
    const out = await runDump(c.text, s, now, client);
    if (!out.ok) {
      onResult({ name: c.name, pass: false, detail: out.message, ops: [] });
      continue;
    }
    const problem = c.check(out.reply, s);
    onResult({
      name: c.name,
      pass: problem === null,
      detail: problem ?? (out.attempts === 2 ? 'Passed on the automatic retry.' : 'Passed.'),
      ops: [...out.reply.ops.map((o) => o.op), ...out.reply.unhandled.map((u) => `couldn't do: ${u.reason}`)],
    });
  }
}
