// Talk box pipeline: words + context -> AI -> check -> (one retry with the errors) -> validated reply.
import type { Snapshot } from '../data/model';
import type { Now } from '../lib/clock';
import type { AI } from './ai';
import { buildContext } from './context';
import type { ParseReply } from './schema';
import { checkReply } from './validate';

export type DumpOutcome = { ok: true; reply: ParseReply; attempts: number } | { ok: false; message: string; errors: string[] };

export async function runDump(text: string, s: Snapshot, now: Now, client: Pick<AI, 'parse'>): Promise<DumpOutcome> {
  const context = buildContext(s, now);
  let raw: unknown;
  try {
    raw = await client.parse({ text, context });
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e), errors: [] };
  }
  const first = checkReply(raw, s, now);
  if (first.ok) return { ok: true, reply: first.reply, attempts: 1 };

  let retry: unknown;
  try {
    retry = await client.parse({ text, context, previousErrors: first.errors, previousReply: raw });
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e), errors: first.errors };
  }
  const second = checkReply(retry, s, now);
  if (second.ok) return { ok: true, reply: second.reply, attempts: 2 };
  return { ok: false, message: 'The reply did not check out twice, so nothing was changed. Your words are still in the box. Try rewording.', errors: second.errors };
}
