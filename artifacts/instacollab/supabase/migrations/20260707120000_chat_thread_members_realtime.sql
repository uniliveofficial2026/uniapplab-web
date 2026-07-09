-- Realtime membership changes so new devices learn threads without polling.

do $$
begin
  alter publication supabase_realtime add table public.chat_thread_members;
exception
  when duplicate_object then null;
end $$;
