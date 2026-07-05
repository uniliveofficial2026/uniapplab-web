-- Allow authenticated clients to create DM threads without the API server.

drop policy if exists chat_threads_insert_authenticated on public.chat_threads;
create policy chat_threads_insert_authenticated on public.chat_threads
  for insert to authenticated
  with check (true);

drop policy if exists chat_thread_members_insert_dm on public.chat_thread_members;
create policy chat_thread_members_insert_dm on public.chat_thread_members
  for insert to authenticated
  with check (
    user_id = auth.uid()
    or exists (
      select 1
      from public.chat_thread_members m
      where m.thread_id = chat_thread_members.thread_id
        and m.user_id = auth.uid()
    )
  );
