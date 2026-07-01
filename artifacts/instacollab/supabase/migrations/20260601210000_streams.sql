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
