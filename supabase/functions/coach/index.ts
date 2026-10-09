// Coach line: one short message in the coach tone (Appendix A). The app caches it per day.
import { apiErrorMessage, claude, type Anthropic } from '../_shared/anthropic.ts';
import { cors, env, fail, json } from '../_shared/http.ts';
import { COACH_SYSTEM } from '../_shared/prompts.ts';

interface Body {
  kind?: 'daily' | 'caption';
  name?: string;
  whyShort?: string;
  facts?: Record<string, unknown>;
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
