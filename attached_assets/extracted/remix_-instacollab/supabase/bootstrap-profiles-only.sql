-- MINIMUM fix for "Could not find the table public.profiles" (idempotent).
-- Supabase → SQL Editor → paste ALL of this → Run → hard-refresh app

create or replace function public.bootstrap_sync_rls_policy(
  p_table regclass,
  p_name text,
  p_cmd text,
  p_using text default null,
  p_with_check text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  stmt text;
begin
  execute format('drop policy if exists %I on %s', p_name, p_table);
  stmt := format('create policy %I on %s for %s', p_name, p_table, lower(p_cmd));
  if lower(p_cmd) in ('select', 'update', 'delete', 'all') and p_using is not null then
    stmt := stmt || format(' using (%s)', p_using);
  end if;
  if p_with_check is not null then
    stmt := stmt || format(' with check (%s)', p_with_check);
  end if;
  execute stmt;
exception
  when duplicate_object then
    execute format('drop policy if exists %I on %s', p_name, p_table);
    execute stmt;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  display_name text not null,
  avatar_url text,
  bio text default '' not null,
  profile_setup_complete boolean default false not null,
  public_user_id text,
  public_user_id_changed_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  constraint profiles_username_lowercase check (username = lower(username)),
  constraint profiles_username_format check (username ~ '^[a-z0-9_]{3,24}$')
);

create unique index if not exists profiles_username_key on public.profiles (username);

alter table public.profiles enable row level security;

select public.bootstrap_sync_rls_policy(
  'public.profiles'::regclass,
  'profiles_select_public',
  'select',
  'true'
);

select public.bootstrap_sync_rls_policy(
  'public.profiles'::regclass,
  'profiles_insert_own',
  'insert',
  null,
  'auth.uid() = id'
);

select public.bootstrap_sync_rls_policy(
  'public.profiles'::regclass,
  'profiles_update_own',
  'update',
  'auth.uid() = id',
  'auth.uid() = id'
);

notify pgrst, 'reload schema';
