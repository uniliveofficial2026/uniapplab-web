-- YouTube library: watch later + user playlists.

alter table public.youtube_engagement
  drop constraint if exists youtube_engagement_kind_check;

alter table public.youtube_engagement
  add constraint youtube_engagement_kind_check
  check (kind in ('history', 'favorite', 'like', 'watch_later'));

create table if not exists public.youtube_playlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists youtube_playlists_user_updated_idx
  on public.youtube_playlists (user_id, updated_at desc);

create table if not exists public.youtube_playlist_items (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid not null references public.youtube_playlists (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  video_id text not null,
  title text,
  channel_title text,
  thumbnail_url text,
  position int not null default 0,
  created_at timestamptz not null default now(),
  unique (playlist_id, video_id)
);

create index if not exists youtube_playlist_items_playlist_pos_idx
  on public.youtube_playlist_items (playlist_id, position asc);

alter table public.youtube_playlists enable row level security;
alter table public.youtube_playlist_items enable row level security;

drop policy if exists youtube_playlists_select_own on public.youtube_playlists;
create policy youtube_playlists_select_own on public.youtube_playlists
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists youtube_playlists_insert_own on public.youtube_playlists;
create policy youtube_playlists_insert_own on public.youtube_playlists
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists youtube_playlists_update_own on public.youtube_playlists;
create policy youtube_playlists_update_own on public.youtube_playlists
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists youtube_playlists_delete_own on public.youtube_playlists;
create policy youtube_playlists_delete_own on public.youtube_playlists
  for delete to authenticated using (auth.uid() = user_id);

drop policy if exists youtube_playlist_items_select_own on public.youtube_playlist_items;
create policy youtube_playlist_items_select_own on public.youtube_playlist_items
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists youtube_playlist_items_insert_own on public.youtube_playlist_items;
create policy youtube_playlist_items_insert_own on public.youtube_playlist_items
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists youtube_playlist_items_update_own on public.youtube_playlist_items;
create policy youtube_playlist_items_update_own on public.youtube_playlist_items
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists youtube_playlist_items_delete_own on public.youtube_playlist_items;
create policy youtube_playlist_items_delete_own on public.youtube_playlist_items
  for delete to authenticated using (auth.uid() = user_id);
