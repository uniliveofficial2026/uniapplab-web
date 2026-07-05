-- Real-time party room chat (Solo Live, Multi-Guest, Watch Together, Party modes).
-- Includes party_rooms prerequisite when social_discovery migration was not applied yet.

-- ─── prerequisite: party_rooms (from 20260703120000_social_discovery.sql) ───

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

do $$
begin
  alter publication supabase_realtime add table public.party_rooms;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

-- ─── party room messages ─────────────────────────────────────────────────────

create table if not exists public.party_room_messages (
  id uuid primary key default gen_random_uuid(),
  room_id text not null references public.party_rooms (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  sender_name text not null,
  body text not null default '',
  kind text not null default 'chat'
    check (kind in ('chat', 'join', 'gift', 'system', 'sing')),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists party_room_messages_room_created_idx
  on public.party_room_messages (room_id, created_at desc);

alter table public.party_room_messages enable row level security;

drop policy if exists party_room_messages_select_public on public.party_room_messages;
create policy party_room_messages_select_public on public.party_room_messages
  for select using (true);

drop policy if exists party_room_messages_insert_auth on public.party_room_messages;
create policy party_room_messages_insert_auth on public.party_room_messages
  for insert
  with check (
    auth.uid() = sender_id
    and not exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.banned_at is not null
    )
  );

do $$
begin
  alter publication supabase_realtime add table public.party_room_messages;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

notify pgrst, 'reload schema';
