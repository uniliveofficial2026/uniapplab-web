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
