-- Durable DEVICE↔PERSON push binding (server source of truth).
-- DEVICE installation id != PERSON (auth.users id).

create table if not exists public.push_devices (
  device_id text primary key,
  -- Canonical PERSON id (auth user / linked subject). Not required to be auth.users uuid.
  person_id text,
  platform text not null check (platform in ('apns', 'fcm', 'web_push', 'unknown')),
  push_token text,
  updated_at timestamptz not null default now()
);

create unique index if not exists push_devices_push_token_uidx
  on public.push_devices (push_token)
  where push_token is not null and length(trim(push_token)) > 0;

create index if not exists push_devices_person_id_idx
  on public.push_devices (person_id)
  where person_id is not null;

alter table public.push_devices enable row level security;

-- Clients never read/write directly; API uses service role.
drop policy if exists push_devices_no_direct_client on public.push_devices;
create policy push_devices_no_direct_client
  on public.push_devices
  for all
  to authenticated, anon
  using (false)
  with check (false);

grant select, insert, update, delete on public.push_devices to service_role;
