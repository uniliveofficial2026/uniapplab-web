-- Real-time app data sync (posts, messages, settings, …) per authenticated user.
-- Run after profiles migration. Enable Realtime if postgres_changes does not fire.

create table if not exists public.user_app_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists user_app_state_updated_at_idx on public.user_app_state (updated_at desc);

alter table public.user_app_state enable row level security;

drop policy if exists "user_app_state_select_own" on public.user_app_state;
create policy "user_app_state_select_own"
  on public.user_app_state for select
  using (auth.uid() = user_id);

drop policy if exists "user_app_state_insert_own" on public.user_app_state;
create policy "user_app_state_insert_own"
  on public.user_app_state for insert
  with check (auth.uid() = user_id);

drop policy if exists "user_app_state_update_own" on public.user_app_state;
create policy "user_app_state_update_own"
  on public.user_app_state for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.set_user_app_state_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_app_state_updated_at on public.user_app_state;
create trigger user_app_state_updated_at
  before update on public.user_app_state
  for each row execute function public.set_user_app_state_updated_at();

alter table public.user_app_state replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.user_app_state;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
