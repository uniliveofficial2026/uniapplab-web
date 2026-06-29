-- Re-run if you already applied 20260601120000_profiles.sql — improves Google OAuth profile fields.

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
  avatar text;
begin
  meta := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  uname := lower(regexp_replace(
    coalesce(meta->>'username', split_part(coalesce(new.email, ''), '@', 1)),
    '[^a-z0-9_]', '_', 'g'
  ));
  if length(uname) < 3 then
    uname := 'user_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;
  dname := coalesce(
    meta->>'display_name',
    meta->>'full_name',
    meta->>'name',
    uname
  );
  avatar := coalesce(meta->>'avatar_url', meta->>'picture');
  insert into public.profiles (id, username, display_name, avatar_url, profile_setup_complete)
  values (new.id, uname, dname, avatar, false)
  on conflict (id) do nothing;
  return new;
end;
$$;
