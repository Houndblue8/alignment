import Anthropic from 'npm:@anthropic-ai/sdk@0.133.0';
import { env } from './http.ts';

export { Anthropic };

let client: Anthropic | null = null;
export function claude(): Anthropic {
  client ??= new Anthropic({ apiKey: env('ANTHROPIC_API_KEY'), maxRetries: 2 });
  return client;
}

/** Plain-language message for an API failure. */
export function apiErrorMessage(e: unknown): string {
  if (e instanceof Anthropic.AuthenticationError) return 'The AI key is missing or wrong. Check ANTHROPIC_API_KEY in the Supabase secrets.';
  if (e instanceof Anthropic.PermissionDeniedError) return 'The AI key does not have access to this model.';
  if (e instanceof Anthropic.RateLimitError) return 'The AI is busy or the monthly spend limit was reached. Try again in a minute.';
  if (e instanceof Anthropic.BadRequestError) return `The AI rejected the request: ${e.message}`;
  if (e instanceof Anthropic.APIConnectionError) return 'Could not reach the AI. Try again.';
  if (e instanceof Anthropic.APIError) return `The AI had a problem (${e.status}). Try again.`;
  return e instanceof Error ? e.message : String(e);
}
