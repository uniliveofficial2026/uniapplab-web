import type { Post, User } from '../types';
import {
  resolveAppMediaUrlSync,
  resolveRemoteMediaUrlSync,
  isAppMediaRef,
} from './appMediaStore';
import { safeLiveKind } from './liveRing';

const FALLBACK_AVATAR =
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=256&h=256&fit=crop&q=85&auto=format';
const FALLBACK_MEDIA =
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1080&fit=crop&q=85&auto=format';

export { FALLBACK_AVATAR, FALLBACK_MEDIA };

/** Coerce unknown values to a finite number or fallback. */
export function safeNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Non-empty trimmed string or fallback. */
export function safeString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length > 0 && trimmed !== 'undefined' && trimmed !== 'null') {
      return trimmed;
    }
  }
  return fallback;
}

/** Always returns an array (never null/undefined). */
export function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value : [];
}

/** First list item or undefined. */
export function first<T>(items: T[] | null | undefined): T | undefined {
  if (!Array.isArray(items) || items.length === 0) return undefined;
  return items[0];
}

/** Clamp index into array bounds. */
export function safeIndex(index: unknown, length: number, fallback = 0): number {
  const n = safeNumber(index, fallback);
  if (length <= 0) return 0;
  return Math.max(0, Math.min(Math.floor(n), length - 1));
}

type TouchListLike = {
  readonly length: number;
  readonly [index: number]: { clientX: number } | undefined;
};

/** Touch/client X from event (DOM or React synthetic). */
export function touchClientX(touches: TouchListLike | null | undefined): number | null {
  const touch = touches?.[0];
  return touch && Number.isFinite(touch.clientX) ? touch.clientX : null;
}

/** First selected file from input change event. */
export function fileFromInput(
  files: FileList | null | undefined
): File | undefined {
  return files?.[0];
}

/** HTTP(S) URL or empty string if invalid. */
export function safeHttpUrl(value: unknown): string {
  const s = safeString(value);
  if (!s) return '';
  try {
    const url = new URL(s);
    if (url.protocol === 'http:' || url.protocol === 'https:') return s;
  } catch {
    /* invalid */
  }
  return '';
}

export function safeAvatarUrl(value: unknown): string {
  const s = safeString(value);
  if (!s) return FALLBACK_AVATAR;
  // Blob URLs are session-only — never use persisted blob refs for avatars.
  if (s.startsWith('blob:')) return FALLBACK_AVATAR;
  if (s.startsWith('data:')) return s;
  if (isAppMediaRef(s)) {
    const resolved = resolveAppMediaUrlSync(s);
    return isAppMediaRef(resolved) ? FALLBACK_AVATAR : resolved;
  }
  const url = safeHttpUrl(s);
  if (!url) return FALLBACK_AVATAR;
  return resolveRemoteMediaUrlSync(url) || url;
}

export function safeMediaUrl(value: unknown, options?: { fallback?: string }): string {
  const s = safeString(value);
  const fallback = options?.fallback ?? '';
  if (!s) return fallback;
  if (isAppMediaRef(s)) {
    const resolved = resolveAppMediaUrlSync(s);
    // Never expose app-media: to the DOM — use fallback until blob is ready.
    if (isAppMediaRef(resolved)) return fallback;
    return resolved;
  }
  if (s.startsWith('data:') || s.startsWith('blob:')) return s;
  const url = safeHttpUrl(s);
  if (!url) return fallback;
  // Prefer full-res on-device blob when we have cached this URL before.
  return resolveRemoteMediaUrlSync(url) || url;
}

/** Keep app-media/data/blob refs for hooks to hydrate; only validate http(s). */
export function preserveMediaRef(value: unknown): string {
  const s = safeString(value);
  if (!s) return '';
  if (isAppMediaRef(s) || s.startsWith('data:') || s.startsWith('blob:')) return s;
  return safeHttpUrl(s);
}

/** HTTP(S) / blob / data / app-media video URL — never substitutes an image URL as video src. */
export function safeVideoUrl(value: unknown): string {
  const s = safeString(value);
  if (!s) return '';
  if (isAppMediaRef(s)) {
    const resolved = resolveAppMediaUrlSync(s);
    if (isAppMediaRef(resolved)) return s;
    return resolved;
  }
  if (s.startsWith('data:') || s.startsWith('blob:')) return s;
  return safeHttpUrl(s);
}

export type ResolvedPostMedia = {
  type: 'image' | 'video' | 'audio';
  url: string;
  posterUrl: string;
  /** When true, render poster/image instead of a video element. */
  showAsImage: boolean;
};

