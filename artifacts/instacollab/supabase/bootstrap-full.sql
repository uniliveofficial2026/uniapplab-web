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
  add column if not exists public_user_id_changed_at timestamptz,
  add column if not exists note text default '' not null,
  add column if not exists note_updated_at timestamptz;

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

-- ─── incremental migrations (idempotent) ───────────────────────────────────

-- >>> 20260601130000_google_profile_metadata.sql
-- Re-run if you already applied 20260601120000_profiles.sql — improves Google OAuth profile fields.

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
begin
  meta := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  uname := lower(regexp_replace(
    coalesce(meta->>'username', split_part(coalesce(new.email, ''), '@', 1)),
    '[^a-z0-9_]', '_', 'g'
  ));
  if length(uname) < 3 then
    uname := 'user_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;
  dname := coalesce(
    meta->>'display_name',
    meta->>'full_name',
    meta->>'name',
    uname
  );
  avatar := coalesce(meta->>'avatar_url', meta->>'picture');
  insert into public.profiles (id, username, display_name, avatar_url, profile_setup_complete)
  values (new.id, uname, dname, avatar, false)
  on conflict (id) do nothing;
  return new;
end;
$$;

-- >>> 20260601140000_apple_profile_metadata.sql
-- Apple Sign In: name may be a JSON object { firstName, lastName } on first authorization.

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
  insert into public.profiles (id, username, display_name, avatar_url, profile_setup_complete)
  values (new.id, uname, dname, avatar, false)
  on conflict (id) do nothing;
  return new;
end;
$$;

-- >>> 20260601150000_public_user_id.sql
-- Custom public User ID (changeable on profile setup; then once every 7 days in settings)

alter table public.profiles
  add column if not exists public_user_id text,
  add column if not exists public_user_id_changed_at timestamptz;

update public.profiles
set public_user_id = username
where public_user_id is null or public_user_id = '';

create unique index if not exists profiles_public_user_id_key
  on public.profiles (public_user_id)
  where public_user_id is not null and public_user_id <> '';

alter table public.profiles
  drop constraint if exists profiles_public_user_id_format;

alter table public.profiles
  add constraint profiles_public_user_id_format check (
    public_user_id is null
    or (
      public_user_id = lower(public_user_id)
      and public_user_id ~ '^[a-z0-9_]{3,24}$'
    )
  );

