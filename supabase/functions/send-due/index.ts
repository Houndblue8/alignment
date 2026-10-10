// Called every minute by pg_cron (with the shared CRON_SECRET). Works out which reminders are due right now
// from each user's plan, logs each one once, and sends it to every device that enabled notifications.
import { createClient } from 'npm:@supabase/supabase-js@2.117.3';
import { env, fail, json } from '../_shared/http.ts';
import { sendPush, type Subscription } from '../_shared/push.ts';
import { dueNow, remindersFor } from '../_shared/reminders.ts';

/** Local date and minutes in Los Angeles. */
function laNow(): { date: string; min: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, min: Number(parts.hour) * 60 + Number(parts.minute) };
}

const yesterday = (date: string) => new Date(Date.parse(`${date}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10);

/** The reminder's due time as a real timestamp, for the once-only log. */
function dueAt(date: string, min: number): string {
  // Interpret date+minutes in Los Angeles: find the UTC offset for that date at noon.
  const probe = new Date(`${date}T12:00:00Z`);
  const laNoon = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: '2-digit', hourCycle: 'h23' }).format(probe));
  const offsetH = 12 - laNoon; // 7 in summer, 8 in winter
  return new Date(Date.parse(`${date}T00:00:00Z`) + (min + offsetH * 60) * 60_000).toISOString();
}

Deno.serve(async (req) => {
  if (req.headers.get('x-cron-secret') !== env('CRON_SECRET')) return fail('Not allowed.', 401);
  const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
  const now = laNow();
  const { data: subs, error } = await db.from('push_subscriptions').select('user_id, endpoint, keys');
  if (error) return fail(error.message);
  const users = [...new Set((subs ?? []).map((s) => s.user_id as string))];
  let sent = 0;

  for (const user of users) {
    const [{ data: settings }, { data: days }, { data: blocks }, { data: photo }] = await Promise.all([
      db.from('settings').select('*').eq('user_id', user).maybeSingle(),
      db.from('day_records').select('date, checkin_done, cold_shower, walk, plan, big3').eq('user_id', user).in('date', [now.date, yesterday(now.date)]),
      db.from('blocks').select('id, start_min, end_min, kind, title, status, source, pinned, task_id, place_id').eq('user_id', user).eq('date', now.date),
      db.from('photos').select('date').eq('user_id', user).eq('date', now.date).maybeSingle(),
    ]);
    if (!settings) continue;
    const today = (days ?? []).find((d) => d.date === now.date);
    const prev = (days ?? []).find((d) => d.date === yesterday(now.date));
    const list = remindersFor({
      date: now.date,
      prefs: { open: settings.notify_open !== false, photo: settings.notify_photo, morning: settings.notify_morning, evening: settings.notify_evening, bedtime: settings.notify_bedtime, blocks: settings.notify_blocks },
      photoMin: settings.photo_reminder_min,
      photoTaken: !!photo,
      expectedWakeMin: prev?.plan?.bedtime?.wakeMin ?? settings.wake_target_min,
      checkinDone: !!today?.checkin_done,
      anchorsDone: !!(today?.cold_shower?.done && today?.walk?.done),
      bedMin: today?.plan?.bedtime?.bedMin ?? null,
      blocks: (blocks ?? []).map((b) => ({ id: b.id, start: b.start_min, end: b.end_min, kind: b.kind, title: b.title, status: b.status, source: b.source, pinned: b.pinned, taskId: b.task_id, placeId: b.place_id })),
      big3: ((today?.big3 ?? []) as { taskId: string }[]).map((i) => i.taskId),
    });

    for (const r of dueNow(list, now.min)) {
      // Log first; only a new row gets sent, so a reminder never goes out twice.
      const { data: row } = await db
        .from('notification_log')
        .upsert({ user_id: user, kind: r.key, due_at: dueAt(now.date, r.dueMin), payload: r }, { onConflict: 'user_id,kind,due_at', ignoreDuplicates: true })
        .select('id')
        .maybeSingle();
      if (!row) continue;
      for (const s of (subs ?? []).filter((x) => x.user_id === user)) {
        const res = await sendPush({ endpoint: s.endpoint, keys: s.keys } as Subscription, { title: r.title, body: r.body, url: r.url, tag: r.key });
        if (res === 'gone') await db.from('push_subscriptions').delete().eq('user_id', user).eq('endpoint', s.endpoint);
        else if (res !== 'ok') console.error(res);
        else sent += 1;
      }
      await db.from('notification_log').update({ sent_at: new Date().toISOString() }).eq('id', row.id);
    }
  }
  return json({ ok: true, at: now, users: users.length, sent });
});
