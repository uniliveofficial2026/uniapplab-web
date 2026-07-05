-- YouTube favorites, history, and likes (per authenticated user).

create table if not exists public.youtube_engagement (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  video_id text not null,
  title text,
  channel_title text,
  thumbnail_url text,
  kind text not null check (kind in ('history', 'favorite', 'like')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, video_id, kind)
);

create index if not exists youtube_engagement_user_kind_idx
  on public.youtube_engagement (user_id, kind, updated_at desc);

alter table public.youtube_engagement enable row level security;

create policy "youtube_engagement_select_own"
  on public.youtube_engagement
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "youtube_engagement_insert_own"
  on public.youtube_engagement
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "youtube_engagement_update_own"
  on public.youtube_engagement
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "youtube_engagement_delete_own"
  on public.youtube_engagement
  for delete
  to authenticated
  using (auth.uid() = user_id);
