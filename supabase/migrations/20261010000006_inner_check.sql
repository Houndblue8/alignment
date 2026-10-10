-- The fire (Oct 10): the night check of Mind, Heart and Spirit (1 to 5) and an optional line.
alter table public.day_records add column if not exists inner_check jsonb;
