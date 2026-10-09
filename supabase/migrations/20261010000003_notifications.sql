-- Notifications (Phase 5, Appendix E 4).
alter table public.settings
  add column if not exists notify_morning boolean not null default true,
  add column if not exists notify_evening boolean not null default true,
  add column if not exists notify_bedtime boolean not null default true,
  add column if not exists notify_blocks boolean not null default false;

-- One send per reminder: the sender inserts here first and only sends when the insert is new.
create unique index if not exists notification_log_once on public.notification_log (user_id, kind, due_at);

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Every minute, call the send-due Edge Function with the shared secret kept in the Vault
-- (created once outside this file: vault.create_secret(<secret>, 'cron_secret')).
select cron.unschedule('send-due-notifications') where exists (select 1 from cron.job where jobname = 'send-due-notifications');
select cron.schedule(
  'send-due-notifications',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://rmuknpoaqjsdtpcwjblj.supabase.co/functions/v1/send-due',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
  $$
);

notify pgrst, 'reload schema';
