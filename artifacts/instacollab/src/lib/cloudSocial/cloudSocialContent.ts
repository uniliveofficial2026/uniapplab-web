/**
 * Cross-user social content: comments, likes/saves, stories, reels (via posts).
 * Local db remains the UI store; this module is the internet transport.
 */
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { StoryDraftMedia } from '../../components/stories/storyDraft';
import type { Post, Reel, User } from '../../types';
import { isCloudAuthUserId } from '../auth/cloudProfile';
import { db } from '../db/localDb';
import type { CommentLike } from '../entityResolve';
import { postUserId, reelUserId, resolveUser, safeUserId } from '../safe';
import { getSupabaseClient } from '../supabase/client';
import {
  deleteCloudPost,
  fetchCloudFeedPosts,
  fetchCloudUserPosts,
} from './postsCloud';
import { fetchProfile, profileRowToUser } from '../supabase/profile';
import type { ProfileRow } from '../supabase/types';
import { isFirebaseConfigured } from '../firebase/config';
import { isSocialCloudAvailable, shouldUseFirebaseForSocialCloud } from '../social/socialCloud';

async function firebaseSocialContent() {
  return import('../firebase/socialContent');
}

export type SocialTargetKind = 'post' | 'reel' | 'comment';
export type SocialEngagementKind = 'like' | 'save';

type CommentRow = {
  id: string;
  target_kind: 'post' | 'reel';
  target_id: string;
  parent_id: string | null;
  author_id: string;
  body: string;
  payload: Record<string, unknown>;
  created_at: string;
};

type EngagementRow = {
  target_kind: SocialTargetKind;
  target_id: string;
  user_id: string;
  kind: SocialEngagementKind;
};

type StoryRow = {
  id: string;
  author_id: string;
  payload: Record<string, unknown>;
  expires_at: string;
  created_at: string;
};

const STORY_TTL_MS = 24 * 60 * 60 * 1000;
let socialRealtime: RealtimeChannel | null = null;
let syncInflight: Promise<void> | null = null;

function meCloudId(): string | null {
  const id = db.currentUserId;
  return id && isCloudAuthUserId(id) ? id : null;
}

function isReelPost(post: Post): boolean {
  const payload = post as Post & { contentKind?: string; isReel?: boolean };
  return payload.contentKind === 'reel' || payload.isReel === true;
}

async function ensureAuthor(userId: string): Promise<User | null> {
  if (!isCloudAuthUserId(userId)) return null;
  const existing = db.users.find((u) => u.id === userId);
  if (existing) return resolveUser(db.users, existing);
  const row = await fetchProfile(userId).catch(() => null);
  if (!row) return null;
  const user = profileRowToUser(row);
  db.cacheDiscoveredUsers([user]);
  return user;
}

// ─── posts / reels publish ───────────────────────────────────────────────────

export function scheduleCloudPostMutation(post: Post): void {
  const authorId = postUserId(post);
  if (!authorId || !isCloudAuthUserId(authorId) || !isSocialCloudAvailable()) return;
  void import('../cloudPostSync').then((m) => m.scheduleCloudPostPublish(post));
}

export function scheduleCloudPostDelete(postId: string, authorId?: string | null): void {
  const me = authorId || meCloudId();
  if (!me || !isCloudAuthUserId(me) || !isSocialCloudAvailable()) return;
  void deleteCloudPost(postId, me).catch((err) => {
    console.warn('[social] post delete failed:', err);
  });
}

export function scheduleCloudReelPublish(reel: Reel): void {
  const authorId = reelUserId(reel);
  if (!authorId || !isCloudAuthUserId(authorId) || !isSocialCloudAvailable()) return;
  const asPost: Post = {
    id: reel.id,
    user: reel.user,
    likes: reel.likes ?? 0,
    comments: reel.comments ?? 0,
    isLiked: !!reel.isLiked,
    isSaved: !!reel.isSaved,
    caption: reel.caption ?? '',
    imageUrl: reel.videoUrl ?? '',
    videoUrl: reel.videoUrl,
    mediaList: reel.mediaList,
    createdAt: reel.createdAt ?? new Date().toISOString(),
    contentKind: 'reel',
    isReel: true,
  } as Post & { contentKind: 'reel'; isReel: true };
  void import('../cloudPostSync').then((m) => m.scheduleCloudPostPublish(asPost));
}

export function scheduleCloudReelDelete(reelId: string, authorId?: string | null): void {
  scheduleCloudPostDelete(reelId, authorId);
}

