// Delegate (Part 8 step 11): writes the steps and drafts any message so Eli only executes.
import { apiErrorMessage, claude, type Anthropic } from '../_shared/anthropic.ts';
import { cors, env, fail, json } from '../_shared/http.ts';
import { DELEGATE_SYSTEM } from '../_shared/prompts.ts';

const schema = {
  type: 'object',
  properties: {
    steps: {
      type: 'array',
      minItems: 1,
      maxItems: 7,
      items: {
        type: 'object',
        properties: { text: { type: 'string' }, guess: { type: 'boolean' } },
        required: ['text', 'guess'],
        additionalProperties: false,
      },
    },
    draft: { type: ['string', 'null'] },
  },
  required: ['steps', 'draft'],
  additionalProperties: false,
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return fail('Use POST.', 405);
  let body: { task?: { title?: string; journey?: string; notes?: string; steps?: unknown[] } };
  try {
    body = await req.json();
  } catch {
    return fail('The request was not valid JSON.', 400);
  }
  if (!body.task?.title) return fail('No task given.', 400);
  try {
    const params = {
      model: env('ANTHROPIC_MODEL_PARSE'),
      max_tokens: 4000,
      output_config: { effort: 'medium' },
      system: DELEGATE_SYSTEM,
      tools: [{ name: 'submit_delegation', description: 'Steps for the task and an optional message draft.', input_schema: schema, strict: true }],
      tool_choice: { type: 'auto' },
      messages: [{ role: 'user', content: `Task (JSON): ${JSON.stringify(body.task)}` }],
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    };
    const res = await claude().beta.messages.create(params as unknown as Anthropic.Beta.MessageCreateParamsNonStreaming);
    if (res.stop_reason === 'refusal') return fail('The AI declined this task. Try rewording it.', 422);
    const call = res.content.find((b) => b.type === 'tool_use' && b.name === 'submit_delegation');
    if (!call || call.type !== 'tool_use') return fail('The AI did not return steps. Try again.', 502);
    return json(call.input);
  } catch (e) {
    console.error('delegate', e);
    return fail(apiErrorMessage(e), 502);
  }
});
