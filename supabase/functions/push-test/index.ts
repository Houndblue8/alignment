// Sends one test notification to the signed-in user's devices (Settings, Notifications, Send a test).
import { createClient } from 'npm:@supabase/supabase-js@2.117.3';
import { cors, env, fail, json } from '../_shared/http.ts';
import { sendPush, type Subscription } from '../_shared/push.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const auth = req.headers.get('Authorization') ?? '';
  const asUser = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: who } = await asUser.auth.getUser();
  if (!who.user) return fail('Sign in first.', 401);
  const { data: subs, error } = await asUser.from('push_subscriptions').select('endpoint, keys');
  if (error) return fail(error.message);
  if (!subs?.length) return fail('This account has no device with notifications turned on.', 400);
  const results = [];
  for (const s of subs) {
    const r = await sendPush({ endpoint: s.endpoint, keys: s.keys } as Subscription, {
      title: 'Notifications are on',
      body: 'Reminders for the morning, close-out and bedtime will arrive here.',
      url: '/settings',
      tag: 'test',
    });
    if (r === 'gone') await asUser.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
    results.push(r);
  }
  const ok = results.filter((r) => r === 'ok').length;
  return ok ? json({ sent: ok }) : fail(`No notification was delivered. ${results.join(' ')}`, 502);
});
