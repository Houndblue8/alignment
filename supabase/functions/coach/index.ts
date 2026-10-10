// Coach line: one short message in the coach tone (Appendix A). The app caches it per day.
import { apiErrorMessage, claude, createWithFallback, type Anthropic } from '../_shared/anthropic.ts';
import { cors, env, fail, json } from '../_shared/http.ts';
import { COACH_SYSTEM, SCOUT_SYSTEM } from '../_shared/prompts.ts';

interface Body {
  kind?: 'daily' | 'caption' | 'week';
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
    body.kind === 'caption'
      ? 'Ask one short question that helps him caption tonight\'s photo, tied to his vision.'
      : "Write this morning's line for Home: direct, personal, tied to his why. It should hit the heart and never shame.";
  try {
    const res = await claude().messages.create({
      model: env('ANTHROPIC_MODEL_COACH'),
      max_tokens: 300,
      output_config: { effort: 'low' },
      system: COACH_SYSTEM,
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
    return json({ text });
  } catch (e) {
    console.error('coach', e);
    return fail(apiErrorMessage(e), 502);
  }
});
