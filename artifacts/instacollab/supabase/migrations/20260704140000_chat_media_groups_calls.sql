-- Chat media storage, group thread metadata, and call signaling support.

alter table public.chat_threads
  add column if not exists meta jsonb not null default '{}'::jsonb;

create index if not exists chat_threads_meta_local_id_idx
  on public.chat_threads ((meta->>'localId'));

-- Public chat media bucket (images, video, audio, docs/pdfs)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-media',
  'chat-media',
  true,
  52428800,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'video/mp4', 'video/webm', 'video/quicktime',
    'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm', 'audio/ogg',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'application/zip',
    'application/octet-stream'
  ]
)
on conflict (id) do update set public = excluded.public;

drop policy if exists chat_media_public_read on storage.objects;
create policy chat_media_public_read
  on storage.objects for select
  using (bucket_id = 'chat-media');

drop policy if exists chat_media_auth_upload on storage.objects;
create policy chat_media_auth_upload
  on storage.objects for insert
  with check (
    bucket_id = 'chat-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists chat_media_auth_update on storage.objects;
create policy chat_media_auth_update
  on storage.objects for update
  using (bucket_id = 'chat-media' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists chat_media_auth_delete on storage.objects;
create policy chat_media_auth_delete
  on storage.objects for delete
  using (bucket_id = 'chat-media' and auth.uid()::text = (storage.foldername(name))[1]);
