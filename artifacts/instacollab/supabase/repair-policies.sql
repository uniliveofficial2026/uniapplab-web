-- InstaCollab — repair RLS policies (safe to re-run).
-- Use when bootstrap/migrations fail with:
--   ERROR 42710: policy "profiles_select_public" already exists
--   ERROR 42710: policy "user_app_state_select_own" already exists
--
-- Supabase Dashboard → SQL Editor → paste ALL → Run

create or replace function public.bootstrap_sync_rls_policy(
  p_table regclass,
  p_name text,
  p_cmd text,
  p_using text default null,
  p_with_check text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  stmt text;
begin
  execute format('drop policy if exists %I on %s', p_name, p_table);

  stmt := format('create policy %I on %s for %s', p_name, p_table, lower(p_cmd));

  if lower(p_cmd) in ('select', 'update', 'delete', 'all') and p_using is not null then
    stmt := stmt || format(' using (%s)', p_using);
  end if;

  if p_with_check is not null then
    stmt := stmt || format(' with check (%s)', p_with_check);
  end if;

  execute stmt;
exception
  when duplicate_object then
    execute format('drop policy if exists %I on %s', p_name, p_table);
    execute stmt;
end;
$$;

alter table public.profiles
  add column if not exists role text not null default 'user'
    check (role in ('user', 'streamer', 'admin')),
  add column if not exists banned_at timestamptz,
  add column if not exists ban_reason text,
  add column if not exists muted_until timestamptz;

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

select public.bootstrap_sync_rls_policy(
  'public.profiles'::regclass,
  'profiles_select_public',
  'select',
  'true'
);

select public.bootstrap_sync_rls_policy(
  'public.profiles'::regclass,
  'profiles_insert_own',
  'insert',
  null,
  'auth.uid() = id and role = ''user'' and banned_at is null and ban_reason is null and muted_until is null'
);

select public.bootstrap_sync_rls_policy(
  'public.profiles'::regclass,
  'profiles_update_own',
  'update',
  'auth.uid() = id',
  'auth.uid() = id'
);

select public.bootstrap_sync_rls_policy(
  'public.user_app_state'::regclass,
  'user_app_state_select_own',
  'select',
  'auth.uid() = user_id'
);

select public.bootstrap_sync_rls_policy(
  'public.user_app_state'::regclass,
  'user_app_state_insert_own',
  'insert',
  null,
  'auth.uid() = user_id'
);

select public.bootstrap_sync_rls_policy(
  'public.user_app_state'::regclass,
  'user_app_state_update_own',
  'update',
  'auth.uid() = user_id',
  'auth.uid() = user_id'
);

notify pgrst, 'reload schema';
