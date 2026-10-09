-- The contract stays editable until Eli locks it.
alter table public.contract add column if not exists locked boolean not null default false;
