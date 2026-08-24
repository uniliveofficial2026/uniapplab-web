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
import { chatService } from '../services/ChatService';
import {
  startCloudNotificationRealtime,
  stopCloudNotificationRealtime,
  syncCloudNotifications,
} from './cloudNotificationSync';
import { startCloudBlocksRealtime, stopCloudBlocksRealtime } from './cloudSocial/cloudBlocks';
import {
  startCloudProfileVisitsRealtime,
  stopCloudProfileVisitsRealtime,
} from './cloudSocial/cloudProfileVisits';
import {
  startCloudPostRealtimeSync,
  stopCloudPostRealtimeSync,
  syncCloudFeed,
  syncCloudUserPosts,
  syncOwnPostsToCloud,
} from './cloudPostSync';
import { hydrateCloudFollowsForUser } from './cloudSocial/followsSync';
import { db } from './db/localDb';
import { scheduleLiveSessionSync } from './liveSessionSync';
import { isNetworkOnline } from './networkStatus';
import { postPresenceHeartbeat } from './platformApi';
import { syncServerWalletBalance } from './walletServerSync';
import { startWalletRealtime, stopWalletRealtime } from './walletRealtime';
import { onUserSessionActive } from './walletKstarSync';
import {
  startPlatformGiftCatalogRealtime,
  stopPlatformGiftCatalogRealtime,
} from './cloudSocial/platformGiftCatalogCloud';
import { startPlatformAppBrandRealtime, stopPlatformAppBrandRealtime } from './cloudSocial/platformAppBrandCloud';
import {
  initThoughtNoteCloudSync,
  refreshThoughtNotesFromCloud,
  teardownThoughtNoteCloudSync,
} from './thoughtNoteCloudSync';
import { surfaceRefreshCooldownMs, inboxPollIntervalMs, presenceBeatIntervalMs } from './liveCloudSyncMode';

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
  | 'workspace'
  | 'wallet'
  | 'dating'
  | 'games'
  | 'all';

let activeUserId: string | null = null;
let presenceTimer: number | null = null;
let inboxTimer: number | null = null;
let stopBlocksRealtime: (() => void) | null = null;
let stopProfileVisitsRealtime: (() => void) | null = null;
let stopPostsRealtime: (() => void) | null = null;
let lastSurfaceRefreshAt = 0;
let surfaceRefreshTimer: number | null = null;
let pendingSurfaceRefresh: LiveCloudSurface = 'all';
let surfaceRefreshInFlight = false;
let queuedSurfaceAfterFlight: LiveCloudSurface | null = null;

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
    const following = db.getFollowingIds?.(meId) ?? [];
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
    case 'workspace':
      return 'workspace';
    case 'wallet':
      return 'wallet';
    case 'dating':
      return 'dating';
    case 'local-games':
    case 'third-party-games':
    case 'game-hub':
    case 'greedy-tap':
      return 'games';
    case 'youtube':
      return 'search';
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
  chatService.startRealtime(userId);
  // Reconstruct inbox from server threads API + history (not local-only map).
  void chatService.loadThreads().then((result) => {
    if (result.ok) void syncCloudChatInbox();
  });
  startCloudNotificationRealtime(userId);
  stopPostsRealtime = startCloudPostRealtimeSync();
  stopBlocksRealtime = startCloudBlocksRealtime(userId);
  stopProfileVisitsRealtime = startCloudProfileVisitsRealtime(userId);
  initThoughtNoteCloudSync();
  startPlatformGiftCatalogRealtime();
  startPlatformAppBrandRealtime();
  startWalletRealtime(userId);

  void beatPresence();
  presenceTimer = window.setInterval(() => {
    void beatPresence();
  }, presenceBeatIntervalMs());

  inboxTimer = window.setInterval(() => {
    const meId = db.currentUserId;
    if (!canRunCloud(meId)) return;
    void syncCloudChatInbox();
    void syncCloudNotifications();
    // Realtime wallet is primary; poll is a reconnect safety net only.
    void syncServerWalletBalance(meId).then(() => onUserSessionActive(meId));
  }, inboxPollIntervalMs());

  void refreshLiveCloudSurface('all');
}

export function stopLiveCloudSurfaces(): void {
  void import('./platformApi').then((mod) => mod.postPresenceOffline?.()).catch(() => undefined);
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
  stopBlocksRealtime?.();
  stopBlocksRealtime = null;
  stopProfileVisitsRealtime?.();
  stopProfileVisitsRealtime = null;
  stopCloudPostRealtimeSync();
  stopPlatformGiftCatalogRealtime();
  stopPlatformAppBrandRealtime();
  stopWalletRealtime();
  teardownThoughtNoteCloudSync();
}

