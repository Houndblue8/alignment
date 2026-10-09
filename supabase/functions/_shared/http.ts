// CORS and JSON helpers shared by the Edge Functions. Supabase checks the user's sign-in (JWT) before
// these run, so only Eli's signed-in app can call them.
export const cors: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

/** A plain-language error the app shows on screen. */
export const fail = (message: string, status = 500): Response => json({ error: message }, status);

export function env(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`${name} is not set in the Edge Function secrets.`);
  return v;
}
