-- Cross-user social realtime: comments, engagement (likes/saves), stories.
-- Posts/reels continue to use public.posts (reels use payload.contentKind = 'reel').

-- ─── comments ────────────────────────────────────────────────────────────────

create table if not exists public.social_comments (
  id text primary key,
  target_kind text not null check (target_kind in ('post', 'reel')),
  target_id text not null,
  parent_id text,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null default '',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists social_comments_target_idx
  on public.social_comments (target_kind, target_id, created_at desc);

create index if not exists social_comments_author_idx
  on public.social_comments (author_id, created_at desc);

alter table public.social_comments enable row level security;

drop policy if exists social_comments_select on public.social_comments;
create policy social_comments_select on public.social_comments for select
  using (auth.uid() is not null);

drop policy if exists social_comments_insert on public.social_comments;
create policy social_comments_insert on public.social_comments for insert
  with check (auth.uid() = author_id);

drop policy if exists social_comments_update on public.social_comments;
create policy social_comments_update on public.social_comments for update
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

drop policy if exists social_comments_delete on public.social_comments;
create policy social_comments_delete on public.social_comments for delete
  using (auth.uid() = author_id);

-- ─── engagement (likes / saves) ──────────────────────────────────────────────

create table if not exists public.social_engagement (
  target_kind text not null check (target_kind in ('post', 'reel', 'comment')),
  target_id text not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('like', 'save')),
  created_at timestamptz not null default now(),
  primary key (target_kind, target_id, user_id, kind)
);

create index if not exists social_engagement_target_idx
  on public.social_engagement (target_kind, target_id, kind);

alter table public.social_engagement enable row level security;

drop policy if exists social_engagement_select on public.social_engagement;
create policy social_engagement_select on public.social_engagement for select
  using (auth.uid() is not null);

drop policy if exists social_engagement_insert on public.social_engagement;
create policy social_engagement_insert on public.social_engagement for insert
  with check (auth.uid() = user_id);

drop policy if exists social_engagement_delete on public.social_engagement;
create policy social_engagement_delete on public.social_engagement for delete
  using (auth.uid() = user_id);

-- ─── stories (24h segments) ──────────────────────────────────────────────────

create table if not exists public.social_stories (
  id text primary key,
  author_id uuid not null references public.profiles (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists social_stories_author_idx
  on public.social_stories (author_id, created_at desc);

create index if not exists social_stories_expires_idx
  on public.social_stories (expires_at);

alter table public.social_stories enable row level security;

drop policy if exists social_stories_select on public.social_stories;
create policy social_stories_select on public.social_stories for select
  using (auth.uid() is not null and expires_at > now());

drop policy if exists social_stories_insert on public.social_stories;
create policy social_stories_insert on public.social_stories for insert
  with check (auth.uid() = author_id);

drop policy if exists social_stories_delete on public.social_stories;
create policy social_stories_delete on public.social_stories for delete
  using (auth.uid() = author_id);

-- ─── profile privacy (private accounts) ──────────────────────────────────────

alter table public.profiles
  add column if not exists is_private boolean not null default false;

-- ─── realtime ────────────────────────────────────────────────────────────────

do $$
begin
  alter publication supabase_realtime add table public.social_comments;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.social_engagement;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.social_stories;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
