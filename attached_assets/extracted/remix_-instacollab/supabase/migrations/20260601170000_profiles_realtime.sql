-- Enable realtime profile updates for the signed-in user (cross-tab / cross-device).

alter table public.profiles replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.profiles;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
