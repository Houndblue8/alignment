// The talk box operations (Part 8 step 4). One Zod schema is the single source: it validates replies in
// the app and is exported as JSON Schema for the AI tool definition (npm run gen:schema).
import { z } from 'zod';

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'time must be HH:MM, 24 hour');
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD');
const journey = z.enum(['body', 'sport', 'shs', 'school', 'faith', 'life']);
const src = { source_text: z.string().min(1).describe('The exact clause of what Eli said that this operation comes from.') };

export const OpSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('set_wake_time'), ...src, time }).describe('Eli says when he woke up today.'),
  z
    .object({ op: z.literal('set_anchor'), ...src, anchor: z.enum(['cold_shower', 'walk']), done: z.boolean(), time: time.nullable() })
    .describe('Cold shower or walk with God done (or not). time only if Eli said when.'),
  z
    .object({
      op: z.literal('add_task'),
      ...src,
      title: z.string().min(1).max(120),
      journey,
      importance: z.number().int().min(1).max(5),
      deadline: date.nullable(),
      minutes: z.number().int().min(5).max(600),
      work_type: z.enum(['deep', 'easy', 'errand']),
      steps: z.array(z.object({ text: z.string().min(1), guess: z.boolean() })).max(8),
    })
    .describe('A new task. Grade importance 1 to 5 against the vision. Steps you had to guess get guess: true.'),
  z
    .object({
      op: z.literal('update_task'),
      ...src,
      task_id: z.string(),
      title: z.string().min(1).max(120).optional(),
      journey: journey.optional(),
      importance: z.number().int().min(1).max(5).optional(),
      deadline: date.nullable().optional(),
      minutes: z.number().int().min(5).max(600).optional(),
    })
    .describe('Change fields of an existing open task.'),
  z.object({ op: z.literal('complete_task'), ...src, task_id: z.string() }).describe('Eli finished a task.'),
  z.object({ op: z.literal('delete_task'), ...src, task_id: z.string() }).describe('Eli wants a task gone.'),
  z
    .object({
      op: z.literal('add_event'),
      ...src,
      title: z.string().min(1).max(120),
      date: date.nullable(),
      weekday: z.number().int().min(0).max(6).nullable(),
      start: time,
      end: time,
      location: z.string().nullable(),
      kind: z.enum(['event', 'social', 'class', 'practice', 'exam']),
      immovable: z.boolean(),
    })
    .describe('A fixed commitment. One-time: date set, weekday null. Weekly: weekday set (0 = Sunday), date null. location is a place id or null.'),
  z
    .object({
      op: z.literal('update_event'),
      ...src,
      event_id: z.string(),
      scope: z.enum(['this', 'all']),
      date: date.nullable(),
      title: z.string().min(1).max(120).optional(),
      start: time.optional(),
      end: time.optional(),
      location: z.string().optional(),
      weekday: z.number().int().min(0).max(6).optional(),
    })
    .describe('Change an event. scope this = only the occurrence on date; all = every occurrence.'),
  z
    .object({ op: z.literal('delete_event'), ...src, event_id: z.string(), scope: z.enum(['this', 'all']), date: date.nullable() })
    .describe('Remove an event: only the occurrence on date (this) or every occurrence (all).'),
  z.object({ op: z.literal('move_block'), ...src, block_id: z.string(), start: time }).describe('Move a planned block to a new start time. Everything after it is replanned.'),
  z.object({ op: z.literal('resize_block'), ...src, block_id: z.string(), minutes: z.number().int().min(5).max(600) }).describe('Change how long a block lasts.'),
  z.object({ op: z.literal('delete_block'), ...src, block_id: z.string() }).describe('Take a block off the plan (for example "I skipped lunch").'),
  z
    .object({ op: z.literal('add_block'), ...src, title: z.string().min(1).max(120), date, start: time, end: time, location: z.string().nullable() })
    .describe('Put something on the plan at a set time that is not a task or a recurring event.'),
  z.object({ op: z.literal('set_big3'), ...src, task_ids: z.array(z.string()).min(1).max(3) }).describe("Set today's Big 3, in order."),
  z.object({ op: z.literal('shift_day'), ...src, minutes: z.number().int().min(5).max(240) }).describe('Eli is running behind by this many minutes.'),
  z.object({ op: z.literal('set_practice_block'), ...src, block: z.enum(['A', 'B']) }).describe('Which club volleyball practice block applies.'),
  z.object({ op: z.literal('set_code_red'), ...src, on: z.boolean(), level: z.enum(['standard', 'severe']).nullable() }).describe('Code Red on or off. severe = all in, practices pause too.'),
  z.object({ op: z.literal('start_lost_day'), ...src, reason: z.string().min(1).max(140) }).describe('Start a Lost Day with a one-line reason.'),
  z
    .object({ op: z.literal('add_quote'), ...src, text: z.string().min(1), tags: z.array(z.enum(['regret', 'hard_day', 'win', 'general'])).min(1) })
    .describe('Save a quote.'),
  z.object({ op: z.literal('replan'), ...src }).describe('Rebuild the rest of today from now.'),
  z.object({ op: z.literal('ask'), ...src, question: z.string().min(1).max(200) }).describe('One short clarifying question when something is ambiguous. At most one.'),
]);

export const ParseReplySchema = z.object({
  ops: z.array(OpSchema),
  unhandled: z
    .array(z.object({ text: z.string().min(1), reason: z.string().min(1) }))
    .describe('Every clause that did not become an operation, with a plain reason.'),
  summary: z.string().describe('One short line summarizing what will change.'),
});

export type Op = z.infer<typeof OpSchema>;
export type OpName = Op['op'];
export type ParseReply = z.infer<typeof ParseReplySchema>;

/** JSON Schema for the submit_ops tool input. */
export function toolInputSchema(): Record<string, unknown> {
  const s = z.toJSONSchema(ParseReplySchema, { target: 'draft-2020-12' }) as Record<string, unknown>;
  delete s.$schema;
  return s;
}
