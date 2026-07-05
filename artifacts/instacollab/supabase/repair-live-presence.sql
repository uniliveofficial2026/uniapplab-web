-- Repair missing live presence columns (reduces query errors hammering Postgres).
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