/** Normalize post media for feed/modal rendering with safe URLs and image fallback for bad videos. */
export function resolvePostDisplayMedia(post: Post, mediaIdx = 0): ResolvedPostMedia {
  const list = safeArray<{
    url: string;
    type: 'image' | 'video' | 'audio';
    name: string;
    coverUrl?: string;
  }>(post.mediaList);

  const item = list.length > 0 ? (list[safeIndex(mediaIdx, list.length)] ?? list[0]) : null;

  let type: 'image' | 'video' | 'audio' = 'image';
  let rawUrl: string;

  if (item) {
    type = item.type === 'video' || item.type === 'audio' ? item.type : 'image';
    rawUrl = item.url;
  } else if (post.videoUrl) {
    type = 'video';
    rawUrl = post.videoUrl;
  } else {
    rawUrl = post.imageUrl;
  }

  const posterRef =
    item?.coverUrl ||
    post.audioCoverUrl ||
    post.imageUrl ||
    (type === 'image' ? rawUrl : '');
  const posterUrl = preserveMediaRef(posterRef);

  if (type === 'video') {
    const videoUrl = preserveMediaRef(rawUrl);
    if (!videoUrl) {
      return { type: 'image', url: posterUrl, posterUrl, showAsImage: true };
    }
    return { type: 'video', url: videoUrl, posterUrl, showAsImage: false };
  }

  if (type === 'audio') {
    return {
      type: 'audio',
      url: preserveMediaRef(rawUrl),
      posterUrl,
      showAsImage: false,
    };
  }

  return {
    type: 'image',
    url: preserveMediaRef(rawUrl || post.imageUrl),
    posterUrl,
    showAsImage: false,
  };
}

export function safeUsername(value: unknown, fallback = 'user'): string {
  return safeString(value, fallback).replace(/^@/, '') || fallback;
}

export function safeUserId(value: unknown): string | null {
  const id = safeString(value);
  return id.length > 0 ? id : null;
}

/** Merge partial user with safe display fields. */
export function normalizeUser(
  user: Partial<User> | null | undefined,
  fallback?: Partial<User>
): User {
  const base = fallback ?? {
    id: 'unknown',
    username: 'user',
    displayName: 'User',
    avatarUrl: FALLBACK_AVATAR,
  };
  const id = safeUserId(user?.id) ?? safeUserId(base.id) ?? 'unknown';
  const status = (user?.status ?? base.status) as User['status'] | undefined;
  return {
    ...base,
    ...(user ?? {}),
    id,
    username: safeUsername(user?.username ?? base.username),
    displayName: safeString(user?.displayName ?? base.displayName, 'User'),
    avatarUrl: safeAvatarUrl(user?.avatarUrl ?? base.avatarUrl),
    status,
    liveKind: safeLiveKind(user?.liveKind ?? base.liveKind, status),
  };
}

export function findUserById(
  users: User[] | null | undefined,
  userId: string | null | undefined,
  fallback?: Partial<User>
): User {
  const id = safeUserId(userId);
  if (!id) return normalizeUser(fallback);
  const found = safeArray<User>(users).find((u) => u?.id === id);
  return normalizeUser(found, fallback);
}

/**
 * Resolve a user for UI: prefer the canonical record in `users`, fall back to an embedded snapshot.
 * Use this anywhere posts/reels/notifications embed a `user` object so all screens stay in sync.
 */
export function resolveUser(
  users: Array<User | null | undefined> | null | undefined,
  embedded: Partial<User> | null | undefined,
  fallback?: Partial<User>
): User {
  const id =
    safeUserId(embedded?.id) ??
    safeUserId(fallback?.id);
  if (!id) return normalizeUser(embedded, fallback);
  const canonical = safeArray<User>(users).find((u) => u?.id === id);
  if (canonical) {
    return normalizeUser({ ...embedded, ...canonical, id });
  }
  return normalizeUser(embedded, fallback);
}

export function postUserId(post: { user?: User } | null | undefined): string | null {
  return safeUserId(post?.user?.id);
}

export function reelUserId(reel: { user?: User } | null | undefined): string | null {
  return safeUserId(reel?.user?.id);
}

/** Pick a user from a list by modulo index (workspace task assignees, etc.). */
export function userAtModuloIndex(
  users: User[] | null | undefined,
  index: unknown,
  fallback?: Partial<User>
): User {
  const list = safeArray<User>(users);
  if (list.length === 0) return normalizeUser(fallback);
  const n = safeNumber(index, 0);
  const idx = ((Math.floor(n) % list.length) + list.length) % list.length;
  return normalizeUser(list[idx], fallback);
}

/** Coerce unknown values to a list of non-empty user ids. */
export function safeIdArray(value: unknown): string[] {
  return safeArray(value)
    .map((id) => safeUserId(id))
    .filter((id): id is string => id !== null);
}

export type CrossPostKey = 'twitter' | 'facebook' | 'tumblr';

export {
  isVideoElementNativeFullscreen,
  tryEnterVideoFullscreen,
  tryExitVideoFullscreen,
} from './nativeVideoPlatform';

export function toggleCrossPostOption(
  prev: Record<CrossPostKey, boolean>,
  key: CrossPostKey
): Record<CrossPostKey, boolean> {
  return { ...prev, [key]: !prev[key] };
}
