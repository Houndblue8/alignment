// Coach line: one short message in the coach tone (Appendix A). The app caches it per day.
import { apiErrorMessage, claude, createWithFallback, type Anthropic } from '../_shared/anthropic.ts';
import { cors, env, fail, json } from '../_shared/http.ts';
import { COACH_SYSTEM, LETTER_SYSTEM, SCOUT_SYSTEM } from '../_shared/prompts.ts';

interface Body {
  kind?: 'daily' | 'caption' | 'week' | 'month';
  name?: string;
  whyShort?: string;
  identity?: string;
  facts?: Record<string, unknown>;
  draft?: Record<string, string>;
}

const line = { type: 'string' };
const reportSchema = {
  type: 'object',
  properties: { held: line, slipped: line, adjustment: line, vision: line },
  required: ['held', 'slipped', 'adjustment', 'vision'],
  additionalProperties: false,
};

/** Sunday scouting report (Appendix E 3). The app validates the reply and keeps its own draft on failure. */
async function scout(body: Body): Promise<Response> {
  const res = await createWithFallback({
    model: env('ANTHROPIC_MODEL_COACH'),
    max_tokens: 1500,
    system: SCOUT_SYSTEM,
    tools: [{ name: 'submit_report', description: 'The four lines of the scouting report.', input_schema: reportSchema, strict: true }],
    tool_choice: { type: 'auto' },
    messages: [
      {
        role: 'user',
        content: `Name: ${body.name ?? 'Eli'}
His why: ${body.whyShort ?? ''}
His identity: ${body.identity ?? ''}
Week facts (JSON): ${JSON.stringify(body.facts ?? {})}
Draft (JSON): ${JSON.stringify(body.draft ?? {})}`,
      },
    ],
  });
  if (res.stop_reason === 'refusal') return fail('No report this week.', 422);
  const call = res.content.find((b) => b.type === 'tool_use' && b.name === 'submit_report');
  if (!call || call.type !== 'tool_use') return fail('The coach did not return a report.', 502);
  return json({ report: call.input });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return fail('Use POST.', 405);
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return fail('The request was not valid JSON.', 400);
  }
  if (body.kind === 'week') {
    try {
      return await scout(body);
    } catch (e) {
      console.error('scout', e);
      return fail(apiErrorMessage(e), 502);
    }
  }
  const ask =
    body.kind === 'month'
      ? "Write his monthly recap letter: 3 to 5 short sentences, under 110 words, from his coach. Name what the numbers show, honor what held, name one thing to build next month, and tie it to his why and to God's faithfulness. Use only the facts given; never invent events or numbers. If still_going is true, it is the month so far. No greeting line and no sign-off."
      : body.kind === 'caption'
      ? 'Ask one short question that helps him caption tonight\'s photo, tied to his vision.'
      : "Write this morning's line for Home: one sentence, under 30 words, direct and personal, tied to his why. Use only the facts given: never invent tasks, events or results, and only name tasks that are in today_big3. If yesterday is 'none', do not mention yesterday. It should hit the heart and never shame.";
  try {
    const res = await claude().messages.create({
      model: env('ANTHROPIC_MODEL_COACH'),
      max_tokens: body.kind === 'month' ? 2000 : 300,
      output_config: { effort: 'low' },
      system: body.kind === 'month' ? LETTER_SYSTEM : COACH_SYSTEM,
      messages: [
        {
          role: 'user',
          content: `${ask}\nName: ${body.name ?? 'Eli'}\nHis why: ${body.whyShort ?? ''}\nFacts (JSON): ${JSON.stringify(body.facts ?? {})}`,
        },
      ],
    } as Anthropic.MessageCreateParamsNonStreaming);
    if (res.stop_reason === 'refusal') return fail('No coach line today.', 422);
    const text = res.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as Anthropic.TextBlock).text)
      .join(' ')
      .replace(/\s*[–—]\s*/g, ', ')
      .trim();
    // Cut off by the token limit: keep the complete sentences only.
    const whole = res.stop_reason === 'max_tokens' ? text.slice(0, text.lastIndexOf('.') + 1) || text : text;
    return json({ text: whole });
  } catch (e) {
    console.error('coach', e);
    return fail(apiErrorMessage(e), 502);
  }
});
