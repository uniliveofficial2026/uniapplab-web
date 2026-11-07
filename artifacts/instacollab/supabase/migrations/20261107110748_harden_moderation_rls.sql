-- Enforce moderation state at the database boundary so direct Supabase clients
-- cannot bypass the API's ban/mute checks.
-- Also qualify outer chat columns so per-thread checks cannot degrade into
-- "member of any thread" checks inside membership subqueries.

drop policy if exists chat_threads_select_member on public.chat_threads;
create policy chat_threads_select_member on public.chat_threads for select
  using (
    exists (
      select 1
      from public.chat_thread_members m
      where m.thread_id = public.chat_threads.id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists chat_thread_members_select_own on public.chat_thread_members;
create policy chat_thread_members_select_own on public.chat_thread_members for select
  using (user_id = auth.uid());

drop policy if exists chat_messages_select_member on public.chat_messages;
create policy chat_messages_select_member on public.chat_messages for select
  using (
    exists (
      select 1
      from public.chat_thread_members m
      where m.thread_id = public.chat_messages.thread_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists chat_messages_insert_member on public.chat_messages;
create policy chat_messages_insert_member on public.chat_messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1
      from public.chat_thread_members m
      where m.thread_id = public.chat_messages.thread_id
        and m.user_id = auth.uid()
    )
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.banned_at is null
        and (p.muted_until is null or p.muted_until <= now())
    )
  );

drop policy if exists "posts_insert_own" on public.posts;
create policy "posts_insert_own"
  on public.posts for insert
  with check (
    auth.uid() = author_id
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.banned_at is null
    )
  );

drop policy if exists "posts_update_own" on public.posts;
create policy "posts_update_own"
  on public.posts for update
  using (
    auth.uid() = author_id
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.banned_at is null
    )
  )
  with check (
    auth.uid() = author_id
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.banned_at is null
    )
  );

drop policy if exists "post_media_auth_upload" on storage.objects;
create policy "post_media_auth_upload"
  on storage.objects for insert
  with check (
    bucket_id = 'post-media'
    and auth.uid()::text = (storage.foldername(name))[1]
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.banned_at is null
    )
  );

drop policy if exists "post_media_auth_update" on storage.objects;
create policy "post_media_auth_update"
  on storage.objects for update
  using (
    bucket_id = 'post-media'
    and auth.uid()::text = (storage.foldername(name))[1]
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.banned_at is null
    )
  )
  with check (
    bucket_id = 'post-media'
    and auth.uid()::text = (storage.foldername(name))[1]
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.banned_at is null
    )
  );
