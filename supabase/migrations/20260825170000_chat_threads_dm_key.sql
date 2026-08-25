-- DM identity key + thread type for chat_threads (API/client already depend on these).
alter table public.chat_threads
  add column if not exists thread_type text not null default 'group',
  add column if not exists dm_key text;

create unique index if not exists chat_threads_dm_key_uidx
  on public.chat_threads (dm_key)
  where dm_key is not null;

create index if not exists chat_threads_thread_type_idx
  on public.chat_threads (thread_type);
