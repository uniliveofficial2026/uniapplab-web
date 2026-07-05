-- Complete remaining cross-user realtime: rich chat, blocks, profile visits.

-- ─── chat messages: payload, client id, soft delete ──────────────────────────

alter table public.chat_messages
  add column if not exists payload jsonb not null default '{}'::jsonb;

alter table public.chat_messages
  add column if not exists client_id text;

alter table public.chat_messages
  add column if not exists deleted_at timestamptz;

-- Allow media-only messages (body may be a short placeholder).
alter table public.chat_messages drop constraint if exists chat_messages_body_check;
alter table public.chat_messages
  add constraint chat_messages_body_check
  check (char_length(body) >= 1 and char_length(body) <= 8000);

create unique index if not exists chat_messages_client_id_uidx
  on public.chat_messages (thread_id, client_id)
  where client_id is not null;

drop policy if exists chat_messages_update_own on public.chat_messages;
create policy chat_messages_update_own on public.chat_messages for update
  using (
    sender_id = auth.uid()
    and exists (
      select 1 from public.chat_thread_members m
      where m.thread_id = thread_id and m.user_id = auth.uid()
    )
  )
  with check (sender_id = auth.uid());

-- ─── chat reactions ──────────────────────────────────────────────────────────

create table if not exists public.chat_message_reactions (
  message_id uuid not null references public.chat_messages (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  emoji text not null check (char_length(emoji) >= 1 and char_length(emoji) <= 16),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create index if not exists chat_message_reactions_message_idx
  on public.chat_message_reactions (message_id);

alter table public.chat_message_reactions enable row level security;

drop policy if exists chat_reactions_select on public.chat_message_reactions;
create policy chat_reactions_select on public.chat_message_reactions for select
  using (
    exists (
      select 1
      from public.chat_messages msg
      join public.chat_thread_members m on m.thread_id = msg.thread_id
      where msg.id = message_id and m.user_id = auth.uid()
    )
  );

drop policy if exists chat_reactions_insert on public.chat_message_reactions;
create policy chat_reactions_insert on public.chat_message_reactions for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.chat_messages msg
      join public.chat_thread_members m on m.thread_id = msg.thread_id
      where msg.id = message_id and m.user_id = auth.uid()
    )
  );

drop policy if exists chat_reactions_delete on public.chat_message_reactions;
create policy chat_reactions_delete on public.chat_message_reactions for delete
  using (user_id = auth.uid());

drop policy if exists chat_reactions_update on public.chat_message_reactions;
create policy chat_reactions_update on public.chat_message_reactions for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ─── chat read state: peers can see each other's receipts ────────────────────

drop policy if exists chat_read_state_own on public.chat_read_state;
drop policy if exists chat_read_state_select_member on public.chat_read_state;
create policy chat_read_state_select_member on public.chat_read_state for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.chat_thread_members m
      where m.thread_id = thread_id and m.user_id = auth.uid()
    )
  );

drop policy if exists chat_read_state_upsert_own on public.chat_read_state;
create policy chat_read_state_upsert_own on public.chat_read_state for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ─── user blocks ─────────────────────────────────────────────────────────────

create table if not exists public.user_blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index if not exists user_blocks_blocked_idx on public.user_blocks (blocked_id);

alter table public.user_blocks enable row level security;

drop policy if exists user_blocks_select on public.user_blocks;
create policy user_blocks_select on public.user_blocks for select
  using (auth.uid() = blocker_id or auth.uid() = blocked_id);

drop policy if exists user_blocks_insert on public.user_blocks;
create policy user_blocks_insert on public.user_blocks for insert
  with check (auth.uid() = blocker_id);

drop policy if exists user_blocks_delete on public.user_blocks;
create policy user_blocks_delete on public.user_blocks for delete
  using (auth.uid() = blocker_id);

-- ─── profile visits (owner-visible) ──────────────────────────────────────────

create table if not exists public.profile_visits (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  visitor_id uuid not null references public.profiles (id) on delete cascade,
  surface text not null default 'profile',
  content_id text,
  preview_url text,
  live_kind text,
  visit_count int not null default 1,
  visited_at timestamptz not null default now(),
  check (owner_id <> visitor_id)
);

create index if not exists profile_visits_owner_idx
  on public.profile_visits (owner_id, visited_at desc);

create unique index if not exists profile_visits_owner_visitor_uidx
  on public.profile_visits (owner_id, visitor_id);

alter table public.profile_visits enable row level security;

drop policy if exists profile_visits_select_owner on public.profile_visits;
create policy profile_visits_select_owner on public.profile_visits for select
  using (auth.uid() = owner_id);

drop policy if exists profile_visits_insert_visitor on public.profile_visits;
create policy profile_visits_insert_visitor on public.profile_visits for insert
  with check (auth.uid() = visitor_id and owner_id <> visitor_id);

drop policy if exists profile_visits_update_visitor on public.profile_visits;
create policy profile_visits_update_visitor on public.profile_visits for update
  using (auth.uid() = visitor_id)
  with check (auth.uid() = visitor_id);

-- ─── realtime ────────────────────────────────────────────────────────────────

do $$ begin
  alter publication supabase_realtime add table public.chat_message_reactions;
exception when duplicate_object then null; when undefined_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.chat_read_state;
exception when duplicate_object then null; when undefined_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.user_blocks;
exception when duplicate_object then null; when undefined_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.profile_visits;
exception when duplicate_object then null; when undefined_object then null; end $$;
