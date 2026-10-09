-- Alignment schema. Single user, but every row is owned by a user id and protected by RLS.
-- Schedule times are a local date (America/Los_Angeles) plus minutes from midnight, never UTC timestamps.

create table public.settings (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  theme text not null default 'gold-cream',
  outreach_count int not null default 10,
  wake_target_min int not null default 390,
  sleep_hours numeric not null default 8,
  latest_wake_min int not null default 540,
  practice_block text not null default 'A' check (practice_block in ('A', 'B')),
  code_red boolean not null default false,
  code_red_level text not null default 'standard' check (code_red_level in ('standard', 'severe')),
  graduation_date date,
  tz text not null default 'America/Los_Angeles',
  last_open_date date,
  seeded_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.vision (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  identity text not null default '',
  why text not null default '',
  why_short text not null default '',
  end_result text not null default '',
  perfect_day text not null default '',
  best_version jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.contract (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  terms jsonb not null default '[]'::jsonb,
  signed_name text,
  signed_at timestamptz,
  graduation_date date,
  profit_target numeric not null default 20000,
  first_milestone numeric not null default 2000,
  profit_earned numeric not null default 0,
  updated_at timestamptz not null default now()
);

create table public.places (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  name text not null,
  notes text not null default '',
  minutes_from_home int not null,
  minutes_from_campus int not null,
  good_for text[] not null default '{}',
  primary key (user_id, id)
);

create table public.tasks (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null default gen_random_uuid()::text,
  title text not null,
  journey text not null check (journey in ('body', 'sport', 'shs', 'school', 'faith', 'life')),
  importance int not null check (importance between 1 and 5),
  deadline date,
  estimated_minutes int not null default 30 check (estimated_minutes > 0),
  steps jsonb not null default '[]'::jsonb,
  deferral_count int not null default 0,
  status text not null default 'open' check (status in ('open', 'done', 'dropped', 'delegated')),
  work_type text not null default 'deep' check (work_type in ('deep', 'easy', 'errand')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (user_id, id)
);

create table public.events (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  title text not null,
  kind text not null check (kind in ('class', 'exam', 'practice', 'event', 'social')),
  weekday int check (weekday between 0 and 6),
  date date,
  end_date date,
  start_min int not null,
  end_min int not null,
  location text not null default 'home',
  rank_key text not null,
  immovable boolean not null default false,
  overridable_by_code_red boolean not null default true,
  recurring_weekly boolean not null default false,
  active_from date,
  active_to date,
  skip_dates date[] not null default '{}',
  practice_block text check (practice_block in ('A', 'B')),
  all_day boolean not null default false,
  no_work boolean not null default false,
  away boolean not null default false,
  tentative boolean not null default false,
  primary key (user_id, id),
  check (end_min > start_min),
  check ((recurring_weekly and weekday is not null) or (not recurring_weekly and date is not null))
);

create table public.day_records (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  date date not null,
  wake_min int,
  checkin_done boolean not null default false,
  cold_shower jsonb not null default '{"done": false}'::jsonb,
  walk jsonb not null default '{"done": false}'::jsonb,
  big3 jsonb not null default '[]'::jsonb,
  result text check (result in ('win', 'half', 'loss')),
  lost_day boolean not null default false,
  lost_day_reason text,
  code_red boolean not null default false,
  notes text not null default '',
  -- Planner output that is not blocks: warnings, notes, bedtime, below the line.
  plan jsonb not null default '{}'::jsonb,
  isaac_answer text check (isaac_answer in ('yes', 'no')),
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);

create table public.blocks (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  date date not null,
  start_min int not null,
  end_min int not null,
  kind text not null,
  title text not null,
  place_id text,
  task_id text,
  event_id text,
  status text not null default 'planned' check (status in ('planned', 'in_progress', 'done', 'skipped')),
  pinned boolean not null default false,
  source text not null default 'planner' check (source in ('planner', 'manual')),
  howto jsonb,
  primary key (user_id, id),
  check (end_min > start_min)
);
create index blocks_by_date on public.blocks (user_id, date);

create table public.quotes (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null default gen_random_uuid()::text,
  text text not null,
  tags text[] not null default '{general}',
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table public.ops_log (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  input_text text not null,
  ops jsonb not null default '[]'::jsonb,
  unhandled jsonb not null default '[]'::jsonb,
  snapshot_before jsonb not null default '{}'::jsonb,
  undone boolean not null default false,
  primary key (user_id, id)
);

create table public.photos (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  date date not null,
  storage_path text not null,
  caption text not null default '',
  milestone boolean not null default false,
  missed_ritual boolean not null default false,
  primary key (user_id, date)
);

create table public.reports (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  type text not null check (type in ('weekly', 'monthly')),
  period_start date not null,
  body jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, type, period_start)
);

create table public.push_subscriptions (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  endpoint text not null,
  keys jsonb not null,
  device_label text not null default '',
  created_at timestamptz not null default now(),
  primary key (user_id, endpoint)
);

create table public.notification_log (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id uuid not null default gen_random_uuid(),
  kind text not null,
  due_at timestamptz not null,
  sent_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  primary key (user_id, id)
);

create table public.coach_cache (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  date date not null,
  kind text not null,
  text text not null,
  primary key (user_id, date, kind)
);

-- Row Level Security: each user sees and changes only their own rows.
do $$
declare t text;
begin
  foreach t in array array[
    'settings', 'vision', 'contract', 'places', 'tasks', 'events', 'day_records', 'blocks',
    'quotes', 'ops_log', 'photos', 'reports', 'push_subscriptions', 'notification_log', 'coach_cache'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t
    );
  end loop;
end $$;
