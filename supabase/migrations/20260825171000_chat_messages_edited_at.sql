-- Soft-edit timestamp used by chat message list/select paths.
alter table public.chat_messages
  add column if not exists edited_at timestamptz;
