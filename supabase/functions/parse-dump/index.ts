// Talk box: turns Eli's words into operations. One model call per request; the app validates the reply
// and calls again at most once with the validation errors.
import schema from '../_shared/ops.schema.json' with { type: 'json' };
import { apiErrorMessage, createWithFallback, type Anthropic } from '../_shared/anthropic.ts';
import { cors, env, fail, json } from '../_shared/http.ts';
import { PARSE_SYSTEM } from '../_shared/prompts.ts';

interface Body {
  text?: string;
  context?: unknown;
  previousErrors?: string[];
  previousReply?: unknown;
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
  const text = (body.text ?? '').trim();
  if (!text || text.length > 4000) return fail('Say something between 1 and 4000 characters.', 400);

  const content: Anthropic.Beta.BetaTextBlockParam[] = [
    { type: 'text', text: `Context (JSON):\n${JSON.stringify(body.context ?? {})}` },
    { type: 'text', text: `What Eli said:\n${text}` },
  ];
  if (body.previousErrors?.length) {
    content.push({
      type: 'text',
      text:
        `Your previous submit_ops call was rejected by the app for these reasons:\n- ${body.previousErrors.join('\n- ')}\n` +
        `Previous call input: ${JSON.stringify(body.previousReply ?? null).slice(0, 6000)}\n` +
        'Call submit_ops again with a corrected reply. Anything you cannot express correctly goes in unhandled with the reason.',
    });
  }

  try {
    // Sonnet 5.5 rejects forced tool_choice, so the tool is offered with auto and the prompt requires it.
    // The app validates every reply, so a missing or malformed call is caught and retried once there.
    const params = {
      model: env('ANTHROPIC_MODEL_PARSE'),
      max_tokens: 8000,
      output_config: { effort: 'medium' },
      system: [{ type: 'text', text: PARSE_SYSTEM, cache_control: { type: 'ephemeral' } }],
      tools: [
        {
          name: 'submit_ops',
          description: "Submit the operations for what Eli said, everything that could not be handled, and a one-line summary.",
          input_schema: schema,
        },
      ],
      tool_choice: { type: 'auto' },
      messages: [{ role: 'user', content }],
    };
    // If a safety classifier declines, the API reruns the request on a fallback model (when the key allows it).
    const res = await createWithFallback(params);

    if (res.stop_reason === 'refusal') return fail('The AI declined to handle that. Try rewording it.', 422);
    const call = res.content.find((b) => b.type === 'tool_use' && b.name === 'submit_ops');
    if (!call || call.type !== 'tool_use') {
      // Shape the miss as an invalid reply so the app's validation triggers its one retry.
      return json({ error_note: 'The model did not call submit_ops.', stop_reason: res.stop_reason });
    }
    console.log(JSON.stringify({ fn: 'parse-dump', usage: res.usage, model: res.model }));
    return json(call.input);
  } catch (e) {
    console.error('parse-dump', e);
    return fail(apiErrorMessage(e), 502);
  }
});