/** Pull latest internet data for one surface (or all). Safe to call often — coalesced silently. */
export function refreshLiveCloudSurface(surface: LiveCloudSurface | string, opts?: { force?: boolean }): void {
  const target = (
    surface === 'all' || surface === 'home' || surface === 'feed' || surface === 'reels'
      ? surface
      : liveSurfaceFromTab(surface)
  ) as LiveCloudSurface;

  const cooldown = surfaceRefreshCooldownMs(target === 'all');
  const now = Date.now();
  if (!opts?.force && lastSurfaceRefreshAt > 0 && now - lastSurfaceRefreshAt < cooldown) {
    pendingSurfaceRefresh = target;
    if (surfaceRefreshTimer == null) {
      surfaceRefreshTimer = window.setTimeout(() => {
        surfaceRefreshTimer = null;
        refreshLiveCloudSurface(pendingSurfaceRefresh, { force: true });
      }, cooldown - (now - lastSurfaceRefreshAt));
    }
    return;
  }
  lastSurfaceRefreshAt = now;
  if (surfaceRefreshTimer != null) {
    window.clearTimeout(surfaceRefreshTimer);
    surfaceRefreshTimer = null;
  }

  runLiveCloudSurfaceRefresh(target);
}

function runLiveCloudSurfaceRefresh(target: LiveCloudSurface): void {
  if (surfaceRefreshInFlight) {
    queuedSurfaceAfterFlight = target;
    return;
  }
  surfaceRefreshInFlight = true;

  const meId = db.currentUserId;
  if (!canRunCloud(meId)) {
    surfaceRefreshInFlight = false;
    dispatchSurfaceRefresh(target);
    const queued = queuedSurfaceAfterFlight;
    queuedSurfaceAfterFlight = null;
    if (queued) queueMicrotask(() => refreshLiveCloudSurface(queued));
    return;
  }

  const tasks: Array<Promise<unknown>> = [];

  const pullSocialFeed = () => {
    tasks.push(syncCloudFeed());
    tasks.push(syncOwnPostsToCloud());
    tasks.push(flushCloudAppStateSync().catch(() => undefined));
  };

  switch (target) {
    case 'messages':
      // Inbox pull only — chat realtime is already started by startLiveCloudSurfaces.
      tasks.push(syncCloudChatInbox());
      break;
    case 'notifications':
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
      tasks.push(syncCloudFeed());
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
      tasks.push(syncCloudUserPosts(meId));
      tasks.push(hydrateCloudFollowsForUser(meId));
      tasks.push(flushCloudAppStateSync().catch(() => undefined));
      tasks.push(refreshThoughtNotesFromCloud().catch(() => undefined));
      break;
    case 'thoughts':
      tasks.push(refreshThoughtNotesFromCloud().catch(() => undefined));
      break;
    case 'workspace':
      pullSocialFeed();
      tasks.push(hydrateCloudFollowsForUser(meId));
      tasks.push(refreshThoughtNotesFromCloud().catch(() => undefined));
      tasks.push(flushCloudAppStateSync().catch(() => undefined));
      void beatPresence();
      break;
    case 'wallet':
      // Wallet realtime is started once in startLiveCloudSurfaces (idempotent).
      scheduleLiveSessionSync(meId);
      tasks.push(syncServerWalletBalance(meId).then(() => onUserSessionActive(meId)));
      tasks.push(flushCloudAppStateSync().catch(() => undefined));
      break;
    case 'dating':
      tasks.push(syncCloudFeed());
      tasks.push(hydrateCloudFollowsForUser(meId));
      tasks.push(flushCloudAppStateSync().catch(() => undefined));
      break;
    case 'games':
      scheduleLiveSessionSync(meId);
      tasks.push(flushCloudAppStateSync().catch(() => undefined));
      break;
    case 'all':
    default:
      // Realtime channels stay up from startLiveCloudSurfaces; only pull data here.
      // Re-calling start* on every refresh caused postgres_changes-after-subscribe throws → blank UI.
      pullSocialFeed();
      tasks.push(syncCloudChatInbox());
      tasks.push(syncCloudNotifications());
      tasks.push(hydrateCloudFollowsForUser(meId));
      tasks.push(refreshThoughtNotesFromCloud().catch(() => undefined));
      tasks.push(syncServerWalletBalance(meId).then(() => onUserSessionActive(meId)));
      scheduleLiveSessionSync(meId);
      void beatPresence();
      break;
  }

  void Promise.allSettled(tasks).finally(() => {
    surfaceRefreshInFlight = false;
    dispatchSurfaceRefresh(target);
    const queued = queuedSurfaceAfterFlight;
    queuedSurfaceAfterFlight = null;
    if (queued && queued !== target) {
      queueMicrotask(() => refreshLiveCloudSurface(queued));
    }
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
