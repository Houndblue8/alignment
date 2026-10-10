-- Pillars (Oct 10): small steps Eli logs toward a pillar, and the kaizen line written for tomorrow.
alter table public.day_records add column if not exists pillar_steps jsonb not null default '[]'::jsonb;
alter table public.day_records add column if not exists kaizen text;
