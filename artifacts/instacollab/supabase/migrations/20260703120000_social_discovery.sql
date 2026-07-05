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
