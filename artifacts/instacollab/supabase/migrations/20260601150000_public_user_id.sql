-- Custom public User ID (changeable on profile setup; then once every 7 days in settings)

alter table public.profiles
  add column if not exists public_user_id text,
  add column if not exists public_user_id_changed_at timestamptz;

update public.profiles
set public_user_id = username
where public_user_id is null or public_user_id = '';

create unique index if not exists profiles_public_user_id_key
  on public.profiles (public_user_id)
  where public_user_id is not null and public_user_id <> '';

alter table public.profiles
  drop constraint if exists profiles_public_user_id_format;

alter table public.profiles
  add constraint profiles_public_user_id_format check (
    public_user_id is null
    or (
      public_user_id = lower(public_user_id)
      and public_user_id ~ '^[a-z0-9_]{3,24}$'
    )
  );

-- Extend signup trigger to seed public_user_id from username
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb;
  uname text;
  dname text;
begin
  meta := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  uname := lower(regexp_replace(coalesce(meta->>'username', split_part(new.email, '@', 1)), '[^a-z0-9_]', '_', 'g'));
  if length(uname) < 3 then
    uname := 'user_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;
  dname := coalesce(meta->>'display_name', meta->>'full_name', meta->>'name', uname);
  insert into public.profiles (id, username, display_name, avatar_url, profile_setup_complete, public_user_id, public_user_id_changed_at)
  values (
    new.id,
    uname,
    dname,
    coalesce(meta->>'avatar_url', meta->>'picture'),
    false,
    uname,
    now()
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
