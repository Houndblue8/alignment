-- Oct 12: Body and Sports become Athletics (id 'sport'); the 'body' id becomes Stewardship.
-- Pillar edits: rules that always apply, and edits for one day.
alter table public.settings add column if not exists pillar_rules jsonb not null default '[]'::jsonb;
alter table public.day_records add column if not exists step_edits jsonb not null default '[]'::jsonb;
-- One-time data move, run once on 2026-10-12 (not repeatable: afterwards 'body' means Stewardship):
--   update public.tasks set journey = 'sport' where journey = 'body';
--   update public.settings set weekly_targets = coalesce(weekly_targets, '{}'::jsonb) || '{"sport": 10, "body": 5}'::jsonb;
