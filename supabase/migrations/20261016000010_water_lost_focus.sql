-- Oct 16: a third morning anchor (a glass of water) and the Lost Day's one faith focus.
-- lost_focus: { text, done, surrender, big3 } where big3 is the day's original Big 3, set aside (restored if the
-- Lost Day is ended).
alter table day_records add column if not exists water jsonb not null default '{"done": false}'::jsonb;
alter table day_records add column if not exists lost_focus jsonb;
