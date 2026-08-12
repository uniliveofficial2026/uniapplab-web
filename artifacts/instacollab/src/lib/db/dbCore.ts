import { USERS } from '../data';
import type {
  ChatMessage,
  ChatWallpaperItem,
  ChatWallpapersStore,
  MessagesByChatStore,
} from '../dbTypes';
import {
  backfillMessageTimestamps,
  ensureMessageId,
  normalizeTimestampValue,
  sanitizeMessageMedia,
} from '../dbMessageUtils';
import {
  limitNewest,
  retentionLimit,
  shouldSkipAutoRetention,
  type RetentionKind,
} from '../dbRetention';
import { buildStorageStats } from '../dbStorageStats';
import { recordCollectionSave } from '../devActivity';
import type { CommentLike, CommentThreadStore } from '../entityResolve';
import type { StoriesByUserStore } from '../../types';
import type { LocalDB } from './localDbType';
import type { DbCoreStartupHost } from './startupHost';
import type { Listener } from './types';
import { isCloudSyncCollectionKey } from '../cloudSync/collectionKeys';
import type { CloudSyncCollectionKey } from '../cloudSync/collectionKeys';
import { scheduleCloudAppStateSync } from '../auth/cloudAppState';
import { writeSessionCache, syncSessionCacheFromLoginMirror } from '../sessionCache';
import { healLaunchProgressForReturningUser } from '../launchRoute';
import { normalizeUsersThoughtEpochs } from '../thoughtNoteLiveSync';

/**
 * Ephemeral keys only — safe to drop without losing posts, stories, messages, etc.
 * Used by `clearCache()` (settings → storage). Not a full local reset.
 */
const CLEAR_CACHE_EPHEMERAL_KEYS = new Set([
  'storage_device_estimate',
  'cloud_meta',
]);

/**
 * Keys mirrored to localStorage for instant restore on refresh/reopen
 * (available synchronously before IndexedDB opens).
 */
const LOCAL_STORAGE_MIRROR_KEYS = new Set([
  'isLoggedIn',
  'currentUserId',
  'app_settings',
  'launch_progress',
  'users',
  'posts',
  'reels',
  'messages',
  'stories',
  'chat_groups',
  'chat_cloud_thread_map',
  'chat_read_state',
  'notification_inbox',
  'coins_balance',
  'karaoke_user_state',
  'game_coins',
  'cash_balance',
]);

const MIRROR_POSTS_CAP = 40;
const MIRROR_REELS_CAP = 24;
const MIRROR_USERS_CAP = 80;
const MIRROR_CHAT_CAP = 12;
const MIRROR_MSGS_PER_CHAT = 30;

/** Cap large collections so localStorage stays under quota. */
function capValueForLocalStorageMirror(key: string, data: unknown): unknown {
  if (key === 'posts' && Array.isArray(data)) {
    return data.slice(0, MIRROR_POSTS_CAP);
  }
  if (key === 'reels' && Array.isArray(data)) {
    return data.slice(0, MIRROR_REELS_CAP);
  }
  if (key === 'users' && Array.isArray(data)) {
    return data.slice(0, MIRROR_USERS_CAP);
  }
  if (key === 'messages' && data && typeof data === 'object' && !Array.isArray(data)) {
    const entries = Object.entries(data as Record<string, unknown[]>).slice(0, MIRROR_CHAT_CAP);
    const next: Record<string, unknown[]> = {};
    for (const [chatId, list] of entries) {
      next[chatId] = Array.isArray(list) ? list.slice(-MIRROR_MSGS_PER_CHAT) : [];
    }
    return next;
  }
  return data;
}

export class DbCore {
    /** Typed view of the fully composed DB (all domain mixins). */
    protected asLocalDB(): LocalDB {
      return this as unknown as LocalDB;
    }

