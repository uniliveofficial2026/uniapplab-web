-- Run in Supabase SQL Editor (project kgiaflmukkguzjtmcuqd) or via CLI: supabase db push

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  display_name text not null,
  avatar_url text,
  bio text default '' not null,
  profile_setup_complete boolean default false not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  constraint profiles_username_lowercase check (username = lower(username)),
  constraint profiles_username_format check (username ~ '^[a-z0-9_]{3,24}$')
);

create unique index if not exists profiles_username_key on public.profiles (username);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_public" on public.profiles;
create policy "profiles_select_public"
  on public.profiles for select
  using (true);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

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
begin
  meta := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  uname := lower(regexp_replace(coalesce(meta->>'username', split_part(new.email, '@', 1)), '[^a-z0-9_]', '_', 'g'));
  if length(uname) < 3 then
    uname := 'user_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;
  dname := coalesce(meta->>'display_name', meta->>'full_name', meta->>'name', uname);
  insert into public.profiles (id, username, display_name, avatar_url, profile_setup_complete)
  values (new.id, uname, dname, coalesce(meta->>'avatar_url', meta->>'picture'), false)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
