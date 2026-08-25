-- Ephemeral presence failover when Upstash Redis is unavailable/quota-blocked.
-- Not identity authority — TTL rows only (personId + deviceId + last_seen).

create table if not exists public.presence_ephemeral (
  person_id text not null,
  device_id text not null default 'default',
  last_seen timestamptz not null default now(),
  expires_at timestamptz not null,
  primary key (person_id, device_id)
);

create index if not exists presence_ephemeral_expires_at_idx
  on public.presence_ephemeral (expires_at);

create index if not exists presence_ephemeral_person_alive_idx
  on public.presence_ephemeral (person_id, expires_at);

alter table public.presence_ephemeral enable row level security;

-- Service-role API only; no direct client writes.
drop policy if exists presence_ephemeral_no_client on public.presence_ephemeral;
create policy presence_ephemeral_no_client
  on public.presence_ephemeral
  for all
  to authenticated, anon
  using (false)
  with check (false);

revoke all on table public.presence_ephemeral from anon, authenticated;
grant select, insert, update, delete on table public.presence_ephemeral to service_role;