    protected channel: BroadcastChannel | null = null;
    protected listeners: Set<Listener> = new Set();
    /** DEV: coalesce burst saves into one React update per frame. */
    protected notifyFlushScheduled = false;
    protected cache: Record<string, unknown> = {};
    protected db: IDBDatabase | null = null;
    protected isInitialized = false;
    protected autoSyncTimer: number | null = null;
    protected cloudSyncInProgress = false;
    /** While applying remote cloud snapshot — skips outbound push to avoid loops. */
    public cloudSyncSuppressPush = false;
    protected followGraphEnsured = false;
    /** Ignore our own BroadcastChannel sync so async IDB writes are not overwritten. */
    protected readonly syncTabId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `tab_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    /** IndexedDB open + cache hydrate — safe for login/sign-up before demo seeding finishes. */
    protected storageReadyPromise: Promise<void>;
    /** Full startup (migrations, demo stories, notifications, …). */
    protected initPromise: Promise<void>;

    constructor(..._args: any[]) {
      // 1) Sync hydrate from localStorage — UI works on refresh/reopen before IDB.
      this.hydrateFromLocalStorageMirror();

      // 2) Async full hydrate from IDB (authoritative), then silent cloud sync.
      this.storageReadyPromise = this.initIDB().then(() => {
        // Seed localStorage mirrors so the *next* refresh/reopen is instant.
        this.mirrorCriticalKeysToLocalStorage();
        this.notifyListeners();
      });

      this.initPromise = this.storageReadyPromise
        .then(async () => {
          const host = this as unknown as DbCoreStartupHost;
          host.migrateGlobalMuteDefault();
          this.ensureCurrentUserStorageTier();
          host.trimHighChurnCollections();
          // Mark ready for UI before optional demo/backfill work.
          this.isInitialized = true;
          host.notifyListeners();

          // Background enrichment — never blocks first visible frame.
          void (async () => {
            try {
              await host.seedDemoStoriesIfNeeded();
              host.ensureFollowGraph();
              host.ensureDemoProfileVisitors();
              host.backfillProfileVisitorSurfaces();
              host.purgeHiddenProfileVisitEntries();
              host.enforcePremiumExpiryForCurrentUser();
              host.migrateLegacyNotificationsInbox();
              host.compactNotificationInboxForCurrentUser();
              host.ensureDemoNotifications();
              await host.refreshStorageDeviceEstimate();
              host.notifyListeners();
            } catch (err) {
              console.error('[db] background startup failed:', err);
            }
          })();
        })
        .catch((err) => {
          console.error('[db] startup failed:', err);
          this.isInitialized = true;
          this.notifyListeners();
        });

      try {
        if (typeof window !== 'undefined' && window.BroadcastChannel) {
          this.channel = new BroadcastChannel('app-sync');
          this.channel.onmessage = (event) => {
            const data = event.data;
            if (
              typeof data === 'object' &&
              data?.from === this.syncTabId
            ) {
              return;
            }
            if (data === 'sync' || data?.t === 'sync') {
              if (
                typeof data === 'object' &&
                data?.key &&
                Object.prototype.hasOwnProperty.call(data, 'value')
              ) {
                this.cache[data.key as string] = data.value;
                this.dispatchCollectionLiveEvent(data.key as string);
                this.notifyListeners();
                return;
              }
              void this.refreshFromDB().then(() => this.notifyListeners());
            }
          };
        }
      } catch (e) {
        console.warn('BroadcastChannel not available:', e);
      }
    }

    /** Wait until IndexedDB is open and the in-memory cache is loaded. */
    whenStorageReady() {
      return this.storageReadyPromise;
    }

    /** Write capped UI snapshot to localStorage for the next cold start. */
    protected mirrorCriticalKeysToLocalStorage(): void {
      if (typeof localStorage === 'undefined') return;
      for (const key of LOCAL_STORAGE_MIRROR_KEYS) {
        if (!(key in this.cache)) continue;
        try {
          localStorage.setItem(
            key,
            JSON.stringify(capValueForLocalStorageMirror(key, this.cache[key])),
          );
        } catch {
          /* quota */
        }
      }
      // Keep session hint in sync for instant main-shell on reopen.
      try {
        const userId = this.cache.currentUserId;
        const loggedIn = this.cache.isLoggedIn;
        const users = this.cache.users;
        if (
          loggedIn &&
          typeof userId === 'string' &&
          Array.isArray(users)
        ) {
          const me = (users as Array<{ id?: string; username?: string; displayName?: string; avatarUrl?: string }>).find(
            (u) => u?.id === userId,
          );
          if (me?.id) {
            const progress = this.cache.launch_progress as
              | { profileSetupComplete?: boolean }
              | undefined;
            writeSessionCache(
              {
                id: me.id,
                username: me.username || 'user',
                displayName: me.displayName || 'User',
                avatarUrl: me.avatarUrl || '',
              },
              { profileSetupComplete: progress?.profileSetupComplete ?? true },
            );
          }
        }
      } catch {
        /* ignore */
      }
    }

    /** Instant restore from localStorage mirrors (runs before IDB). */
    protected hydrateFromLocalStorageMirror(): void {
      if (typeof localStorage === 'undefined') return;
      let hydrated = false;
      for (const key of LOCAL_STORAGE_MIRROR_KEYS) {
        try {
          const raw = localStorage.getItem(key);
          if (raw == null || raw === '' || raw === 'undefined') continue;
          this.cache[key] = JSON.parse(raw);
          hydrated = true;
        } catch {
          /* ignore bad JSON */
        }
      }
      // Also restore session hint user into users[] if missing.
      if (hydrated) {
        try {
          const hintRaw = localStorage.getItem('ic_session_cache_v1');
          if (hintRaw) {
            const hint = JSON.parse(hintRaw) as {
              userId?: string;
              username?: string;
              displayName?: string;
              avatarUrl?: string;
            };
            if (hint?.userId) {
              const users = Array.isArray(this.cache.users)
                ? (this.cache.users as Array<{ id?: string }>)
                : [];
              if (!users.some((u) => u?.id === hint.userId)) {
                this.cache.users = [
                  ...users,
                  {
                    id: hint.userId,
                    username: hint.username || 'user',
                    displayName: hint.displayName || 'User',
                    avatarUrl: hint.avatarUrl || '',
                    bio: '',
                    followers: 0,
                    following: 0,
                  },
                ];
              }
              if (this.cache.isLoggedIn == null) this.cache.isLoggedIn = true;
              if (this.cache.currentUserId == null) this.cache.currentUserId = hint.userId;
            }
          }
        } catch {
          /* ignore */
        }
      }
      syncSessionCacheFromLoginMirror(this.cache);
      healLaunchProgressForReturningUser(this as unknown as LocalDB);
    }

    whenReady() {
      return this.initPromise;
    }

    hasStorageBackend(): boolean {
      return this.db !== null;
    }

    protected async initIDB(): Promise<IDBDatabase> {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open('AppDB', 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          this.db = request.result;
          void this.refreshFromDB().then(() => resolve(request.result));
        };
        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains('collections')) {
            db.createObjectStore('collections');
          }
        };
      });
    }

    protected async refreshFromDB(): Promise<void> {
      if (!this.db) return;
      return new Promise((resolve, reject) => {
        const store = this.db!.transaction(['collections'], 'readonly').objectStore(
          'collections'
        );
        const valuesRequest = store.getAll();
        const keysRequest = store.getAllKeys();
        valuesRequest.onsuccess = () => {
          const values = valuesRequest.result;
          keysRequest.onsuccess = () => {
            const keys = keysRequest.result as string[];
            keys.forEach((key, i) => {
              this.cache[key] = values[i];
            });
            resolve();
          };
        };
        valuesRequest.onerror = () => reject(valuesRequest.error);
        keysRequest.onerror = () => reject(keysRequest.error);
      });
    }

    protected notifyListeners() {
      // Always coalesce to one microtask flush — taps/likes/saves feel instant
      // (one paint) instead of N synchronous full-tree re-renders per gesture.
      if (this.notifyFlushScheduled) return;
      this.notifyFlushScheduled = true;
      queueMicrotask(() => {
        this.notifyFlushScheduled = false;
        this.listeners.forEach((l) => {
          try {
            l();
          } catch (err) {
            console.warn('[db] listener failed:', err);
          }
        });
      });
    }

    protected dispatchCollectionLiveEvent(key: string): void {
      if (typeof window === 'undefined') return;
      switch (key) {
        case 'karaoke_uploads':
          window.dispatchEvent(new CustomEvent('karaoke-uploads-updated'));
          break;
        case 'karaoke_profile_backgrounds':
          window.dispatchEvent(new CustomEvent('karaoke-profile-background-updated'));
          break;
        case 'karaoke_recordings':
          window.dispatchEvent(new CustomEvent('karaoke-recordings-updated'));
          break;
        case 'karaoke_user_state':
          window.dispatchEvent(new CustomEvent('kstar-user-state-updated'));
          break;
        case 'coins_balance':
          window.dispatchEvent(new CustomEvent('wallet-coins-updated'));
          break;
        case 'admin_published_gifts':
          window.dispatchEvent(new CustomEvent('party-gift-catalog-updated'));
          break;
        case 'users':
          window.dispatchEvent(
            new CustomEvent('thought-note-live', { detail: { changedUserIds: [] } }),
          );
          break;
        default:
          break;
      }
    }

    /** Merge array entities by id — keeps local-only rows (no flash/wipe on reconnect). */
    private mergeRemoteEntityArray<T extends { id?: string }>(
      local: T[],
      remote: T[],
      mergeRow: (localRow: T, remoteRow: T) => T,
    ): T[] {
      const byId = new Map<string, T>();
      for (const row of local) {
        if (row?.id) byId.set(String(row.id), row);
      }
      for (const row of remote) {
        if (!row?.id) continue;
        const id = String(row.id);
        const existing = byId.get(id);
        byId.set(id, existing ? mergeRow(existing, row) : row);
      }
      return Array.from(byId.values());
    }

    private mergeRemoteCollectionsValue(key: string, remoteValue: unknown): unknown {
      const localValue = this.cache[key];

      if (key === 'posts' && Array.isArray(remoteValue) && Array.isArray(localValue)) {
        type PostRow = import('../../types').Post;
        const merged = this.mergeRemoteEntityArray(
          localValue as PostRow[],
          remoteValue as PostRow[],
          (localRow, remoteRow) => ({
            ...localRow,
            ...remoteRow,
            // Preserve in-progress local engagement so reconnect doesn't flash toggles.
            isLiked: localRow.isLiked,
            isSaved: localRow.isSaved,
          }),
        );
        return merged.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
      }

      if (key === 'reels' && Array.isArray(remoteValue) && Array.isArray(localValue)) {
        type ReelRow = import('../../types').Reel;
        const merged = this.mergeRemoteEntityArray(
          localValue as ReelRow[],
          remoteValue as ReelRow[],
          (localRow, remoteRow) => ({
            ...localRow,
            ...remoteRow,
            isLiked: localRow.isLiked,
            isSaved: localRow.isSaved,
          }),
        );
        return merged.sort(
          (a, b) =>
            new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime(),
        );
      }

      if (key === 'users' && Array.isArray(remoteValue)) {
        type UserRow = import('../../types').User;
        const localUsers = Array.isArray(localValue) ? (localValue as UserRow[]) : [];
        const remoteUsers = normalizeUsersThoughtEpochs(remoteValue as UserRow[]);
        return this.mergeRemoteEntityArray(localUsers, remoteUsers, (localRow, remoteRow) => ({
          ...localRow,
          ...remoteRow,
          id: remoteRow.id,
        }));
      }

      if (
        (key === 'admin_published_gifts' || key === 'admin_published_beauty') &&
        Array.isArray(remoteValue) &&
        Array.isArray(localValue)
      ) {
        type CatalogRow = { id?: string; updatedAt?: number };
        return this.mergeRemoteEntityArray(
          localValue as CatalogRow[],
          remoteValue as CatalogRow[],
          (localRow, remoteRow) => {
            const localAt = localRow.updatedAt ?? 0;
            const remoteAt = remoteRow.updatedAt ?? 0;
            return remoteAt >= localAt
              ? { ...localRow, ...remoteRow }
              : { ...remoteRow, ...localRow };
          },
        );
      }

      if (
        (key === 'messages' || key === 'post_comments' || key === 'reel_comments') &&
        remoteValue &&
        typeof remoteValue === 'object' &&
        !Array.isArray(remoteValue)
      ) {
        const localMap =
          localValue && typeof localValue === 'object' && !Array.isArray(localValue)
            ? (localValue as Record<string, unknown[]>)
            : {};
        const remoteMap = remoteValue as Record<string, unknown[]>;
        const next: Record<string, unknown[]> = { ...localMap };
        for (const [chatId, remoteList] of Object.entries(remoteMap)) {
          if (!Array.isArray(remoteList)) continue;
          const localList = Array.isArray(localMap[chatId]) ? localMap[chatId] : [];
          const byKey = new Map<string, unknown>();
          for (const item of localList) {
            const row = item as { id?: string; cloudId?: string; timestamp?: number };
            const k = String(row.id || row.cloudId || `${row.timestamp}`);
            byKey.set(k, item);
          }
          for (const item of remoteList) {
            const row = item as { id?: string; cloudId?: string; timestamp?: number };
            const k = String(row.id || row.cloudId || `${row.timestamp}`);
            const existing = byKey.get(k) as Record<string, unknown> | undefined;
            byKey.set(k, existing ? { ...existing, ...row } : item);
          }
          next[chatId] = Array.from(byKey.values());
        }
        return next;
      }

      return remoteValue;
    }

    /** Merge collections from cloud realtime / bootstrap without re-pushing. */
    public applyRemoteCollections(
      collections: Partial<Record<CloudSyncCollectionKey, unknown>>
    ) {
      this.cloudSyncSuppressPush = true;
      const idbWrites: Promise<void>[] = [];
      let changed = false;
      try {
        for (const [key, value] of Object.entries(collections)) {
          if (!isCloudSyncCollectionKey(key) || value === undefined) continue;
          // Merge social collections so reconnect never wipes/flashes local cache.
          let nextValue = this.mergeRemoteCollectionsValue(key, value);
          if (key === 'users' && Array.isArray(nextValue)) {
            nextValue = normalizeUsersThoughtEpochs(nextValue as import('../../types').User[]);
          }
          // Skip no-op writes to avoid useless re-renders.
          if (this.cache[key] === nextValue) continue;
          this.cache[key] = nextValue;
          changed = true;
          if (import.meta.env.DEV) recordCollectionSave(key, nextValue);
          if (LOCAL_STORAGE_MIRROR_KEYS.has(key)) {
            try {
              localStorage.setItem(
                key,
                JSON.stringify(capValueForLocalStorageMirror(key, nextValue)),
              );
            } catch {
              /* quota */
            }
          }
          if (this.db) {
            idbWrites.push(this.persistToIDBWithoutNotify(key, nextValue));
          }
          this.dispatchCollectionLiveEvent(key);
        }
        if (!changed) return;
        this.notifyListeners();
        this.postSyncMessage();
        if (idbWrites.length) {
          void Promise.all(idbWrites).catch((err) => {
            console.warn('[db] batch IDB persist after remote sync failed:', err);
          });
        }
      } finally {
        this.cloudSyncSuppressPush = false;
      }
    }

    /**
     * New cloud account with no `user_app_state` row yet — drop demo/local social data
     * so the first push does not upload seed posts for a different user id.
     */
    public prepareLocalStoreForFirstCloudSession(userId: string): void {
      const app = this.asLocalDB();
      const me =
        app.currentUserId === userId
          ? app.currentUser
          : app.users.find((u) => u?.id === userId);
      const cleared = {
        posts: [],
        reels: [],
        messages: {},
        post_comments: {},
        reel_comments: {},
        stories: {},
        profile_stories: {},
        story_views: {},
        notifications: [],
        notification_inbox: {},
        follow_graph: { following: {} },
        blocked_users: {},
        profile_visits: [],
        workspace_tasks: [],
        workspace_files: [],
        workspace_auditLogs: [],
        chat_presence: {},
        chat_read_state: {},
        chat_peer_read_state: {},
        chat_wallpapers: {},
        dating_state: {
          likedUserIds: [],
          passedUserIds: [],
          matchedUserIds: [],
        },
        karaoke_uploads: [],
        karaoke_profile_backgrounds: {},
        karaoke_recordings: [],
        karaoke_user_state: {},
        coins_balance: 0,
        game_coins: {
          pubg: 0,
          roblox: 0,
          mobile_legends: 0,
          in_house: 0,
          slot_game: 0,
        },
        cash_balance: 0,
        wallet_transactions: [],
        unreadMessagesCount: 0,
        hasUnreadNotifications: false,
      } as Partial<Record<CloudSyncCollectionKey, unknown>>;
      if (me) cleared.users = [me];
      this.applyRemoteCollections(cleared);
      this.save('profile_stories_migrated', true);
      this.save('user_app_state_local_rev', { userId, updatedAt: 0 });
    }

    /** IDB write only — used when batching remote sync (avoid N full save() cycles). */
    protected persistToIDBWithoutNotify(key: string, data: unknown): Promise<void> {
      if (!this.db) {
        this.cache[key] = data;
        return Promise.resolve();
      }
      return new Promise<void>((resolve) => {
        try {
          const transaction = this.db!.transaction(['collections'], 'readwrite');
          const store = transaction.objectStore('collections');
          const request = store.put(data, key);
          request.onsuccess = () => {
            this.cache[key] = data;
            resolve();
          };
          request.onerror = () => resolve();
        } catch {
          this.cache[key] = data;
          resolve();
        }
      });
    }

    protected trimHighChurnCollections() {
      if (this.shouldSkipAutoRetention()) return;

      try {
        const audit = this.load('workspace_auditLogs', []);
        const auditLimit = this.retentionLimit('audit');
        if (Array.isArray(audit) && audit.length > auditLimit) {
          this.save('workspace_auditLogs', this.limitNewest(audit, auditLimit));
        }

        const reels = this.load('reels', []);
        const reelsLimit = this.retentionLimit('reels');
        if (Array.isArray(reels) && reels.length > reelsLimit) {
          this.save('reels', this.limitNewest(reels, reelsLimit));
        }

        const posts = this.load('posts', []);
        const postsLimit = this.retentionLimit('posts');
        if (Array.isArray(posts) && posts.length > postsLimit) {
          this.save('posts', this.limitNewest(posts, postsLimit));
        }

        const stories = this.load('stories', {});
        if (stories && typeof stories === 'object') {
          const nextStories: StoriesByUserStore = { ...stories };
          let storiesChanged = false;
          Object.keys(nextStories).forEach((userId) => {
            const list = nextStories[userId];
            const storiesLimit = this.retentionLimit('stories');
            if (Array.isArray(list) && list.length > storiesLimit) {
              nextStories[userId] = this.limitNewest(list, storiesLimit);
              storiesChanged = true;
            }
          });
          if (storiesChanged) {
            this.save('stories', nextStories);
          }
        }

        const profileStories = this.load('profile_stories', {});
        if (profileStories && typeof profileStories === 'object') {
          const nextProfileStories: StoriesByUserStore = { ...profileStories };
          let profileStoriesChanged = false;
          Object.keys(nextProfileStories).forEach((userId) => {
            const list = nextProfileStories[userId];
            const profileStoriesLimit = this.retentionLimit('profile_stories');
            if (Array.isArray(list) && list.length > profileStoriesLimit) {
              nextProfileStories[userId] = this.limitNewest(list, profileStoriesLimit);
              profileStoriesChanged = true;
            }
          });
          if (profileStoriesChanged) {
            this.save('profile_stories', nextProfileStories);
          }
        }

        const messages = this.load('messages', {});
        if (messages && typeof messages === 'object') {
          const nextMessages: MessagesByChatStore = { ...messages };
          let messagesChanged = false;
          Object.keys(nextMessages).forEach((chatId) => {
            const list = nextMessages[chatId];
            if (Array.isArray(list)) {
              const sanitized = list.map((msg: ChatMessage) => this.ensureMessageId(this.sanitizeMessageMedia(msg), chatId));
              const withTimestamps = this.backfillMessageTimestamps(sanitized);
              const messagesLimit = this.retentionLimit('messages');
              const limited =
                withTimestamps.length > messagesLimit
                  ? this.limitNewest(withTimestamps, messagesLimit)
                  : withTimestamps;
              if (
                limited !== list ||
                sanitized.some((m, idx) => m !== list[idx]) ||
                withTimestamps.some((m, idx) => m !== sanitized[idx])
              ) {
                nextMessages[chatId] = limited;
                messagesChanged = true;
              }
            }
          });
          if (messagesChanged) {
            this.save('messages', nextMessages);
          }
        }

        const chatWallpapers = this.load('chat_wallpapers', {});
        if (chatWallpapers && typeof chatWallpapers === 'object') {
          const nextChatWallpapers: ChatWallpapersStore = { ...chatWallpapers };
          let chatWallpapersChanged = false;
          Object.keys(nextChatWallpapers).forEach((chatId) => {
            const entry = nextChatWallpapers[chatId];
            if (!entry || typeof entry !== 'object') {
              delete nextChatWallpapers[chatId];
              chatWallpapersChanged = true;
              return;
            }
            const selectedId = typeof entry.selectedId === 'string' && entry.selectedId.length > 0 ? entry.selectedId : 'default';
            const customWallpapers = Array.isArray(entry.customWallpapers)
              ? entry.customWallpapers.filter((item: ChatWallpaperItem) =>
                  item &&
                  typeof item === 'object' &&
                  typeof item.id === 'string' &&
                  typeof item.kind === 'string' &&
                  (item.kind === 'image' || item.kind === 'video') &&
                  typeof item.value === 'string' &&
                  item.value.length > 0 &&
                  typeof item.label === 'string'
                ).slice(0, 24)
              : [];
            if (selectedId !== entry.selectedId || customWallpapers.length !== (entry.customWallpapers || []).length) {
              nextChatWallpapers[chatId] = { selectedId, customWallpapers };
              chatWallpapersChanged = true;
            }
          });
          if (chatWallpapersChanged) {
            this.save('chat_wallpapers', nextChatWallpapers);
          }
        }

        const reelComments = this.load('reel_comments', {});
        if (reelComments && typeof reelComments === 'object') {
          const nextReelComments: CommentThreadStore = { ...reelComments };
          let reelCommentsChanged = false;
          Object.keys(nextReelComments).forEach((reelId) => {
            const list = nextReelComments[reelId];
            const reelCommentsLimit = this.retentionLimit('reel_comments');
            if (Array.isArray(list) && list.length > reelCommentsLimit) {
              nextReelComments[reelId] = this.limitNewest(list, reelCommentsLimit);
              reelCommentsChanged = true;
            }
          });
          if (reelCommentsChanged) {
            this.save('reel_comments', nextReelComments);
          }
        }

        const postComments = this.load('post_comments', {});
        if (postComments && typeof postComments === 'object') {
          const nextPostComments: CommentThreadStore = { ...postComments };
          let postCommentsChanged = false;
          Object.keys(nextPostComments).forEach((postId) => {
            const list = nextPostComments[postId];
            if (Array.isArray(list)) {
              const sanitized = list.map((comment: CommentLike) => this.sanitizeMessageMedia(comment));
              const postCommentsLimit = this.retentionLimit('post_comments');
              const limited =
                sanitized.length > postCommentsLimit
                  ? this.limitNewest(sanitized, postCommentsLimit)
                  : sanitized;
              if (limited !== list || sanitized.some((c, idx) => c !== list[idx])) {
                nextPostComments[postId] = limited;
                postCommentsChanged = true;
              }
            }
          });
          if (postCommentsChanged) {
            this.save('post_comments', nextPostComments);
          }
        }
      } catch (e) {
        console.warn('Failed to trim high-churn collections', e);
      }
    }

    protected sanitizeMessageMedia<T extends Record<string, unknown>>(entity: T): T {
      return sanitizeMessageMedia(entity);
    }

    protected ensureMessageId(message: ChatMessage, chatId: string): ChatMessage {
      return ensureMessageId(message, chatId);
    }

    protected normalizeTimestampValue(value: unknown): number | null {
      return normalizeTimestampValue(value);
    }

    protected backfillMessageTimestamps(messages: ChatMessage[]): ChatMessage[] {
      return backfillMessageTimestamps(messages);
    }

    public subscribe(listener: Listener) {
      this.listeners.add(listener);
      return () => this.listeners.delete(listener);
    }

    getStorageTier(): '50GB' | '100GB' | 'Unlimited' {
      const tier = (this as unknown as LocalDB).currentUser?.storageTier;
      if (tier === '100GB' || tier === 'Unlimited') return tier;
      return '50GB';
    }

    hasUnlimitedPlan(): boolean {
      return this.getStorageTier() === 'Unlimited';
    }

    /** Backfill storage tier from seed user when older local DB rows omit it. */
    protected ensureCurrentUserStorageTier() {
      const host = this as unknown as DbCoreStartupHost;
      const id = host.currentUserId;
      const template = USERS.find((u) => u.id === id);
      if (!template?.storageTier) return;
      const current = host.users.find((u) => u?.id === id);
      if (current && !current.storageTier) {
        host.updateUser(id, (u) => ({ ...u, storageTier: template.storageTier }));
      }
    }

    /** Unlimited plan (or offline backup mode) keeps full local retention. */
    protected shouldSkipAutoRetention(): boolean {
      const host = this as unknown as LocalDB;
      return shouldSkipAutoRetention(this.hasUnlimitedPlan(), !!host.settings.offlineSync);
    }

    protected retentionLimit(kind: RetentionKind): number {
      const host = this as unknown as LocalDB;
      return retentionLimit(
        kind,
        this.getStorageTier(),
        !!host.settings.offlineSync,
        this.hasUnlimitedPlan()
      );
    }

    protected cappedList<T>(items: T[], kind: RetentionKind): T[] {
      return this.limitNewest(items, this.retentionLimit(kind));
    }

    public setStorageTier(tier: '50GB' | '100GB' | 'Unlimited') {
      const app = this.asLocalDB();
      const userId = app.currentUserId;
      app.updateUser(userId, (u) => ({ ...u, storageTier: tier }));
      if (tier === 'Unlimited') {
        app.updateSettings({ offlineSync: true });
      }
      if (tier !== 'Unlimited' && !app.settings.offlineSync) {
        this.trimHighChurnCollections();
      }
      this.notifyListeners();
    }

    public setOfflineSyncEnabled(enabled: boolean) {
      const app = this.asLocalDB();
      app.updateSettings({ offlineSync: enabled });
      if (!enabled && !this.hasUnlimitedPlan()) {
        this.trimHighChurnCollections();
      }
      this.notifyListeners();
    }

    protected get MAX_ITEMS() {
      if (this.hasUnlimitedPlan()) return 1_000_000;
      if (this.getStorageTier() === '100GB') return 100_000;
      return 5_000;
    }

    protected get MAX_SIZE() {
      if (this.hasUnlimitedPlan()) return Number.POSITIVE_INFINITY;
      if (this.getStorageTier() === '100GB') return 100 * 1024 * 1024 * 1024;
      return 50 * 1024 * 1024 * 1024;
    }

    protected async performStorageCleanup() {
      if (!this.db) return;
      return new Promise<void>((resolve) => {
        const transaction = this.db!.transaction(['collections'], 'readwrite');
        const store = transaction.objectStore('collections');
        const request = store.getAllKeys();

        request.onsuccess = async () => {
          const keys = request.result as string[];
          const keep = [
            'posts',
            'users',
            'isLoggedIn',
            'currentUserId',
            'app_settings',
            'reels',
            'messages',
            'stories',
          ];
          const purgeable = keys.filter((k) => !keep.includes(k));

          const toDeleteCount = Math.ceil(purgeable.length * 0.3);
          for (let i = 0; i < toDeleteCount; i++) {
            store.delete(purgeable[i]);
            delete this.cache[purgeable[i]];
          }
          resolve();
        };
        request.onerror = () => resolve();
      });
    }

    /** Browser quota recovery for Unlimited — drop logs/meta only, keep user content. */
    protected async performLightStorageCleanup() {
      if (!this.db) return;
      return new Promise<void>((resolve) => {
        const transaction = this.db!.transaction(['collections'], 'readwrite');
        const store = transaction.objectStore('collections');
        const request = store.getAllKeys();

        request.onsuccess = () => {
          const keys = request.result as string[];
          const lightPurge = [
            'workspace_auditLogs',
            'cloud_meta',
            'chat_presence',
            'chat_read_state',
            'chat_peer_read_state',
          ];
          keys.forEach((key) => {
            if (lightPurge.includes(key)) {
              store.delete(key);
              delete this.cache[key];
            }
          });
          resolve();
        };
        request.onerror = () => resolve();
      });
    }

    protected async saveToIDB(key: string, data: unknown) {
      if (!this.db) {
         this.cache[key] = data;
         return;
      }
      
      const stats = this.getStorageStats();
      if (!this.hasUnlimitedPlan() && (stats.rawSize > this.MAX_SIZE || stats.items > this.MAX_ITEMS)) {
        await this.performStorageCleanup();
      }

      return new Promise<void>((resolve, reject) => {
        try {
          const transaction = this.db!.transaction(['collections'], 'readwrite');
          const store = transaction.objectStore('collections');
          const request = store.put(data, key);
          
          request.onsuccess = () => {
            this.cache[key] = data;
            this.notifyListeners();
            this.postSyncMessage();
            resolve();
          };
          request.onerror = () => {
            if (request.error?.name === 'QuotaExceededError') {
              const recover = this.hasUnlimitedPlan()
                ? this.performLightStorageCleanup()
                : this.performStorageCleanup();
              recover.then(() => resolve());
            } else {
              reject(request.error);
            }
          };
        } catch (e) {
          console.warn('IDB Transaction Error:', e);
          this.cache[key] = data;
          resolve();
        }
      });
    }

    /** Device/session UI flags — must not trigger cloud push or settings auto-sync. */
    private static readonly LOCAL_ONLY_DB_KEYS = new Set([
      'isFullScreenActive',
      'isCreatorEditingActive',
      'unreadMessagesCount',
      'hasUnreadNotifications',
      'globalMuted',
      'globalMutedDefaultV2',
      'launch_user_gates',
      'launch_progress',
      'account_local_snapshots',
      'user_app_state_local_rev',
      'platform_app_brand_remote',
      'platform_gift_catalog_remote',
    ]);

    public save(key: string, data: unknown) {
      // Synchronous update of cache for immediate UI response
      this.cache[key] = data;
      if (import.meta.env.DEV) recordCollectionSave(key, data);
      this.notifyListeners();
      this.postSyncMessage(key, data);
      this.dispatchCollectionLiveEvent(key);
      this.saveToIDB(key, data).catch(err => {
        console.error(`IDB Save Error for ${key}:`, err);
      });

      // Mirror UI-critical keys to localStorage for seamless refresh/reopen.
      if (LOCAL_STORAGE_MIRROR_KEYS.has(key)) {
        if (key === 'messages') {
          queueMicrotask(() => this.mirrorKeyToLocalStorage(key, data));
        } else {
          this.mirrorKeyToLocalStorage(key, data);
        }
      }

      // Trigger debounced cloud auto-sync for user data mutations only.
      if (!DbCore.LOCAL_ONLY_DB_KEYS.has(key)) {
        this.scheduleAutoCloudSync(key);
      }

      if (
        !this.cloudSyncSuppressPush &&
        this.isInitialized &&
        !DbCore.LOCAL_ONLY_DB_KEYS.has(key)
      ) {
        scheduleCloudAppStateSync(this.asLocalDB(), key);
      }
    }

    /**
     * Hot-path chat signals (typing, ephemeral presence) — instant cache + UI notify;
     * async IDB only; never triggers user_app_state or cloud auto-sync.
     */
    public saveEphemeral(key: string, data: unknown) {
      this.cache[key] = data;
      if (import.meta.env.DEV) recordCollectionSave(key, data);
      // Ephemeral keys (typing, read receipts) must not fan out to every useDB() subscriber.
      queueMicrotask(() => {
        this.saveToIDB(key, data).catch((err) => {
          console.error(`IDB Ephemeral Save Error for ${key}:`, err);
        });
      });
    }

    protected mirrorKeyToLocalStorage(key: string, data: unknown): void {
      try {
        localStorage.setItem(
          key,
          JSON.stringify(capValueForLocalStorageMirror(key, data)),
        );
      } catch {
        try {
          localStorage.removeItem('messages');
          localStorage.removeItem('posts');
          localStorage.setItem(
            key,
            JSON.stringify(capValueForLocalStorageMirror(key, data)),
          );
        } catch {
          /* give up */
        }
      }
    }

    protected scheduleAutoCloudSync(changedKey: string) {
      // Prevent recursion when sync metadata/settings themselves are persisted.
      if (
        changedKey === 'app_settings' ||
        changedKey === 'cloud_meta' ||
        changedKey === 'messages' ||
        changedKey === 'chat_presence' ||
        changedKey === 'chat_read_state' ||
        changedKey === 'chat_peer_read_state' ||
        changedKey === 'chat_groups' ||
        changedKey === 'unreadMessagesCount' ||
        DbCore.LOCAL_ONLY_DB_KEYS.has(changedKey)
      ) {
        return;
      }
      if (!this.isInitialized) return;

      const host = this as unknown as DbCoreStartupHost;
      const settings = host.settings;
      const connection = host.getActiveCloudConnection(settings);
      const canAutoSync =
        settings.cloudAutoSync &&
        settings.cloudSyncEnabled &&
        Boolean(connection?.connected);

      if (!canAutoSync || host.cloudSyncInProgress) return;

      if (host.autoSyncTimer !== null) {
        clearTimeout(host.autoSyncTimer);
        host.autoSyncTimer = null;
      }

      host.autoSyncTimer = window.setTimeout(() => {
        host.autoSyncTimer = null;
        host.syncToCloud(true);
      }, 1200);
    }

    protected limitNewest<T>(items: T[], limit: number): T[] {
      return limitNewest(items, limit);
    }

    protected postSyncMessage(key?: string, value?: unknown) {
      if (!this.channel) return;
      if (key !== undefined) {
        this.channel.postMessage({ t: 'sync', from: this.syncTabId, key, value });
        return;
      }
      this.channel.postMessage({ t: 'sync', from: this.syncTabId });
    }

    public load<T>(key: string, defaultData: T): T {
      if (this.cache[key] !== undefined && this.cache[key] !== null) {
        return this.cache[key] as T;
      }

      // Fallback to localStorage for initial load or essential keys
      try {
        const saved = localStorage.getItem(key);
        if (saved && saved !== 'undefined') return JSON.parse(saved) as T;
      } catch {}

      return defaultData;
    }

    /** Drop derived storage/sync cache only — keeps posts, stories, messages, and settings. */
    public clearCache() {
      for (const key of CLEAR_CACHE_EPHEMERAL_KEYS) {
        delete this.cache[key];
        try {
          localStorage.removeItem(key);
        } catch {
          /* quota */
        }
      }

      const finish = () => {
        void this.refreshStorageDeviceEstimate().finally(() => this.notifyListeners());
      };

      if (!this.db) {
        finish();
        return;
      }

      const transaction = this.db.transaction(['collections'], 'readwrite');
      const store = transaction.objectStore('collections');
      let pending = CLEAR_CACHE_EPHEMERAL_KEYS.size;

      if (pending === 0) {
        finish();
        return;
      }

      for (const key of CLEAR_CACHE_EPHEMERAL_KEYS) {
        const request = store.delete(key);
        request.onsuccess = () => {
          pending -= 1;
          if (pending === 0) finish();
        };
        request.onerror = () => {
          pending -= 1;
          if (pending === 0) finish();
        };
      }
    }

    public getStorageStats() {
      const host = this as unknown as LocalDB;
      const deviceEstimate = this.load('storage_device_estimate', null) as {
        usage?: number;
        quota?: number;
      } | null;
      return buildStorageStats({
        cache: this.cache,
        tier: this.getStorageTier(),
        unlimited: this.hasUnlimitedPlan(),
        offlineSync: !!host.settings.offlineSync,
        deviceEstimate,
      });
    }

    /** Reads real browser storage usage (IndexedDB + caches) for accurate meters. */
    public async refreshStorageDeviceEstimate(): Promise<void> {
      if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return;
      try {
        const { usage = 0, quota = 0 } = await navigator.storage.estimate();
        const prev = this.load('storage_device_estimate', null) as {
          usage?: number;
          quota?: number;
        } | null;
        if (
          prev &&
          typeof prev.usage === 'number' &&
          typeof prev.quota === 'number' &&
          prev.usage === usage &&
          prev.quota === quota
        ) {
          return;
        }
        this.save('storage_device_estimate', { usage, quota, at: Date.now() });
      } catch (e) {
        console.warn('storage.estimate failed', e);
      }
    }
}
