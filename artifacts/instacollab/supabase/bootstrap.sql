-- InstaCollab — one-shot cloud database bootstrap (idempotent, safe to re-run).
-- Supabase Dashboard → SQL Editor → New query → paste this entire file → Run.
-- If policies already exist and you only need a quick fix, run repair-policies.sql instead.

-- ─── helpers ────────────────────────────────────────────────────────────────

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

-- ─── profiles ───────────────────────────────────────────────────────────────

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

alter table public.profiles
  add column if not exists public_user_id text,
  add column if not exists public_user_id_changed_at timestamptz;

update public.profiles
set public_user_id = username
where public_user_id is null or public_user_id = '';

create unique index if not exists profiles_username_key on public.profiles (username);

create unique index if not exists profiles_public_user_id_key
  on public.profiles (public_user_id)
  where public_user_id is not null and public_user_id <> '';

do $$
begin
  alter table public.profiles drop constraint if exists profiles_public_user_id_format;
  alter table public.profiles
    add constraint profiles_public_user_id_format check (
      public_user_id is null
      or (
        public_user_id = lower(public_user_id)
        and public_user_id ~ '^[a-z0-9_]{3,24}$'
      )
    );
exception
  when duplicate_object then null;
end $$;

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

create or replace function public.set_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_profiles_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb;
  uname text;
  dname text;
  avatar text;
  apple_name text;
begin
  meta := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  uname := lower(regexp_replace(
    coalesce(meta->>'username', split_part(coalesce(new.email, ''), '@', 1)),
    '[^a-z0-9_]', '_', 'g'
  ));
  if length(uname) < 3 then
    uname := 'user_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;
  apple_name := nullif(trim(both from concat_ws(' ',
    meta#>>'{name,firstName}',
    meta#>>'{name,lastName}'
  )), '');
  dname := coalesce(
    meta->>'display_name',
    meta->>'full_name',
    apple_name,
    meta->>'name',
    uname
  );
  avatar := coalesce(meta->>'avatar_url', meta->>'picture');
  insert into public.profiles (
    id, username, display_name, avatar_url, profile_setup_complete,
    public_user_id, public_user_id_changed_at
  )
  values (new.id, uname, dname, avatar, false, uname, now())
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles replica identity full;

-- ─── user_app_state (realtime sync) ─────────────────────────────────────────

create table if not exists public.user_app_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists user_app_state_updated_at_idx on public.user_app_state (updated_at desc);

alter table public.user_app_state enable row level security;

select public.bootstrap_sync_rls_policy(
  'public.user_app_state'::regclass,
  'user_app_state_select_own',
  'select',
  'auth.uid() = user_id'
);

select public.bootstrap_sync_rls_policy(
  'public.user_app_state'::regclass,
  'user_app_state_insert_own',
  'insert',
  null,
  'auth.uid() = user_id'
);

select public.bootstrap_sync_rls_policy(
  'public.user_app_state'::regclass,
  'user_app_state_update_own',
  'update',
  'auth.uid() = user_id',
  'auth.uid() = user_id'
);

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
  alter publication supabase_realtime add table public.profiles;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.user_app_state;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

notify pgrst, 'reload schema';
