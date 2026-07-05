-- Repair: global follow graph (from 20260703120000_social_discovery.sql)
-- Paste in Supabase SQL Editor when auth:check reports follows is MISSING.

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

do $$
begin
  alter publication supabase_realtime add table public.follows;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

notify pgrst, 'reload schema';
