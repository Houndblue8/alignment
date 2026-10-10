-- Weekly temple and open time (Oct 10).
-- Weekly pillar targets (editable in Settings) and the open-time notification switch.
alter table public.settings add column if not exists weekly_targets jsonb;
alter table public.settings add column if not exists notify_open boolean not null default true;
-- The night tap: pillars Eli showed up for that day beyond what the app could see.
alter table public.day_records add column if not exists showed_up jsonb not null default '[]'::jsonb;
-- Finished temples are saved as a few numbers per week.
alter table public.reports drop constraint if exists reports_type_check;
alter table public.reports add constraint reports_type_check check (type in ('weekly', 'monthly', 'temple'));
