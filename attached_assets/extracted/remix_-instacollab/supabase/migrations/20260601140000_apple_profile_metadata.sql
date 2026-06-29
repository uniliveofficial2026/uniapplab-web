-- Apple Sign In: name may be a JSON object { firstName, lastName } on first authorization.

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
  apple_name text;
begin
  meta := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  uname := lower(regexp_replace(
    coalesce(meta->>'username', split_part(coalesce(new.email, ''), '@', 1)),
    '[^a-z0-9_]', '_', 'g'
  ));
  if length(uname) < 3 then
    uname := 'user_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;
  apple_name := nullif(trim(both from concat_ws(' ',
    meta#>>'{name,firstName}',
    meta#>>'{name,lastName}'
  )), '');
  dname := coalesce(
    meta->>'display_name',
    meta->>'full_name',
    apple_name,
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
