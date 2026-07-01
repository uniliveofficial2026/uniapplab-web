-- Realtime chat tables (Phase 4a)

create table if not exists public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_thread_members (
  thread_id uuid not null references public.chat_threads (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (thread_id, user_id)
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(body) > 0 and char_length(body) <= 8000),
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_thread_created_idx
  on public.chat_messages (thread_id, created_at desc);

create table if not exists public.chat_read_state (
  thread_id uuid not null references public.chat_threads (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (thread_id, user_id)
);

alter table public.chat_threads enable row level security;
alter table public.chat_thread_members enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_read_state enable row level security;

drop policy if exists chat_threads_select_member on public.chat_threads;
create policy chat_threads_select_member on public.chat_threads for select
  using (
    exists (
      select 1 from public.chat_thread_members m
      where m.thread_id = id and m.user_id = auth.uid()
    )
  );

drop policy if exists chat_thread_members_select_own on public.chat_thread_members;
create policy chat_thread_members_select_own on public.chat_thread_members for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.chat_thread_members m2
      where m2.thread_id = thread_id and m2.user_id = auth.uid()
    )
  );

drop policy if exists chat_messages_select_member on public.chat_messages;
create policy chat_messages_select_member on public.chat_messages for select
  using (
    exists (
      select 1 from public.chat_thread_members m
      where m.thread_id = thread_id and m.user_id = auth.uid()
    )
  );

drop policy if exists chat_messages_insert_member on public.chat_messages;
create policy chat_messages_insert_member on public.chat_messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.chat_thread_members m
      where m.thread_id = thread_id and m.user_id = auth.uid()
    )
    and not exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.banned_at is not null
    )
  );

drop policy if exists chat_read_state_own on public.chat_read_state;
create policy chat_read_state_own on public.chat_read_state for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

alter publication supabase_realtime add table public.chat_messages;
