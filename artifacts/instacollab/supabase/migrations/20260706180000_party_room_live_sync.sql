-- Cross-device live room sync: gifts, PK, commerce pins, game state.
-- LiveKit data channels are primary; Supabase realtime is durable fallback for late joiners.

create table if not exists public.party_room_sync_events (
  id uuid primary key default gen_random_uuid(),
  room_id text not null references public.party_rooms (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  event_type text not null
    check (event_type in ('gift', 'gift_play', 'pk', 'commerce', 'game')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists party_room_sync_events_room_created_idx
  on public.party_room_sync_events (room_id, created_at desc);

alter table public.party_room_sync_events enable row level security;

drop policy if exists party_room_sync_events_select_public on public.party_room_sync_events;
create policy party_room_sync_events_select_public on public.party_room_sync_events
  for select using (true);

drop policy if exists party_room_sync_events_insert_auth on public.party_room_sync_events;
create policy party_room_sync_events_insert_auth on public.party_room_sync_events
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
  alter publication supabase_realtime add table public.party_room_sync_events;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

notify pgrst, 'reload schema';
