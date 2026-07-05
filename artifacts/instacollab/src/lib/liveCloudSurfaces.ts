/**
 * One live-data pipeline for every major surface (messages, notifications,
 * feed/posts, reels, stories, live, party, karaoke, thoughts, profile).
 *
 * Shared tables use Supabase Realtime; personal collections use user_app_state.
 * Opening a tab always pulls the latest internet state for that surface.
 */
import { flushCloudAppStateSync } from './auth/cloudAppState';
import { isCloudAuthConfigured } from './auth/config';
import { isCloudAuthUserId } from './auth/cloudProfile';
import {
  startCloudChatRealtime,
  stopCloudChatRealtime,
  syncCloudChatInbox,
} from './chat/cloudChatSync';
import {
  startCloudNotificationRealtime,
  stopCloudNotificationRealtime,
  syncCloudNotifications,
} from './cloudNotificationSync';
import {
  startCloudPostRealtimeSync,
  stopCloudPostRealtimeSync,
  syncOwnPostsToCloud,
} from './cloudPostSync';
import {
  startCloudBlocksRealtime,
  stopCloudBlocksRealtime,
  syncCloudBlocks,
} from './cloudSocial/cloudBlocks';
import {
  startCloudSocialRealtime,
  stopCloudSocialRealtime,
  syncCloudSocialFeed,
  syncCloudStories,
  syncCloudUserSocial,
} from './cloudSocial/cloudSocialContent';
import { hydrateCloudFollowsForUser } from './cloudSocial/followsSync';
import {
  startCloudProfileVisitsRealtime,
  stopCloudProfileVisitsRealtime,
  syncCloudProfileVisits,
} from './cloudSocial/cloudProfileVisits';
import { db } from './db/localDb';
import { scheduleLiveSessionSync } from './liveSessionSync';
import { isNetworkOnline } from './networkStatus';
import { postPresenceHeartbeat } from './platformApi';
import {
  initThoughtNoteCloudSync,
  refreshThoughtNotesFromCloud,
  teardownThoughtNoteCloudSync,
} from './thoughtNoteCloudSync';
import './liveDataFlowMap';

export type LiveCloudSurface =
  | 'messages'
  | 'notifications'
  | 'home'
  | 'feed'
  | 'reels'
  | 'search'
  | 'live'
  | 'party'
  | 'karaoke'
  | 'profile'
  | 'stories'
  | 'thoughts'
  | 'comments'
  | 'all';

let activeUserId: string | null = null;
let presenceTimer: number | null = null;
let inboxTimer: number | null = null;
let stopPostsRealtime: (() => void) | null = null;
let stopSocialRealtime: (() => void) | null = null;
let stopBlocksRealtime: (() => void) | null = null;
let stopVisitsRealtime: (() => void) | null = null;

function canRunCloud(userId?: string | null): userId is string {
  return (
    !!userId &&
    isCloudAuthConfigured() &&
    isCloudAuthUserId(userId) &&
    isNetworkOnline()
  );
}

function dispatchSurfaceRefresh(surface: LiveCloudSurface): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('live-cloud-surface-refresh', { detail: { surface } }),
  );
}

async function beatPresence(): Promise<void> {
  const meId = db.currentUserId;
  if (!canRunCloud(meId)) return;
  try {
    const following = db.getFollowingIds(meId);
    const friendIds = following.filter((id) => isCloudAuthUserId(id)).slice(0, 40);
    await postPresenceHeartbeat(friendIds);
  } catch {
    /* presence is best-effort */
  }
}

/** Map Shell / Karaoke tab ids onto a live surface. */
export function liveSurfaceFromTab(tab: string | null | undefined): LiveCloudSurface {
  switch (String(tab || '').trim()) {
    case 'messages':
      return 'messages';
    case 'notifications':
      return 'notifications';
    case 'home':
    case 'feed':
      return 'home';
    case 'reels':
      return 'reels';
    case 'search':
      return 'search';
    case 'live':
      return 'live';
    case 'party':
    case 'rooms':
      return 'party';
    case 'karaoke':
    case 'sing':
    case 'challenge':
    case 'leaderboard':
    case 'genres':
    case 'top100':
      return 'karaoke';
    case 'profile':
      return 'profile';
    case 'stories':
      return 'stories';
    default:
      return 'all';
  }
}

/** Start all internet realtime channels for the signed-in cloud user. */
export function startLiveCloudSurfaces(userId: string): void {
  if (!isCloudAuthConfigured() || !isCloudAuthUserId(userId)) return;

  if (activeUserId === userId && stopPostsRealtime) {
    void refreshLiveCloudSurface('all');
    return;
  }

  stopLiveCloudSurfaces();
  activeUserId = userId;

  void startCloudChatRealtime(userId);
  startCloudNotificationRealtime(userId);
  stopPostsRealtime = startCloudPostRealtimeSync();
  stopSocialRealtime = startCloudSocialRealtime();
  stopBlocksRealtime = startCloudBlocksRealtime(userId);
  stopVisitsRealtime = startCloudProfileVisitsRealtime(userId);
  initThoughtNoteCloudSync();

  void beatPresence();
  presenceTimer = window.setInterval(() => {
    void beatPresence();
  }, 30_000);

  inboxTimer = window.setInterval(() => {
    if (!canRunCloud(db.currentUserId)) return;
    void syncCloudChatInbox();
    void syncCloudNotifications();
  }, 45_000);

  void refreshLiveCloudSurface('all');
}

