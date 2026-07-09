-- Prevent authenticated clients from self-assigning privileged profile fields on insert.

create or replace function public.profiles_guard_sensitive_columns()
returns trigger
language plpgsql
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.role := 'user';
    new.banned_at := null;
    new.ban_reason := null;
    new.muted_until := null;
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
  before insert or update on public.profiles
  for each row execute function public.profiles_guard_sensitive_columns();

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (
    auth.uid() = id
    and role = 'user'
    and banned_at is null
    and ban_reason is null
    and muted_until is null
  );