// ─── comments ────────────────────────────────────────────────────────────────

export function queueCloudCommentPublish(input: {
  targetKind: 'post' | 'reel';
  targetId: string;
  comment: CommentLike;
  parentId?: string | null;
}): void {
  const me = meCloudId();
  if (!me || !isSocialCloudAvailable()) return;
  const id = String(input.comment.id || '').trim();
  if (!id) return;

  const body = String(input.comment.text ?? '').trim();
  const payload = {
    userId: input.comment.userId ?? me,
    likes: input.comment.likes ?? 0,
    timestamp: input.comment.timestamp ?? Date.now(),
  };
  const row: CommentRow = {
    id,
    target_kind: input.targetKind,
    target_id: input.targetId,
    parent_id: input.parentId ?? null,
    author_id: me,
    body,
    payload,
    created_at: new Date(payload.timestamp).toISOString(),
  };

  if (shouldUseFirebaseForSocialCloud(me) && isFirebaseConfigured()) {
    void firebaseSocialContent().then((fb) => {
      if (!fb.isFirebaseSocialContentAvailable()) return;
      return fb.upsertFirebaseComment(row);
    }).catch((err) => {
      console.warn('[social] comment publish failed:', err);
    });
    return;
  }

  const supabase = getSupabaseClient();
  if (!supabase) return;

  void supabase
    .from('social_comments')
    .upsert(
      {
        id,
        target_kind: input.targetKind,
        target_id: input.targetId,
        parent_id: input.parentId ?? null,
        author_id: me,
        body,
        payload,
        created_at: row.created_at,
      },
      { onConflict: 'id' },
    )
    .then(({ error }) => {
      if (error) console.warn('[social] comment publish failed:', error.message);
    });
}

function commentFromRow(row: CommentRow, author: User): CommentLike {
  const payload = row.payload ?? {};
  return {
    id: row.id,
    text: row.body,
    userId: row.author_id,
    user: author,
    likes: Number(payload.likes) || 0,
    replies: [],
    timestamp: Date.parse(row.created_at) || Number(payload.timestamp) || Date.now(),
  };
}

function mergeCommentTree(rows: CommentRow[], authors: Map<string, User>): CommentLike[] {
  const byId = new Map<string, CommentLike>();
  const roots: CommentLike[] = [];

  for (const row of rows) {
    const author =
      authors.get(row.author_id) ??
      resolveUser(db.users, { id: row.author_id, displayName: 'User' });
    byId.set(row.id, commentFromRow(row, author));
  }

  for (const row of rows) {
    const node = byId.get(row.id);
    if (!node) continue;
    if (row.parent_id && byId.has(row.parent_id)) {
      const parent = byId.get(row.parent_id)!;
      parent.replies = parent.replies || [];
      if (!parent.replies.some((r) => r.id === node.id)) {
        parent.replies.push(node);
      }
    } else {
      roots.push(node);
    }
  }

  const sortFn = (a: CommentLike, b: CommentLike) =>
    Number(b.timestamp ?? 0) - Number(a.timestamp ?? 0);
  const sortTree = (list: CommentLike[]) => {
    list.sort(sortFn);
    for (const item of list) {
      if (item.replies?.length) sortTree(item.replies);
    }
  };
  sortTree(roots);
  return roots;
}

async function applyCommentRows(rows: CommentRow[]): Promise<void> {
  if (!rows.length) return;
  const authorIds = [...new Set(rows.map((r) => r.author_id))];
  const authors = new Map<string, User>();
  await Promise.all(
    authorIds.map(async (id) => {
      const user = await ensureAuthor(id);
      if (user) authors.set(id, user);
    }),
  );

  const byTarget = new Map<string, CommentRow[]>();
  for (const row of rows) {
    const key = `${row.target_kind}:${row.target_id}`;
    const list = byTarget.get(key) ?? [];
    list.push(row);
    byTarget.set(key, list);
  }

  for (const [key, targetRows] of byTarget) {
    const [kind, targetId] = key.split(':');
    const tree = mergeCommentTree(targetRows, authors);
    if (kind === 'post') {
      db.mergeInboundPostComments(targetId, tree);
    } else {
      db.mergeInboundReelComments(targetId, tree);
    }
  }
}