export function stopLiveCloudSurfaces(): void {
  activeUserId = null;
  if (presenceTimer != null) {
    window.clearInterval(presenceTimer);
    presenceTimer = null;
  }
  if (inboxTimer != null) {
    window.clearInterval(inboxTimer);
    inboxTimer = null;
  }
  stopCloudChatRealtime();
  stopCloudNotificationRealtime();
  stopPostsRealtime?.();
  stopPostsRealtime = null;
  stopCloudPostRealtimeSync();
  stopSocialRealtime?.();
  stopSocialRealtime = null;
  stopCloudSocialRealtime();
  stopBlocksRealtime?.();
  stopBlocksRealtime = null;
  stopCloudBlocksRealtime();
  stopVisitsRealtime?.();
  stopVisitsRealtime = null;
  stopCloudProfileVisitsRealtime();
  teardownThoughtNoteCloudSync();
}

/**
 * Pull latest internet data for one surface (or all).
 * Always deferred past the current tap paint so navigation/buttons stay instant.
 */
export function refreshLiveCloudSurface(surface: LiveCloudSurface | string): void {
  // UI-first: never run network work on the same turn as a tap/setState.
  queueMicrotask(() => {
    requestAnimationFrame(() => {
      refreshLiveCloudSurfaceNow(surface);
    });
  });
}

function refreshLiveCloudSurfaceNow(surface: LiveCloudSurface | string): void {
  const meId = db.currentUserId;
  if (!canRunCloud(meId)) {
    dispatchSurfaceRefresh(liveSurfaceFromTab(surface));
    return;
  }

  const target = (
    surface === 'all' || surface === 'home' || surface === 'feed' || surface === 'reels'
      ? surface
      : liveSurfaceFromTab(surface)
  ) as LiveCloudSurface;

  const tasks: Array<Promise<unknown>> = [];

  const pullSocialFeed = () => {
    tasks.push(syncCloudSocialFeed());
    tasks.push(syncOwnPostsToCloud());
    tasks.push(syncCloudStories());
    tasks.push(flushCloudAppStateSync().catch(() => undefined));
  };

  switch (target) {
    case 'messages':
      void startCloudChatRealtime(meId);
      tasks.push(syncCloudChatInbox());
      break;
    case 'notifications':
      startCloudNotificationRealtime(meId);
      tasks.push(syncCloudNotifications());
      tasks.push(hydrateCloudFollowsForUser(meId));
      break;
    case 'home':
    case 'feed':
    case 'reels':
    case 'comments':
    case 'stories':
      pullSocialFeed();
      break;
    case 'search':
      tasks.push(syncCloudSocialFeed());
      tasks.push(refreshThoughtNotesFromCloud().catch(() => undefined));
      break;
    case 'live':
    case 'party':
      tasks.push(refreshThoughtNotesFromCloud().catch(() => undefined));
      scheduleLiveSessionSync(meId);
      break;
    case 'karaoke':
      scheduleLiveSessionSync(meId);
      tasks.push(flushCloudAppStateSync().catch(() => undefined));
      break;
    case 'profile':
      tasks.push(syncCloudUserSocial(meId));
      tasks.push(hydrateCloudFollowsForUser(meId));
      tasks.push(syncCloudBlocks());
      tasks.push(syncCloudProfileVisits());
      tasks.push(flushCloudAppStateSync().catch(() => undefined));
      tasks.push(refreshThoughtNotesFromCloud().catch(() => undefined));
      break;
    case 'thoughts':
      tasks.push(refreshThoughtNotesFromCloud().catch(() => undefined));
      break;
    case 'all':
    default:
      void startCloudChatRealtime(meId);
      startCloudNotificationRealtime(meId);
      if (!stopSocialRealtime) stopSocialRealtime = startCloudSocialRealtime();
      pullSocialFeed();
      tasks.push(syncCloudChatInbox());
      tasks.push(syncCloudNotifications());
      tasks.push(hydrateCloudFollowsForUser(meId));
      tasks.push(syncCloudBlocks());
      tasks.push(syncCloudProfileVisits());
      tasks.push(refreshThoughtNotesFromCloud().catch(() => undefined));
      scheduleLiveSessionSync(meId);
      void beatPresence();
      break;
  }

  void Promise.allSettled(tasks).finally(() => {
    dispatchSurfaceRefresh(target);
  });
}

/** Hook for screens that keep their own discovery lists (Live / Party). */
export function subscribeLiveCloudSurfaceRefresh(
  surfaces: LiveCloudSurface[],
  onRefresh: () => void,
): () => void {
  if (typeof window === 'undefined') return () => {};
  const wanted = new Set(surfaces);
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<{ surface?: LiveCloudSurface }>).detail;
    const surface = detail?.surface;
    if (!surface || surface === 'all' || wanted.has(surface)) onRefresh();
  };
  window.addEventListener('live-cloud-surface-refresh', handler);
  return () => window.removeEventListener('live-cloud-surface-refresh', handler);
}
