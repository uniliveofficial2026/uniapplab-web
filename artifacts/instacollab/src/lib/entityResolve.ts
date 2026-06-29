/**
 * Merge embedded entity snapshots with the canonical in-memory store.
 * See AGENTS.md — use these at render time so all screens stay in sync.
 */
import type { Post, User } from '../types';
import { findUserById, normalizeUser, postUserId, resolveUser, safeArray, safeUserId, safeUsername } from './safe';
import { normalizeEditorColorFields } from './themeText';

export type CommentLike = {
  id?: string;
  userId?: string;
  username?: string;
  avatarUrl?: string;
  text?: string;
  likes?: number;
  likedBy?: string[];
  replies?: CommentLike[];
  timestamp?: number;
  mediaUrl?: string;
  isVideo?: boolean;
  media?: Array<{ url?: string; isVideo?: boolean; isAudio?: boolean; name?: string }>;
  [key: string]: unknown;
};

export type CommentThreadStore = Record<string, CommentLike[]>;

/** Prefer canonical `posts` row by id; merge with embedded snapshot for display. */
export function resolvePost(
  posts: Post[] | null | undefined,
  embedded: Partial<Post> | null | undefined,
  users?: User[] | null | undefined
): Post {
  const id = safeStringId(embedded?.id);
  if (!id) return normalizePost(embedded, users);
  const canonical = safeArray<Post>(posts).find((p) => p?.id === id);
  if (canonical) {
    return normalizePost(
      {
        ...embedded,
        ...canonical,
        id,
        user: resolveUser(users, canonical.user, embedded?.user),
        // Keep embedded repost snapshot when canonical row omitted it (e.g. partial sync).
        repost: canonical.repost ?? embedded?.repost,
      },
      users
    );
  }
  return normalizePost(embedded, users);
}

/** Shown on feed and profile grids (not archived or reported). */
export function isPostActive(
  post: { isArchived?: boolean; isReported?: boolean } | null | undefined
): boolean {
  if (!post) return false;
  return !post.isArchived && !post.isReported;
}

/** Post appears on someone's Tagged tab (not authored by them). */
export function isPostTaggingUser(
  post: { user?: User; caption?: string; taggedUserIds?: string[] } | null | undefined,
  userId: string,
  username?: string
): boolean {
  if (!userId || postUserId(post) === userId) return false;
  const tagged = post?.taggedUserIds;
  if (Array.isArray(tagged) && tagged.includes(userId)) return true;
  const handle = safeUsername(username);
  if (!handle) return false;
  return (post?.caption ?? '').toLowerCase().includes(`@${handle}`);
}

/** Prefer canonical `reels` row by id. */
export function resolveReel<T extends { id?: string; user?: User }>(
  reels: T[] | null | undefined,
  embedded: T | null | undefined,
  users?: User[] | null | undefined
): T {
  const id = safeStringId(embedded?.id);
  if (!id) return (embedded ?? {}) as T;
  const canonical = safeArray<T>(reels).find((r) => r?.id === id);
  if (canonical) {
    const merged = {
      ...embedded,
      ...canonical,
      id,
      user: resolveUser(users, canonical.user, embedded?.user),
    };
    return normalizeEditorColorFields(merged as Parameters<typeof normalizeEditorColorFields>[0]) as T;
  }
  return normalizeEditorColorFields(
    (embedded ?? {}) as Parameters<typeof normalizeEditorColorFields>[0]
  ) as T;
}

function safeStringId(value: unknown): string | null {
  const id = typeof value === 'string' ? value.trim() : '';
  return id.length > 0 ? id : null;
}

function normalizePost(
  post: Partial<Post> | null | undefined,
  users?: User[] | null | undefined
): Post {
  const p = post ?? {};
  return {
    id: p.id ?? 'unknown',
    user: p.user ? resolveUser(users, p.user) : normalizeUser(undefined),
    imageUrl: p.imageUrl ?? '',
    videoUrl: p.videoUrl,
    caption: p.caption ?? '',
    likes: p.likes ?? 0,
    comments: p.comments ?? 0,
    createdAt: p.createdAt ?? new Date().toISOString(),
    isLiked: !!p.isLiked,
    isSaved: !!p.isSaved,
    ...p,
  } as Post;
}

/** Resolve comment author from canonical users (by userId, then username). */
export function resolveCommentAuthor(
  users: User[] | null | undefined,
  comment: CommentLike | null | undefined,
  fallback?: Partial<User>
): User {
  const id = safeUserId(comment?.userId);
  if (id) return findUserById(users, id, fallback);
  const byName = safeArray<User>(users).find(
    (u) => safeUsername(u?.username) === safeUsername(comment?.username)
  );
  if (byName) return normalizeUser(byName, fallback);
  return normalizeUser(
    {
      id: comment?.userId ?? 'unknown',
      username: comment?.username ?? 'user',
      displayName: comment?.username ?? 'user',
      avatarUrl: comment?.avatarUrl,
    },
    fallback
  );
}

export function countCommentThread(comments: CommentLike[] | null | undefined): number {
  let total = 0;
  for (const c of safeArray<CommentLike>(comments)) {
    total += 1;
    if (c.replies?.length) total += countCommentThread(c.replies);
  }
  return total;
}

export function patchCommentAuthor(
  comment: CommentLike,
  user: User
): CommentLike {
  const next: CommentLike = {
    ...comment,
    userId: user.id,
    username: user.username,
    avatarUrl: user.avatarUrl,
  };
  if (comment.replies?.length) {
    next.replies = comment.replies.map((r) =>
      commentMatchesUser(r, user.id, user.username)
        ? patchCommentAuthor(r, user)
        : r.replies?.length
          ? { ...r, replies: patchCommentTreeForUser(r.replies, user) }
          : r
    );
  }
  return next;
}

export function commentMatchesUser(
  comment: CommentLike,
  userId: string,
  username: string
): boolean {
  if (comment.userId && comment.userId === userId) return true;
  if (!comment.userId && safeUsername(comment.username) === safeUsername(username)) {
    return true;
  }
  return false;
}

export function patchCommentTreeForUser(
  comments: CommentLike[],
  user: User
): CommentLike[] {
  return comments.map((c) =>
    commentMatchesUser(c, user.id, user.username)
      ? patchCommentAuthor(c, user)
      : c.replies?.length
        ? { ...c, replies: patchCommentTreeForUser(c.replies, user) }
        : c
  );
}

/** Build a comment payload with canonical author fields from the logged-in user. */
export function buildCommentPayload(
  author: Partial<User> | null | undefined,
  text: string,
  extra?: Partial<CommentLike>
): CommentLike {
  const user = normalizeUser(author);
  return {
    userId: user.id,
    username: user.username,
    avatarUrl: user.avatarUrl,
    text,
    ...extra,
  };
}