-- Extend signup trigger to seed public_user_id from username
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
  insert into public.profiles (id, username, display_name, avatar_url, profile_setup_complete, public_user_id, public_user_id_changed_at)
  values (
    new.id,
    uname,
    dname,
    coalesce(meta->>'avatar_url', meta->>'picture'),
    false,
    uname,
    now()
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- >>> 20260601160000_user_app_state.sql
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

-- >>> 20260601170000_profiles_realtime.sql
-- Enable realtime profile updates for the signed-in user (cross-tab / cross-device).

alter table public.profiles replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.profiles;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

-- >>> 20260601180000_profiles_roles.sql
-- Platform roles, bans, and auth metadata sync (Phase 1)

alter table public.profiles
  add column if not exists role text not null default 'user'
    check (role in ('user', 'streamer', 'admin'));

alter table public.profiles
  add column if not exists banned_at timestamptz;

alter table public.profiles
  add column if not exists ban_reason text;

alter table public.profiles
  add column if not exists muted_until timestamptz;

create or replace function public.profiles_guard_sensitive_columns()
returns trigger
language plpgsql
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;
  new.role := old.role;
  new.banned_at := old.banned_at;
  new.ban_reason := old.ban_reason;
  new.muted_until := old.muted_until;
  return new;
end;
$$;

drop trigger if exists profiles_guard_sensitive on public.profiles;
create trigger profiles_guard_sensitive
  before update on public.profiles
  for each row execute function public.profiles_guard_sensitive_columns();

create or replace function public.sync_profile_role_to_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update auth.users
  set raw_app_meta_data =
    coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', new.role)
  where id = new.id;
  return new;
end;
$$;

drop trigger if exists profiles_sync_role_to_auth on public.profiles;
create trigger profiles_sync_role_to_auth
  after insert or update of role on public.profiles
  for each row execute function public.sync_profile_role_to_auth();

-- Backfill auth metadata for existing users
update auth.users u
set raw_app_meta_data =
  coalesce(u.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', p.role)
from public.profiles p
where p.id = u.id;

-- >>> 20260601190000_wallets.sql
-- Server-side wallet ledger (Phase 5)

create table if not exists public.wallets (
  user_id uuid primary key references auth.users (id) on delete cascade,
  balance bigint not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  from_user uuid references auth.users (id) on delete set null,
  to_user uuid references auth.users (id) on delete set null,
  amount bigint not null check (amount > 0),
  tx_type text not null check (tx_type in ('transfer', 'credit', 'debit', 'purchase', 'reward')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists wallet_transactions_from_user_idx on public.wallet_transactions (from_user, created_at desc);
create index if not exists wallet_transactions_to_user_idx on public.wallet_transactions (to_user, created_at desc);

alter table public.wallets enable row level security;
alter table public.wallet_transactions enable row level security;

drop policy if exists wallets_select_own on public.wallets;
create policy wallets_select_own on public.wallets for select using (auth.uid() = user_id);

drop policy if exists wallet_tx_select_involved on public.wallet_transactions;
create policy wallet_tx_select_involved on public.wallet_transactions for select
  using (auth.uid() = from_user or auth.uid() = to_user);

-- No INSERT/UPDATE policies — mutations only via RPC

create or replace function public.ensure_wallet(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.wallets (user_id, balance)
  values (p_user_id, 0)
  on conflict (user_id) do nothing;
end;
$$;

create or replace function public.transfer_coins(
  from_user uuid,
  to_user uuid,
  amount bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  sender_balance bigint;
begin
  if amount is null or amount <= 0 then
    raise exception 'amount must be positive';
  end if;
  if from_user is null or to_user is null or from_user = to_user then
    raise exception 'invalid transfer parties';
  end if;

  perform public.ensure_wallet(from_user);
  perform public.ensure_wallet(to_user);

  select balance into sender_balance from public.wallets where user_id = from_user for update;
  if sender_balance < amount then
    raise exception 'insufficient balance';
  end if;

  update public.wallets set balance = balance - amount, updated_at = now() where user_id = from_user;
  update public.wallets set balance = balance + amount, updated_at = now() where user_id = to_user;

  insert into public.wallet_transactions (from_user, to_user, amount, tx_type)
  values (from_user, to_user, amount, 'transfer');

  return jsonb_build_object('ok', true, 'balance', (select balance from public.wallets where user_id = from_user));
end;
$$;

create or replace function public.credit_coins(
  target_user uuid,
  amount bigint,
  tx_type text default 'credit',
  metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if amount is null or amount <= 0 then
    raise exception 'amount must be positive';
  end if;
  perform public.ensure_wallet(target_user);
  update public.wallets set balance = balance + amount, updated_at = now() where user_id = target_user;
  insert into public.wallet_transactions (from_user, to_user, amount, tx_type, metadata)
  values (null, target_user, amount, tx_type, metadata);
  return jsonb_build_object('ok', true, 'balance', (select balance from public.wallets where user_id = target_user));
end;
$$;

revoke all on function public.transfer_coins(uuid, uuid, bigint) from public;
grant execute on function public.transfer_coins(uuid, uuid, bigint) to authenticated;

revoke all on function public.credit_coins(uuid, bigint, text, jsonb) from public;
grant execute on function public.credit_coins(uuid, bigint, text, jsonb) to service_role;

create or replace function public.handle_new_user_wallet()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ensure_wallet(new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_wallet on auth.users;
create trigger on_auth_user_wallet
  after insert on auth.users
  for each row execute function public.handle_new_user_wallet();

-- >>> 20260601200000_chat.sql
-- Realtime chat tables (Phase 4a)

create table if not exists public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_thread_members (
  thread_id uuid not null references public.chat_threads (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (thread_id, user_id)
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(body) > 0 and char_length(body) <= 8000),
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_thread_created_idx
  on public.chat_messages (thread_id, created_at desc);

create table if not exists public.chat_read_state (
  thread_id uuid not null references public.chat_threads (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (thread_id, user_id)
);

alter table public.chat_threads enable row level security;
alter table public.chat_thread_members enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_read_state enable row level security;

drop policy if exists chat_threads_select_member on public.chat_threads;
create policy chat_threads_select_member on public.chat_threads for select
  using (
    exists (
      select 1 from public.chat_thread_members m
      where m.thread_id = id and m.user_id = auth.uid()
    )
  );

drop policy if exists chat_thread_members_select_own on public.chat_thread_members;
create policy chat_thread_members_select_own on public.chat_thread_members for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.chat_thread_members m2
      where m2.thread_id = thread_id and m2.user_id = auth.uid()
    )
  );

drop policy if exists chat_messages_select_member on public.chat_messages;
create policy chat_messages_select_member on public.chat_messages for select
  using (
    exists (
      select 1 from public.chat_thread_members m
      where m.thread_id = thread_id and m.user_id = auth.uid()
    )
  );

drop policy if exists chat_messages_insert_member on public.chat_messages;
create policy chat_messages_insert_member on public.chat_messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.chat_thread_members m
      where m.thread_id = thread_id and m.user_id = auth.uid()
    )
    and not exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.banned_at is not null
    )
  );

drop policy if exists chat_read_state_own on public.chat_read_state;
create policy chat_read_state_own on public.chat_read_state for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

alter publication supabase_realtime add table public.chat_messages;

-- >>> 20260601210000_streams.sql
-- Live streams + signaling (Phase 6)

create table if not exists public.streams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'Live',
  status text not null default 'live' check (status in ('live', 'ended')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists streams_live_idx on public.streams (status, started_at desc)
  where status = 'live';

create table if not exists public.stream_signals (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null references public.streams (id) on delete cascade,
  from_user uuid not null references auth.users (id) on delete cascade,
  to_user uuid references auth.users (id) on delete cascade,
  signal_type text not null check (signal_type in ('offer', 'answer', 'ice')),
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists stream_signals_stream_idx on public.stream_signals (stream_id, created_at desc);

alter table public.streams enable row level security;
alter table public.stream_signals enable row level security;

drop policy if exists streams_select_public on public.streams;
create policy streams_select_public on public.streams for select using (true);

drop policy if exists streams_insert_own on public.streams;
create policy streams_insert_own on public.streams for insert
  with check (user_id = auth.uid());

drop policy if exists streams_update_own on public.streams;
create policy streams_update_own on public.streams for update
  using (user_id = auth.uid());

drop policy if exists stream_signals_select_involved on public.stream_signals;
create policy stream_signals_select_involved on public.stream_signals for select
  using (
    from_user = auth.uid()
    or to_user = auth.uid()
    or to_user is null
  );

drop policy if exists stream_signals_insert_own on public.stream_signals;
create policy stream_signals_insert_own on public.stream_signals for insert
  with check (from_user = auth.uid());

alter publication supabase_realtime add table public.streams;
alter publication supabase_realtime add table public.stream_signals;

-- >>> 20260701120000_posts.sql
-- Shared social posts (cross-user, cross-device). Run via Supabase SQL editor or CLI.

create table if not exists public.posts (
  id text primary key,
  author_id uuid not null references public.profiles (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists posts_author_created_idx on public.posts (author_id, created_at desc);
create index if not exists posts_created_idx on public.posts (created_at desc);

alter table public.posts enable row level security;

drop policy if exists "posts_select_visible" on public.posts;
create policy "posts_select_visible"
  on public.posts for select
  using (not is_archived or author_id = auth.uid());

drop policy if exists "posts_insert_own" on public.posts;
create policy "posts_insert_own"
  on public.posts for insert
  with check (auth.uid() = author_id);

drop policy if exists "posts_update_own" on public.posts;
create policy "posts_update_own"
  on public.posts for update
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

drop policy if exists "posts_delete_own" on public.posts;
create policy "posts_delete_own"
  on public.posts for delete
  using (auth.uid() = author_id);

create or replace function public.set_posts_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists posts_updated_at on public.posts;
create trigger posts_updated_at
  before update on public.posts
  for each row execute function public.set_posts_updated_at();

-- Post media bucket (public read for feed images/videos)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'post-media',
  'post-media',
  true,
  52428800,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm']
)
on conflict (id) do update set public = excluded.public;

drop policy if exists "post_media_public_read" on storage.objects;
create policy "post_media_public_read"
  on storage.objects for select
  using (bucket_id = 'post-media');

drop policy if exists "post_media_auth_upload" on storage.objects;
create policy "post_media_auth_upload"
  on storage.objects for insert
  with check (
    bucket_id = 'post-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "post_media_auth_update" on storage.objects;
create policy "post_media_auth_update"
  on storage.objects for update
  using (bucket_id = 'post-media' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "post_media_auth_delete" on storage.objects;
create policy "post_media_auth_delete"
  on storage.objects for delete
  using (bucket_id = 'post-media' and auth.uid()::text = (storage.foldername(name))[1]);

-- Realtime (optional)
do $$
begin
  alter publication supabase_realtime add table public.posts;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

-- >>> 20260702120000_profile_thought_note.sql
-- Avatar "thought" bubble text — synced across devices and visible to other users.

alter table public.profiles
  add column if not exists note text default '' not null,
  add column if not exists note_updated_at timestamptz;

comment on column public.profiles.note is 'Short thought shown as animated bubble on avatar';
comment on column public.profiles.note_updated_at is 'When note was last saved — drives cross-device animation replay';

-- >>> 20260703120000_social_discovery.sql
-- Global social graph, party room registry, notifications, live presence (cloud discovery).

-- ─── follows ────────────────────────────────────────────────────────────────

create table if not exists public.follows (
  follower_id uuid not null references auth.users (id) on delete cascade,
  following_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint follows_no_self check (follower_id <> following_id)
);

create index if not exists follows_following_idx on public.follows (following_id, created_at desc);

alter table public.follows enable row level security;

drop policy if exists follows_select_public on public.follows;
create policy follows_select_public on public.follows for select using (true);

drop policy if exists follows_insert_own on public.follows;
create policy follows_insert_own on public.follows for insert
  with check (auth.uid() = follower_id);

drop policy if exists follows_delete_own on public.follows;
create policy follows_delete_own on public.follows for delete
  using (auth.uid() = follower_id);

-- ─── follow requests (private accounts) ─────────────────────────────────────

create table if not exists public.follow_requests (
  profile_owner_id uuid not null references auth.users (id) on delete cascade,
  requester_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_owner_id, requester_id),
  constraint follow_requests_no_self check (profile_owner_id <> requester_id)
);

alter table public.follow_requests enable row level security;

drop policy if exists follow_requests_select_involved on public.follow_requests;
create policy follow_requests_select_involved on public.follow_requests for select
  using (auth.uid() = profile_owner_id or auth.uid() = requester_id);

drop policy if exists follow_requests_insert_requester on public.follow_requests;
create policy follow_requests_insert_requester on public.follow_requests for insert
  with check (auth.uid() = requester_id);

drop policy if exists follow_requests_delete_involved on public.follow_requests;
create policy follow_requests_delete_involved on public.follow_requests for delete
  using (auth.uid() = profile_owner_id or auth.uid() = requester_id);

-- ─── party rooms (global discovery) ─────────────────────────────────────────

create table if not exists public.party_rooms (
  id text primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  room_name text not null,
  room_mode text not null default 'Karaoke',
  privacy text not null default 'Public',
  join_policy text,
  cover_url text,
  tags text[] not null default '{}',
  max_participants int not null default 50,
  participant_count int not null default 0,
  status text not null default 'active' check (status in ('active', 'ended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists party_rooms_active_idx
  on public.party_rooms (status, updated_at desc)
  where status = 'active';

create index if not exists party_rooms_owner_idx on public.party_rooms (owner_id, updated_at desc);

alter table public.party_rooms enable row level security;

drop policy if exists party_rooms_select_public on public.party_rooms;
create policy party_rooms_select_public on public.party_rooms for select using (true);

drop policy if exists party_rooms_insert_own on public.party_rooms;
create policy party_rooms_insert_own on public.party_rooms for insert
  with check (auth.uid() = owner_id);

drop policy if exists party_rooms_update_own on public.party_rooms;
create policy party_rooms_update_own on public.party_rooms for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists party_rooms_delete_own on public.party_rooms;
create policy party_rooms_delete_own on public.party_rooms for delete
  using (auth.uid() = owner_id);

create or replace function public.set_party_rooms_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists party_rooms_updated_at on public.party_rooms;
create trigger party_rooms_updated_at
  before update on public.party_rooms
  for each row execute function public.set_party_rooms_updated_at();

-- ─── user notifications (cross-user delivery) ─────────────────────────────────

create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null,
  actor_id uuid references auth.users (id) on delete set null,
  body text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists user_notifications_user_created_idx
  on public.user_notifications (user_id, created_at desc);

alter table public.user_notifications enable row level security;

drop policy if exists user_notifications_select_own on public.user_notifications;
create policy user_notifications_select_own on public.user_notifications for select
  using (auth.uid() = user_id);

drop policy if exists user_notifications_insert_actor on public.user_notifications;
create policy user_notifications_insert_actor on public.user_notifications for insert
  with check (
    auth.uid() = actor_id
    and user_id <> auth.uid()
  );

drop policy if exists user_notifications_update_own on public.user_notifications;
create policy user_notifications_update_own on public.user_notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── live presence on profiles ───────────────────────────────────────────────

alter table public.profiles
  add column if not exists live_status text
    check (live_status is null or live_status in ('live', 'ended'));

alter table public.profiles
  add column if not exists live_kind text;

alter table public.profiles
  add column if not exists live_started_at timestamptz;

create index if not exists profiles_live_idx
  on public.profiles (live_status, live_started_at desc)
  where live_status = 'live';

-- ─── realtime ────────────────────────────────────────────────────────────────

do $$
begin
  alter publication supabase_realtime add table public.follows;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.party_rooms;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.user_notifications;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

notify pgrst, 'reload schema';

notify pgrst, 'reload schema';