export async function syncCloudCommentsForTargets(
  targets: Array<{ kind: 'post' | 'reel'; id: string }>,
): Promise<void> {
  if (!isSocialCloudAvailable() || !targets.length) return;
  const me = meCloudId();

  if (shouldUseFirebaseForSocialCloud(me) && isFirebaseConfigured()) {
    const fb = await firebaseSocialContent();
    if (fb.isFirebaseSocialContentAvailable()) {
      const rows = await fb.fetchFirebaseCommentsForTargets(targets);
      await applyCommentRows(rows);
      return;
    }
  }

  const supabase = getSupabaseClient();
  if (!supabase) return;

  const postIds = targets.filter((t) => t.kind === 'post').map((t) => t.id);
  const reelIds = targets.filter((t) => t.kind === 'reel').map((t) => t.id);
  const rows: CommentRow[] = [];

  if (postIds.length) {
    const { data, error } = await supabase
      .from('social_comments')
      .select('*')
      .eq('target_kind', 'post')
      .in('target_id', postIds)
      .order('created_at', { ascending: true })
      .limit(500);
    if (error) console.warn('[social] comments fetch failed:', error.message);
    else if (data) rows.push(...(data as CommentRow[]));
  }
  if (reelIds.length) {
    const { data, error } = await supabase
      .from('social_comments')
      .select('*')
      .eq('target_kind', 'reel')
      .in('target_id', reelIds)
      .order('created_at', { ascending: true })
      .limit(500);
    if (error) console.warn('[social] reel comments fetch failed:', error.message);
    else if (data) rows.push(...(data as CommentRow[]));
  }

  await applyCommentRows(rows);
}

// ─── engagement ──────────────────────────────────────────────────────────────

export function queueCloudEngagement(input: {
  targetKind: SocialTargetKind;
  targetId: string;
  kind: SocialEngagementKind;
  active: boolean;
}): void {
  const me = meCloudId();
  if (!me || !isSocialCloudAvailable()) return;

  if (shouldUseFirebaseForSocialCloud(me) && isFirebaseConfigured()) {
    const row = {
      target_kind: input.targetKind,
      target_id: input.targetId,
      user_id: me,
      kind: input.kind,
    };
    void firebaseSocialContent().then((fb) => {
      if (!fb.isFirebaseSocialContentAvailable()) return;
      if (input.active) {
        return fb.upsertFirebaseEngagement(row);
      }
      return fb.deleteFirebaseEngagement(row);
    }).catch((err) => {
      console.warn('[social] engagement publish failed:', err);
    });
    return;
  }

  const supabase = getSupabaseClient();
  if (!supabase) return;

  if (input.active) {
    void supabase
      .from('social_engagement')
      .upsert(
        {
          target_kind: input.targetKind,
          target_id: input.targetId,
          user_id: me,
          kind: input.kind,
        },
        { onConflict: 'target_kind,target_id,user_id,kind' },
      )
      .then(({ error }) => {
        if (error) console.warn('[social] engagement upsert failed:', error.message);
      });
    return;
  }

  void supabase
    .from('social_engagement')
    .delete()
    .eq('target_kind', input.targetKind)
    .eq('target_id', input.targetId)
    .eq('user_id', me)
    .eq('kind', input.kind)
    .then(({ error }) => {
      if (error) console.warn('[social] engagement delete failed:', error.message);
    });
}

async function applyEngagementRows(rows: EngagementRow[]): Promise<void> {
  const me = meCloudId();
  const likeCounts = new Map<string, number>();
  const myLikes = new Set<string>();
  const mySaves = new Set<string>();

  for (const row of rows) {
    const key = `${row.target_kind}:${row.target_id}`;
    if (row.kind === 'like') {
      likeCounts.set(key, (likeCounts.get(key) ?? 0) + 1);
      if (me && row.user_id === me) myLikes.add(key);
    } else if (row.kind === 'save' && me && row.user_id === me) {
      mySaves.add(key);
    }
  }

  const postIds = new Set(
    rows.filter((r) => r.target_kind === 'post').map((r) => r.target_id),
  );
  for (const postId of postIds) {
    const key = `post:${postId}`;
    db.applyInboundPostEngagement(postId, {
      likes: likeCounts.get(key) ?? db.posts.find((p) => p.id === postId)?.likes ?? 0,
      isLiked: myLikes.has(key),
      isSaved: mySaves.has(key),
    });
  }

  const reelIds = new Set(
    rows.filter((r) => r.target_kind === 'reel').map((r) => r.target_id),
  );
  for (const reelId of reelIds) {
    const key = `reel:${reelId}`;
    if (!db.reels.some((r) => r.id === reelId)) continue;
    const existing = db.reels.find((r) => r.id === reelId);
    db.applyInboundReelEngagement(reelId, {
      likes: likeCounts.get(key) ?? existing?.likes ?? 0,
      isLiked: myLikes.has(key),
      isSaved: mySaves.has(key),
    });
  }
}

