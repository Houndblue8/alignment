-- Oct 12: the photo reminder at a surprise time each day, and the day stats start counting.
alter table public.settings add column if not exists photo_random boolean not null default true;
alter table public.settings add column if not exists stats_from date;
