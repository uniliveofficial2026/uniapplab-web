import type { Post } from '../types';
import { db } from './db/localDb';
import {
  APP_MEDIA_PREFIX,
  appMediaIdFromRef,
  hydrateAppMediaUrl,
  isAppMediaRef,
  isUserOwnedMediaUrl,
} from './appMediaStore';
import { isCloudAuthUserId } from './auth/cloudProfile';
import { postUserId } from './safe';
import {
  fetchCloudFeedPosts,
  fetchCloudUserPosts,
  subscribeCloudPosts,
  uploadPostMediaBlob,
  upsertCloudPost,
} from './supabase/cloudPosts';
import { isSupabaseConfigured } from './supabase/config';

let publishInflight = new Map<string, Promise<void>>();
let feedSyncInflight: Promise<void> | null = null;
let userSyncInflight = new Map<string, Promise<void>>();

async function blobFromUrl(url: string): Promise<Blob | null> {
  if (isAppMediaRef(url)) {
    const id = appMediaIdFromRef(url);
    const hydrated = await hydrateAppMediaUrl(url);
    if (hydrated.startsWith('blob:') || hydrated.startsWith('data:')) {
      try {
        const res = await fetch(hydrated);
        return await res.blob();
      } catch {
        return null;
      }
    }
    if (!isAppMediaRef(hydrated)) {
      try {
        const res = await fetch(hydrated);
        return await res.blob();
      } catch {
        return null;
      }
    }
    // load from IDB directly
    const idb = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('AppUserMedia', 1);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result);
    });
    return new Promise((resolve) => {
      const tx = idb.transaction('blobs', 'readonly');
      const store = tx.objectStore('blobs');
      const get = store.get(id);
      get.onsuccess = () => resolve((get.result?.blob as Blob) ?? null);
      get.onerror = () => resolve(null);
    });
  }
  if (url.startsWith('blob:') || url.startsWith('data:')) {
    try {
      const res = await fetch(url);
      return await res.blob();
    } catch {
      return null;
    }
  }
  return null;
}

function guessExt(kind: 'image' | 'video' | 'audio' | 'cover', blob: Blob): string {
  const t = blob.type || '';
  if (t.includes('png')) return 'png';
  if (t.includes('webp')) return 'webp';
  if (t.includes('gif')) return 'gif';
  if (t.includes('webm')) return 'webm';
  if (t.includes('quicktime')) return 'mov';
  if (t.includes('mp4') || t.includes('video')) return 'mp4';
  if (t.includes('mpeg') || t.includes('mp3')) return 'mp3';
  if (t.includes('wav')) return 'wav';
  if (kind === 'video') return 'mp4';
  if (kind === 'audio') return 'mp3';
  return 'jpg';
}

async function cloudifyUrl(
  userId: string,
  postId: string,
  url: string | undefined,
  kind: 'image' | 'video' | 'audio' | 'cover',
): Promise<string | undefined> {
  if (!url || !isUserOwnedMediaUrl(url)) return url;
  const blob = await blobFromUrl(url);
  if (!blob) return url;
  const ext = guessExt(kind, blob);
  const uploaded = await uploadPostMediaBlob(userId, postId, kind, blob, `${kind}.${ext}`);
  return uploaded || url;
}

async function resolvePostMediaForCloud(post: Post): Promise<Post> {
  const userId = postUserId(post);
  const postId = post.id;
  const imageUrl = (await cloudifyUrl(userId, postId, post.imageUrl, 'image')) ?? post.imageUrl;
  const videoUrl = post.videoUrl
    ? (await cloudifyUrl(userId, postId, post.videoUrl, 'video')) ?? post.videoUrl
    : post.videoUrl;
  const audioUrl = post.audioUrl
    ? (await cloudifyUrl(userId, postId, post.audioUrl, 'audio')) ?? post.audioUrl
    : post.audioUrl;
  const audioCoverUrl = post.audioCoverUrl
    ? (await cloudifyUrl(userId, postId, post.audioCoverUrl, 'cover')) ?? post.audioCoverUrl
    : post.audioCoverUrl;

  const mediaList = post.mediaList
    ? await Promise.all(
        post.mediaList.map(async (item) => {
          const kind = item.type === 'video' ? 'video' : item.type === 'audio' ? 'audio' : 'image';
          const url = (await cloudifyUrl(userId, postId, item.url, kind)) ?? item.url;
          const coverUrl = item.coverUrl
            ? (await cloudifyUrl(userId, postId, item.coverUrl, 'cover')) ?? item.coverUrl
            : item.coverUrl;
          return { ...item, url, coverUrl };
        }),
      )
    : post.mediaList;

  return { ...post, imageUrl, videoUrl, audioUrl, audioCoverUrl, mediaList };
}

export async function publishPostToCloud(post: Post): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const authorId = postUserId(post);
  if (!isCloudAuthUserId(authorId)) return;

  const existing = publishInflight.get(post.id);
  if (existing) return existing;

  const job = (async () => {
    try {
      const resolved = await resolvePostMediaForCloud(post);
      const ok = await upsertCloudPost(resolved);
      if (ok) {
        db.mergeInboundPosts([resolved]);
        db.updatePost(resolved.id, () => resolved);
      }
    } catch (err) {
      console.warn('[posts] publish failed:', err instanceof Error ? err.message : err);
    } finally {
      publishInflight.delete(post.id);
    }
  })();

  publishInflight.set(post.id, job);
  return job;
}

const publishQueue = new Map<string, ReturnType<typeof setTimeout>>();

export function scheduleCloudPostPublish(post: Post): void {
  if (!isSupabaseConfigured() || !isCloudAuthUserId(postUserId(post))) return;
  const prev = publishQueue.get(post.id);
  if (prev) clearTimeout(prev);
  publishQueue.set(
    post.id,
    setTimeout(() => {
      publishQueue.delete(post.id);
      void publishPostToCloud(post);
    }, 400),
  );
}

export async function syncCloudFeed(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  if (feedSyncInflight) return feedSyncInflight;

  feedSyncInflight = (async () => {
    try {
      const remote = await fetchCloudFeedPosts();
      if (remote.length) db.mergeInboundPosts(remote);
    } finally {
      feedSyncInflight = null;
    }
  })();

  return feedSyncInflight;
}

export async function syncCloudUserPosts(userId: string): Promise<void> {
  if (!isSupabaseConfigured() || !isCloudAuthUserId(userId)) return;
  const prev = userSyncInflight.get(userId);
  if (prev) return prev;

  const job = (async () => {
    try {
      const remote = await fetchCloudUserPosts(userId);
      if (remote.length) db.mergeInboundPosts(remote);
    } finally {
      userSyncInflight.delete(userId);
    }
  })();

  userSyncInflight.set(userId, job);
  return job;
}

let unsubscribeRealtime: (() => void) | null = null;

export function startCloudPostRealtimeSync(): () => void {
  if (!isSupabaseConfigured()) return () => {};
  if (unsubscribeRealtime) return unsubscribeRealtime;

  unsubscribeRealtime = subscribeCloudPosts(() => {
    void syncCloudFeed();
  });

  return () => {
    unsubscribeRealtime?.();
    unsubscribeRealtime = null;
  };
}

export async function bootstrapCloudPosts(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  await syncCloudFeed();
  startCloudPostRealtimeSync();
}