export async function syncCloudEngagementForTargets(
  targets: Array<{ kind: SocialTargetKind; id: string }>,
): Promise<void> {
  if (!isSocialCloudAvailable() || !targets.length) return;
  const me = meCloudId();

  if (shouldUseFirebaseForSocialCloud(me) && isFirebaseConfigured()) {
    const fb = await firebaseSocialContent();
    if (fb.isFirebaseSocialContentAvailable()) {
      const rows = await fb.fetchFirebaseEngagementForTargets(targets);
      await applyEngagementRows(rows);
      return;
    }
  }

  const supabase = getSupabaseClient();
  if (!supabase) return;

  const byKind = new Map<SocialTargetKind, string[]>();
  for (const t of targets) {
    const list = byKind.get(t.kind) ?? [];
    list.push(t.id);
    byKind.set(t.kind, list);
  }

  const rows: EngagementRow[] = [];
  for (const [kind, ids] of byKind) {
    const unique = [...new Set(ids)].slice(0, 80);
    if (!unique.length) continue;
    const { data, error } = await supabase
      .from('social_engagement')
      .select('target_kind, target_id, user_id, kind')
      .eq('target_kind', kind)
      .in('target_id', unique);
    if (error) {
      console.warn('[social] engagement fetch failed:', error.message);
      continue;
    }
    if (data) rows.push(...(data as EngagementRow[]));
  }

  await applyEngagementRows(rows);
}

// ─── stories ─────────────────────────────────────────────────────────────────

export function queueCloudStoryPublish(authorId: string, segment: StoryDraftMedia): void {
  if (!isCloudAuthUserId(authorId) || !isSocialCloudAvailable()) return;
  const me = meCloudId();
  if (!me || me !== authorId) return;

  const id =
    String((segment as { id?: string }).id || '').trim() ||
    `story_${authorId}_${segment.createdAt ?? Date.now()}`;
  const createdAt = Number(segment.createdAt ?? Date.now());
  const expiresAt = new Date(createdAt + STORY_TTL_MS).toISOString();
  const row: StoryRow = {
    id,
    author_id: authorId,
    payload: { ...segment, id, createdAt },
    expires_at: expiresAt,
    created_at: new Date(createdAt).toISOString(),
  };

  if (shouldUseFirebaseForSocialCloud(me) && isFirebaseConfigured()) {
    void firebaseSocialContent().then((fb) => {
      if (!fb.isFirebaseSocialContentAvailable()) return;
      return fb.upsertFirebaseStory(row);
    }).catch((err) => {
      console.warn('[social] story publish failed:', err);
    });
    return;
  }

  const supabase = getSupabaseClient();
  if (!supabase) return;

  void supabase
    .from('social_stories')
    .upsert(
      {
        id,
        author_id: authorId,
        payload: row.payload,
        expires_at: expiresAt,
        created_at: row.created_at,
      },
      { onConflict: 'id' },
    )
    .then(({ error }) => {
      if (error) console.warn('[social] story publish failed:', error.message);
    });
}

function mergeStoryRow(row: StoryRow): void {
  const segment = {
    ...(row.payload as StoryDraftMedia),
    id: row.id,
    createdAt: Date.parse(row.created_at) || Date.now(),
  } as StoryDraftMedia & { id: string };
  db.mergeInboundStorySegment(row.author_id, segment);
  void ensureAuthor(row.author_id);
}

export async function syncCloudStories(): Promise<void> {
  if (!isSocialCloudAvailable()) return;
  const me = meCloudId();

  if (shouldUseFirebaseForSocialCloud(me) && isFirebaseConfigured()) {
    const fb = await firebaseSocialContent();
    if (fb.isFirebaseSocialContentAvailable()) {
      const rows = await fb.fetchFirebaseActiveStories();
      for (const row of rows) mergeStoryRow(row);
      return;
    }
  }

  const supabase = getSupabaseClient();
  if (!supabase) return;

  const { data, error } = await supabase
    .from('social_stories')
    .select('*')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    console.warn('[social] stories fetch failed:', error.message);
    return;
  }
  if (!data?.length) return;

  for (const row of data as StoryRow[]) {
    mergeStoryRow(row);
  }
}

// ─── feed split (posts vs reels) ──────────────────────────────────────────────

export async function syncCloudSocialFeed(): Promise<void> {
  if (!isSocialCloudAvailable()) return;
  if (syncInflight) return syncInflight;

  syncInflight = (async () => {
    try {
      const remote = await fetchCloudFeedPosts(80);
      const posts: Post[] = [];
      const reels: Reel[] = [];

      for (const item of remote) {
        if (isReelPost(item)) {
          reels.push({
            id: item.id,
            user: item.user,
            likes: item.likes ?? 0,
            comments: item.comments ?? 0,
            caption: item.caption ?? '',
            videoUrl: item.videoUrl || item.imageUrl,
            isLiked: !!item.isLiked,
            isSaved: !!item.isSaved,
            createdAt: item.createdAt,
            mediaList: item.mediaList,
          });
        } else {
          posts.push(item);
        }
      }

      if (posts.length) db.mergeInboundPosts(posts);
      if (reels.length) db.mergeInboundReels(reels);

      const targets = [
        ...posts.map((p) => ({ kind: 'post' as const, id: p.id })),
        ...reels.map((r) => ({ kind: 'reel' as const, id: r.id })),
      ];
      await Promise.all([
        syncCloudCommentsForTargets(targets),
        syncCloudEngagementForTargets(targets),
        syncCloudStories(),
      ]);
    } finally {
      syncInflight = null;
    }
  })();

  return syncInflight;
}

export async function syncCloudUserSocial(userId: string): Promise<void> {
  if (!isSocialCloudAvailable() || !isCloudAuthUserId(userId)) return;
  const remote = await fetchCloudUserPosts(userId, 80);
  const posts: Post[] = [];
  const reels: Reel[] = [];
  for (const item of remote) {
    if (isReelPost(item)) {
      reels.push({
        id: item.id,
        user: item.user,
        likes: item.likes ?? 0,
        comments: item.comments ?? 0,
        caption: item.caption ?? '',
        videoUrl: item.videoUrl || item.imageUrl,
        isLiked: !!item.isLiked,
        isSaved: !!item.isSaved,
        createdAt: item.createdAt,
        mediaList: item.mediaList,
      });
    } else {
      posts.push(item);
    }
  }
  if (posts.length) db.mergeInboundPosts(posts);
  if (reels.length) db.mergeInboundReels(reels);
  const targets = [
    ...posts.map((p) => ({ kind: 'post' as const, id: p.id })),
    ...reels.map((r) => ({ kind: 'reel' as const, id: r.id })),
  ];
  await Promise.all([
    syncCloudCommentsForTargets(targets),
    syncCloudEngagementForTargets(targets),
  ]);
}

// ─── realtime ────────────────────────────────────────────────────────────────

let firebaseSocialRealtimeStop: (() => void) | null = null;

export function startCloudSocialRealtime(): () => void {
  stopCloudSocialRealtime();
  if (!isSocialCloudAvailable()) return () => {};

  let timer: number | null = null;
  const schedule = () => {
    if (timer != null) window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      timer = null;
      void syncCloudSocialFeed();
    }, 700);
  };

  const me = meCloudId();
  if (shouldUseFirebaseForSocialCloud(me) && isFirebaseConfigured()) {
    let cancelled = false;
    void firebaseSocialContent().then((fb) => {
      if (cancelled || !fb.isFirebaseSocialContentAvailable()) return;
      firebaseSocialRealtimeStop = fb.subscribeFirebaseSocialContent(schedule);
    });
    return () => {
      cancelled = true;
      stopCloudSocialRealtime();
    };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return () => {};

  socialRealtime = supabase
    .channel(`social-content:${Date.now()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'social_comments' }, schedule)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'social_engagement' }, schedule)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'social_stories' }, schedule)
    .subscribe();

  return stopCloudSocialRealtime;
}

export function stopCloudSocialRealtime(): void {
  firebaseSocialRealtimeStop?.();
  firebaseSocialRealtimeStop = null;
  const supabase = getSupabaseClient();
  if (socialRealtime && supabase) {
    void supabase.removeChannel(socialRealtime);
  }
  socialRealtime = null;
}

/** Apply a single inbound comment row from realtime without full feed pull. */
export async function applyInboundCommentRow(row: CommentRow): Promise<void> {
  await applyCommentRows([row]);
}
