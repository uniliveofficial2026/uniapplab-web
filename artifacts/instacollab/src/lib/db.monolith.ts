import {
  DEFAULT_FOLLOW_GRAPH,
  DEMO_LIVE_KIND_PATCHES,
  DEMO_STORY_SEGMENTS,
  DEMO_USER_STATUS_PATCHES,
  POSTS,
  USERS,
} from './data';
import type {
  AppSettings,
  ChatMessage,
  ChatWallpaperItem,
  ChatWallpapersStore,
  CloudConnection,
  MessageReplyRef,
  MessagesByChatStore,
  WorkspaceAuditLog,
  WorkspaceFile,
  WorkspaceTask,
} from './dbTypes';
import {
  backfillMessageTimestamps,
  ensureMessageId,
  normalizeTimestampValue,
  sanitizeMessageMedia,
} from './dbMessageUtils';
import {
  limitNewest,
  retentionLimit,
  shouldSkipAutoRetention,
  type RetentionKind,
} from './dbRetention';
import { buildStorageStats } from './dbStorageStats';
import { recordCollectionSave } from './devActivity';
import {
  type CommentLike,
  type CommentThreadStore,
  countCommentThread,
  patchCommentTreeForUser,
} from './entityResolve';
import {
  buildCreatorProgress,
  type CreatorActivityStats,
  type CreatorProgress,
} from './creatorXP';
import {
  consolidateProfilePremiumSubscriptions,
  getPackageDurationMs,
  getProfilePremiumAccessStatus,
  getPremiumSubscriptionStatus,
  normalizePremiumSubscriptions,
  userHasPremiumPackage,
  userHasProfilePremium,
} from './premium';
import {
  isProfilePremiumPackageId,
  isProfilePremiumTierId,
  PREMIUM_PACKAGES,
  PROFILE_PREMIUM_ENTITLEMENT_ID,
  type PremiumPackageId,
  type ProfilePremiumTierId,
} from './premiumPackages';
import { LIVE_KIND_LABELS } from './liveRing';
import { notificationDedupeKey } from './notifications';
import {
  buildVisitEvent,
  emptySurfaceCounts,
  type ProfileVisitContext,
  visitContextKey,
} from './profileVisits';
import { postUserId, reelUserId, resolveUser, safeUserId, userAtModuloIndex } from './safe';
import { normalizeEditorColorFields } from './themeText';
import type { StoryDraftMedia } from '../components/stories/storyDraft';
import type {
  AppNotification,
  AppNotificationType,
  ChatPresenceStore,
  ChatTimestampStore,
  CloudSyncResult,
  LiveKind,
  Post,
  PremiumSubscription,
  ProfileVisitEntry,
  ProfileVisitSurface,
  ProfileVisitorRow,
  ProfileVisitorStats,
  Reel,
  StoriesByUserStore,
  User,
} from '../types';

type Listener = () => void;
type CloudDataType = 'photos' | 'videos' | 'files' | 'messages' | 'stories' | 'posts';

export class LocalDB {
  private channel: BroadcastChannel | null = null;
  private listeners: Set<Listener> = new Set();
  private cache: Record<string, unknown> = {};
  private db: IDBDatabase | null = null;
  private isInitialized = false;
  private autoSyncTimer: number | null = null;
  private cloudSyncInProgress = false;
  private followGraphEnsured = false;
  /** Ignore our own BroadcastChannel sync so async IDB writes are not overwritten. */
  private readonly syncTabId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `tab_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  private initPromise: Promise<void>;

  constructor() {
    this.initPromise = this.initIDB().then(async () => {
      this.isInitialized = true;
      this.migrateGlobalMuteDefault();
      this.ensureCurrentUserStorageTier();
      this.trimHighChurnCollections();
      await this.seedDemoStoriesIfNeeded();
      this.ensureFollowGraph();
      this.ensureDemoProfileVisitors();
      this.backfillProfileVisitorSurfaces();
      this.purgeHiddenProfileVisitEntries();
      this.enforcePremiumExpiryForCurrentUser();
      this.migrateLegacyNotificationsInbox();
      this.compactNotificationInboxForCurrentUser();
      this.ensureDemoNotifications();
      await this.refreshStorageDeviceEstimate();
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
            void this.refreshFromDB().then(() => this.notifyListeners());
          }
        };
      }
    } catch (e) {
      console.warn('BroadcastChannel not available:', e);
    }
  }

  whenReady() {
    return this.initPromise;
  }

  private async initIDB(): Promise<IDBDatabase> {
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

  private async refreshFromDB(): Promise<void> {
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

  private notifyListeners() {
    this.listeners.forEach(l => l());
  }

  private trimHighChurnCollections() {
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

  private sanitizeMessageMedia<T extends Record<string, unknown>>(entity: T): T {
    return sanitizeMessageMedia(entity);
  }

  private ensureMessageId(message: ChatMessage, chatId: string): ChatMessage {
    return ensureMessageId(message, chatId);
  }

  private normalizeTimestampValue(value: unknown): number | null {
    return normalizeTimestampValue(value);
  }

  private backfillMessageTimestamps(messages: ChatMessage[]): ChatMessage[] {
    return backfillMessageTimestamps(messages);
  }

  public subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getStorageTier(): '50GB' | '100GB' | 'Unlimited' {
    const tier = this.currentUser?.storageTier;
    if (tier === '100GB' || tier === 'Unlimited') return tier;
    return '50GB';
  }

  hasUnlimitedPlan(): boolean {
    return this.getStorageTier() === 'Unlimited';
  }

  /** Backfill storage tier from seed user when older local DB rows omit it. */
  private ensureCurrentUserStorageTier() {
    const id = this.currentUserId;
    const template = USERS.find((u) => u.id === id);
    if (!template?.storageTier) return;
    const current = this.users.find((u) => u?.id === id);
    if (current && !current.storageTier) {
      this.updateUser(id, (u) => ({ ...u, storageTier: template.storageTier }));
    }
  }

  /** Unlimited plan (or offline backup mode) keeps full local retention. */
  private shouldSkipAutoRetention(): boolean {
    return shouldSkipAutoRetention(this.hasUnlimitedPlan(), !!this.settings.offlineSync);
  }

  private retentionLimit(kind: RetentionKind): number {
    return retentionLimit(
      kind,
      this.getStorageTier(),
      !!this.settings.offlineSync,
      this.hasUnlimitedPlan()
    );
  }

  private cappedList<T>(items: T[], kind: RetentionKind): T[] {
    return this.limitNewest(items, this.retentionLimit(kind));
  }

  public setStorageTier(tier: '50GB' | '100GB' | 'Unlimited') {
    const userId = this.currentUserId;
    this.updateUser(userId, (u) => ({ ...u, storageTier: tier }));
    if (tier === 'Unlimited') {
      this.updateSettings({ offlineSync: true });
    }
    if (tier !== 'Unlimited' && !this.settings.offlineSync) {
      this.trimHighChurnCollections();
    }
    this.notifyListeners();
  }

  public setOfflineSyncEnabled(enabled: boolean) {
    this.updateSettings({ offlineSync: enabled });
    if (!enabled && !this.hasUnlimitedPlan()) {
      this.trimHighChurnCollections();
    }
    this.notifyListeners();
  }

  private get MAX_ITEMS() {
    if (this.hasUnlimitedPlan()) return 1_000_000;
    if (this.getStorageTier() === '100GB') return 100_000;
    return 5_000;
  }

  private get MAX_SIZE() {
    if (this.hasUnlimitedPlan()) return Number.POSITIVE_INFINITY;
    if (this.getStorageTier() === '100GB') return 100 * 1024 * 1024 * 1024;
    return 50 * 1024 * 1024 * 1024;
  }

  private async performStorageCleanup() {
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
  private async performLightStorageCleanup() {
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

  private async saveToIDB(key: string, data: unknown) {
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

  private save(key: string, data: unknown) {
    // Synchronous update of cache for immediate UI response
    this.cache[key] = data;
    if (import.meta.env.DEV) recordCollectionSave(key, data);
    this.notifyListeners();
    this.postSyncMessage();
    
    // Background persistence to IndexedDB
    this.saveToIDB(key, data).catch(err => {
      console.error(`IDB Save Error for ${key}:`, err);
    });

    // Also mirror essential small keys to localStorage for faster initial load
    const essentialKeys = ['isLoggedIn', 'currentUserId', 'app_settings', 'users'];
    if (essentialKeys.includes(key)) {
      try {
        localStorage.setItem(key, JSON.stringify(data));
      } catch {}
    }

    // Trigger debounced cloud auto-sync for user data mutations only.
    this.scheduleAutoCloudSync(key);
  }

  private scheduleAutoCloudSync(changedKey: string) {
    // Prevent recursion when sync metadata/settings themselves are persisted.
    if (changedKey === 'app_settings' || changedKey === 'cloud_meta') return;
    if (!this.isInitialized) return;

    const settings = this.settings;
    const connection = this.getActiveCloudConnection(settings);
    const canAutoSync =
      settings.cloudAutoSync &&
      settings.cloudSyncEnabled &&
      Boolean(connection?.connected);

    if (!canAutoSync || this.cloudSyncInProgress) return;

    if (this.autoSyncTimer !== null) {
      clearTimeout(this.autoSyncTimer);
      this.autoSyncTimer = null;
    }

    this.autoSyncTimer = window.setTimeout(() => {
      this.autoSyncTimer = null;
      this.syncToCloud(true);
    }, 1200);
  }

  private limitNewest<T>(items: T[], limit: number): T[] {
    return limitNewest(items, limit);
  }

  private postSyncMessage() {
    this.channel?.postMessage({ t: 'sync', from: this.syncTabId });
  }

  private load<T>(key: string, defaultData: T): T {
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

  get posts(): Post[] {
    const raw = this.load<Post[]>('posts', POSTS) || POSTS;
    return this.filterItemsByBlockedAuthors(raw);
  }
  get users(): User[] {
    return this.load<User[]>('users', USERS) || USERS;
  }
  get isLoggedIn() { return this.load('isLoggedIn', true); }
  get currentUserId() { return this.load('currentUserId', 'u1'); }
  get currentUser() {
    try {
      const users = this.users || [];
      const id = this.currentUserId;
      if (!Array.isArray(users) || users.length === 0) return USERS[0];
      return users.find((u) => u && u.id === id) || users[0] || USERS[0];
    } catch {
      return USERS[0];
    }
  }

  login(userId: string) {
    this.save('currentUserId', userId);
    this.save('isLoggedIn', true);
  }

  logout() {
    this.save('isLoggedIn', false);
  }

  registerUser(user: User) {
    const added = [...this.users, user];
    this.save('users', added);
    this.login(user.id);
    this.syncUserRefsInContent(user.id);
  }

  addPost(post: Partial<Post> & { user?: User }) {
    const author = resolveUser(this.users, post.user, this.currentUser);
    const newPost = {
      ...post,
      user: author,
      id: post.id || `p_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    };
    this.save('posts', this.cappedList([newPost, ...this.posts], 'posts'));
  }

  updatePost(id: string, updateFn: (post: Post) => Post) {
    const before = this.posts.find((p) => p.id === id);
    const updated = this.posts.map((p) => (p.id === id ? updateFn(p) : p));
    this.save('posts', updated);
    const after = updated.find((p) => p.id === id);
    if (
      before &&
      after &&
      (before.imageUrl !== after.imageUrl || before.videoUrl !== after.videoUrl)
    ) {
      this.syncPostMediaInNotifications(after);
    }
  }

  deletePost(id: string) {
    const updated = this.posts.filter((p) => p.id !== id);
    this.save('posts', updated);
  }

  /** Archive or unarchive a post (owner only in UI). Returns new archived state. */
  togglePostArchive(postId: string): boolean {
    let nextArchived = false;
    this.updatePost(postId, (p) => {
      nextArchived = !p.isArchived;
      return { ...p, isArchived: nextArchived };
    });
    return nextArchived;
  }

  updateUser(id: string, updateFn: (user: User) => User) {
    const prior = this.users.find((u: User) => u?.id === id);
    const updated = this.users.map((u) => (u.id === id ? updateFn(u) : u));
    this.save('users', updated);
    const next = updated.find((u: User) => u?.id === id);
    if (prior && next && prior.status !== 'live' && next.status === 'live') {
      this.notifyLiveStarted(id, next.liveKind);
    }
    this.syncUserRefsInContent(id);
  }

  /** Start or end a live stream for a user (updates ring + notifies followers). */
  setUserLiveStatus(
    userId: string,
    isLive: boolean,
    liveKind: LiveKind = 'solo'
  ): boolean {
    const prior = this.users.find((u: User) => u?.id === userId);
    if (!prior) return false;
    const hasStory = (this.stories[userId] ?? []).length > 0;
    this.updateUser(userId, (u) => ({
      ...u,
      status: isLive ? 'live' : hasStory ? 'story' : 'none',
      liveKind: isLive ? liveKind : undefined,
    }));
    return true;
  }

  private mergeUserIntoEmbedded(embedded: Partial<User>, fresh: User) {
    if (!embedded?.id || embedded.id !== fresh.id) return embedded;
    return { ...embedded, ...fresh, id: fresh.id };
  }

  /** Keep embedded user snapshots in content + comments in sync after profile changes. */
  private syncUserRefsInContent(userId: string) {
    const fresh = this.users.find((u) => u?.id === userId);
    if (!fresh) return;
    const merge = (embedded: Partial<User>) => this.mergeUserIntoEmbedded(embedded, fresh);

    const posts = this.posts.map((p) =>
      p?.user?.id === userId ? { ...p, user: merge(p.user) } : p
    );
    this.save('posts', posts);

    const reels = this.reels.map((r) =>
      r?.user?.id === userId ? { ...r, user: merge(r.user) } : r
    );
    this.save('reels', reels);

    this.syncUserRefsInNotificationInboxes(userId, fresh);

    const allStories = this.stories;
    if (allStories && typeof allStories === 'object') {
      let storiesChanged = false;
      const nextStories: StoriesByUserStore = { ...allStories };
      for (const [key, segments] of Object.entries(allStories)) {
        if (!Array.isArray(segments)) continue;
        const updated = segments.map((seg) => {
          const withUser = seg as StoryDraftMedia & { user?: Partial<User> };
          return withUser?.user?.id === userId
            ? { ...withUser, user: merge(withUser.user) }
            : seg;
        });
        if (updated.some((seg, i) => seg !== segments[i])) {
          nextStories[key] = updated;
          storiesChanged = true;
        }
      }
      if (storiesChanged) this.save('stories', nextStories);
    }

    this.syncUserRefsInComments(userId, fresh);
  }

  private syncUserRefsInComments(userId: string, fresh: User) {
    const pComments = this.postComments || {};
    let postCommentsChanged = false;
    const nextPostComments: Record<string, CommentLike[]> = { ...pComments };
    for (const [postId, list] of Object.entries(pComments)) {
      if (!Array.isArray(list)) continue;
      const updated = patchCommentTreeForUser(list as CommentLike[], fresh);
      if (updated.some((c, i) => c !== list[i])) {
        nextPostComments[postId] = updated;
        postCommentsChanged = true;
      }
    }
    if (postCommentsChanged) this.save('post_comments', nextPostComments);

    const rComments = this.reelComments || {};
    let reelCommentsChanged = false;
    const nextReelComments: Record<string, CommentLike[]> = { ...rComments };
    for (const [reelId, list] of Object.entries(rComments)) {
      if (!Array.isArray(list)) continue;
      const updated = patchCommentTreeForUser(list as CommentLike[], fresh);
      if (updated.some((c, i) => c !== list[i])) {
        nextReelComments[reelId] = updated;
        reelCommentsChanged = true;
      }
    }
    if (reelCommentsChanged) this.save('reel_comments', nextReelComments);
  }

  private syncPostCommentCount(postId: string) {
    const total = countCommentThread(this.postComments[postId] || []);
    const posts = this.posts.map((p) =>
      p.id === postId ? { ...p, comments: total } : p
    );
    this.save('posts', posts);
  }

  private syncReelCommentCount(reelId: string) {
    const total = countCommentThread(this.reelComments[reelId] || []);
    const reels = this.reels.map((r) =>
      r.id === reelId ? { ...r, comments: total } : r
    );
    this.save('reels', reels);
  }

  private syncPostMediaInNotifications(post: Post) {
    const thumb = post.imageUrl || post.videoUrl;
    const postId = post?.id;
    if (!thumb && !postId) return;
    const store = this.getNotificationInboxStore();
    let changed = false;
    const next: Record<string, AppNotification[]> = {};
    for (const ownerId of Object.keys(store)) {
      const list = store[ownerId].map((n) => {
        if (postId && n.postId === postId) {
          changed = true;
          return { ...n, postImage: thumb ?? n.postImage };
        }
        if (n?.user?.id === post.user?.id && n.postImage) {
          changed = true;
          return { ...n, postImage: thumb };
        }
        return n;
      });
      next[ownerId] = list;
    }
    if (changed) this.saveNotificationInboxStore(next);
  }

  private enrichCommentPayload(comment: Partial<CommentLike>): CommentLike {
    const me = this.currentUser;
    return {
      ...comment,
      userId: comment.userId ?? me?.id,
      username: comment.username ?? me?.username ?? 'you',
      avatarUrl: comment.avatarUrl ?? me?.avatarUrl,
    };
  }

  togglePostLike(postId: string): boolean {
    const meId = this.currentUserId;
    const post = this.posts.find((p: Post) => p?.id === postId);
    const ownerId = postUserId(post);
    let nextLiked = false;
    this.updatePost(postId, (p) => {
      nextLiked = !p.isLiked;
      const likes = Math.max(0, (Number(p.likes) || 0) + (nextLiked ? 1 : -1));
      return { ...p, isLiked: nextLiked, likes };
    });
    if (nextLiked && meId && ownerId && ownerId !== meId) {
      this.pushNotificationForUser(ownerId, {
        type: 'like',
        actorUserId: meId,
        postId,
        postImage: post?.imageUrl || post?.videoUrl,
      });
    }
    return nextLiked;
  }

  togglePostSave(postId: string): boolean {
    const meId = this.currentUserId;
    const post = this.posts.find((p: Post) => p?.id === postId);
    const ownerId = postUserId(post);
    let nextSaved = false;
    this.updatePost(postId, (p) => {
      nextSaved = !p.isSaved;
      return { ...p, isSaved: nextSaved };
    });
    if (nextSaved && meId && ownerId && ownerId !== meId) {
      this.pushNotificationForUser(ownerId, {
        type: 'activity',
        actorUserId: meId,
        postId,
        postImage: post?.imageUrl || post?.videoUrl,
        title: 'Post saved',
        text: 'saved your post to their collection',
        targetTab: 'home',
      });
    }
    return nextSaved;
  }

  toggleReelLike(reelId: string): boolean {
    const meId = this.currentUserId;
    const reel = this.reels.find((r: Reel) => r?.id === reelId);
    const ownerId = reelUserId(reel);
    let nextLiked = false;
    this.updateReel(reelId, (r) => {
      nextLiked = !r.isLiked;
      const likes = Math.max(0, (Number(r.likes) || 0) + (nextLiked ? 1 : -1));
      return { ...r, isLiked: nextLiked, likes };
    });
    if (nextLiked && meId && ownerId && ownerId !== meId) {
      this.pushNotificationForUser(ownerId, {
        type: 'like',
        actorUserId: meId,
        reelId,
        postImage: reel?.videoUrl,
      });
    }
    return nextLiked;
  }

  toggleReelSave(reelId: string): boolean {
    let nextSaved = false;
    this.updateReel(reelId, (r) => {
      nextSaved = !r.isSaved;
      return { ...r, isSaved: nextSaved };
    });
    return nextSaved;
  }

  private ensureFollowGraph() {
    if (this.followGraphEnsured) return;
    // Mark complete before sync — sync reads the graph via getFollowingIds → getFollowGraph.
    this.followGraphEnsured = true;
    const existing = this.load('follow_graph', null as { following?: Record<string, string[]> } | null);
    if (!existing?.following || typeof existing.following !== 'object') {
      this.save('follow_graph', DEFAULT_FOLLOW_GRAPH);
    }
    this.syncIsFollowingFromGraph();
  }

  getFollowGraph(): { following: Record<string, string[]> } {
    this.ensureFollowGraph();
    return this.load('follow_graph', DEFAULT_FOLLOW_GRAPH) || DEFAULT_FOLLOW_GRAPH;
  }

  getFollowingIds(userId: string): string[] {
    const id = String(userId || '').trim();
    if (!id) return [];
    const list = this.getFollowGraph().following[id];
    return Array.isArray(list) ? [...new Set(list.filter(Boolean))] : [];
  }

  getFollowerIds(userId: string): string[] {
    const id = String(userId || '').trim();
    if (!id) return [];
    const graph = this.getFollowGraph();
    const followers: string[] = [];
    Object.entries(graph.following).forEach(([followerId, list]) => {
      if (followerId !== id && Array.isArray(list) && list.includes(id)) {
        followers.push(followerId);
      }
    });
    return [...new Set(followers)];
  }

  isFollowingUser(targetUserId: string): boolean {
    const meId = this.currentUserId;
    if (!targetUserId || targetUserId === meId) return false;
    return this.getFollowingIds(meId).includes(targetUserId);
  }

  getUsersByIds(userIds: string[]) {
    const users = this.users;
    const seen = new Set<string>();
    const result: typeof users = [];
    userIds.forEach((id) => {
      if (!id || seen.has(id)) return;
      seen.add(id);
      const u = users.find((row) => row?.id === id);
      if (u) result.push(u);
    });
    return result;
  }

  /** Keep `isFollowing` on user rows aligned with the graph for the logged-in viewer. */
  private syncIsFollowingFromGraph() {
    const meId = this.currentUserId;
    const following = new Set(this.getFollowingIds(meId));
    const updated = this.users.map((u) => {
      if (!u?.id || u.id === meId) {
        const { isFollowing: _removed, ...rest } = u;
        return rest;
      }
      return { ...u, isFollowing: following.has(u.id) };
    });
    this.save('users', updated);
  }

  private setUserFollows(followerId: string, followingIds: string[]) {
    const graph = this.getFollowGraph();
    const next = {
      following: {
        ...graph.following,
        [followerId]: [...new Set(followingIds.filter(Boolean))],
      },
    };
    this.save('follow_graph', next);
    if (followerId === this.currentUserId) {
      this.syncIsFollowingFromGraph();
    }
  }

  /**
   * Toggle whether the logged-in user follows `targetUserId`.
   * Updates graph, follower/following counts, and embedded user refs across the app.
   * @returns new following state, or null if invalid.
   */
  toggleFollow(targetUserId: string): boolean | null {
    const meId = this.currentUserId;
    if (!targetUserId || targetUserId === meId) return null;

    const target = this.users.find((u) => u?.id === targetUserId);
    if (!target) return null;

    const nextFollowing = !this.isFollowingUser(targetUserId);
    const delta = nextFollowing ? 1 : -1;

    const myFollowing = this.getFollowingIds(meId);
    const nextList = nextFollowing
      ? [...myFollowing, targetUserId]
      : myFollowing.filter((id) => id !== targetUserId);
    this.setUserFollows(meId, nextList);

    this.updateUser(targetUserId, (u) => ({
      ...u,
      isFollowing: nextFollowing,
      followers: Math.max(0, (Number(u.followers) || 0) + delta),
    }));

    this.updateUser(meId, (u) => ({
      ...u,
      following: Math.max(0, (Number(u.following) || 0) + delta),
    }));

    if (nextFollowing) {
      this.pushNotificationForUser(targetUserId, {
        type: 'follow',
        actorUserId: meId,
      });
    } else {
      this.removeNotificationMatches(targetUserId, {
        type: 'follow',
        actorUserId: meId,
      });
    }

    return nextFollowing;
  }

  private getBlockedUsersStore(): Record<string, string[]> {
    const raw = this.load<Record<string, string[]>>('blocked_users', {});
    return raw && typeof raw === 'object' ? raw : {};
  }

  private saveBlockedUsersStore(store: Record<string, string[]>) {
    this.save('blocked_users', store);
  }

  /** User ids the logged-in viewer has blocked. */
  getBlockedUserIds(): string[] {
    const meId = this.currentUserId;
    const list = this.getBlockedUsersStore()[meId];
    return Array.isArray(list) ? [...new Set(list.filter(Boolean))] : [];
  }

  isUserBlocked(targetUserId: string): boolean {
    const id = String(targetUserId || '').trim();
    if (!id) return false;
    return this.getBlockedUserIds().includes(id);
  }

  private filterItemsByBlockedAuthors<T extends { user?: { id?: string } }>(items: T[]): T[] {
    const blocked = new Set(this.getBlockedUserIds());
    if (blocked.size === 0) return items;
    return items.filter((item) => {
      const authorId = item?.user?.id;
      return !authorId || !blocked.has(authorId);
    });
  }

  /**
   * Block a user for the logged-in viewer. Unfollows if needed and hides their posts/reels.
   * @returns true when the user is blocked after the call.
   */
  blockUser(targetUserId: string): boolean {
    const meId = this.currentUserId;
    const id = String(targetUserId || '').trim();
    if (!id || id === meId) return false;
    if (!this.users.some((u: User) => u?.id === id)) return false;
    if (this.isUserBlocked(id)) return true;

    const store = this.getBlockedUsersStore();
    const list = this.getBlockedUserIds();
    this.saveBlockedUsersStore({ ...store, [meId]: [...list, id] });

    if (this.isFollowingUser(id)) {
      this.toggleFollow(id);
    }

    return true;
  }

  /** Resolved user rows for accounts the logged-in viewer has blocked. */
  getBlockedUsers(): User[] {
    return this.getUsersByIds(this.getBlockedUserIds()).map((u) =>
      resolveUser(this.users, u)
    );
  }

  /** Remove a user from the logged-in viewer's block list. */
  unblockUser(targetUserId: string): boolean {
    const meId = this.currentUserId;
    const id = String(targetUserId || '').trim();
    if (!id || id === meId) return false;

    const store = this.getBlockedUsersStore();
    const list = this.getBlockedUserIds();
    if (!list.includes(id)) return false;

    this.saveBlockedUsersStore({
      ...store,
      [meId]: list.filter((blockedId) => blockedId !== id),
    });
    return true;
  }


  private static readonly PROFILE_VISITS_KEY = 'profile_visits';
  private static readonly PROFILE_VISITS_CAP = 500;

  private getProfileVisitsStore(): Record<string, ProfileVisitEntry[]> {
    const raw = this.load<Record<string, ProfileVisitEntry[]>>(
      LocalDB.PROFILE_VISITS_KEY,
      {}
    );
    return raw && typeof raw === 'object' ? raw : {};
  }

  private saveProfileVisitsStore(store: Record<string, ProfileVisitEntry[]>) {
    this.save(LocalDB.PROFILE_VISITS_KEY, store);
  }

  private getProfileVisitList(profileUserId: string): ProfileVisitEntry[] {
    const id = String(profileUserId || '').trim();
    if (!id) return [];
    const list = this.getProfileVisitsStore()[id];
    return Array.isArray(list) ? list.filter((v) => v?.visitorUserId) : [];
  }

  /** Seed demo visitors for the default account when empty (local dev). */
  /** Whether this profile owner accepts visit tracking (owner's privacy setting). */
  profileVisitorTrackingEnabled(profileUserId: string): boolean {
    const ownerId = String(profileUserId || '').trim();
    if (!ownerId) return false;
    if (ownerId === this.currentUserId) {
      return this.settings.profileVisitorsEnabled !== false;
    }
    const owner = this.users.find((u: User) => u?.id === ownerId);
    return owner?.profileVisitorsEnabled !== false;
  }

  /** Premium-only: browse without recording a profile visit (leave no trace). */
  viewerUsesHiddenVisit(): boolean {
    return (
      this.hasProfilePremium() && this.settings.hiddenProfileViews === true
    );
  }

  /** Remove this viewer from every profile's visitor list (hidden / leave-no-trace mode). */
  private scrubViewerTracesFromAllProfiles(visitorId: string): void {
    const id = String(visitorId || '').trim();
    if (!id) return;
    const store = this.getProfileVisitsStore();
    let changed = false;
    const next: Record<string, ProfileVisitEntry[]> = { ...store };
    for (const ownerId of Object.keys(next)) {
      const list = next[ownerId];
      if (!Array.isArray(list)) continue;
      const filtered = list.filter((v) => v?.visitorUserId !== id);
      if (filtered.length !== list.length) {
        next[ownerId] = filtered;
        changed = true;
      }
    }
    if (changed) {
      this.saveProfileVisitsStore(next);
      this.notifyListeners();
    }
  }

  /** Leave no trace toggle requires active Profile Premium. */
  canUseHiddenVisitorMode(): boolean {
    return this.hasProfilePremium();
  }

  hasPurchasedPremium(packageId: PremiumPackageId): boolean {
    this.enforcePremiumExpiryForCurrentUser();
    return userHasPremiumPackage(this.currentUser, packageId);
  }

  getPremiumSubscriptionStatus(packageId: PremiumPackageId) {
    this.enforcePremiumExpiryForCurrentUser();
    return getPremiumSubscriptionStatus(this.currentUser, packageId);
  }

  getProfilePremiumAccessStatus(now = Date.now()) {
    this.enforcePremiumExpiryForCurrentUser();
    return getProfilePremiumAccessStatus(this.currentUser, now);
  }


  userHasProfilePremium(userId?: string): boolean {
    const id = String(userId || this.currentUserId || '').trim();
    if (!id) return false;
    if (id === this.currentUserId) {
      this.enforcePremiumExpiryForCurrentUser();
    }
    const user = this.users.find((u: User) => u?.id === id);
    return userHasProfilePremium(user);
  }

  hasProfilePremium(): boolean {
    this.enforcePremiumExpiryForCurrentUser();
    return userHasProfilePremium(this.currentUser);
  }

  /** Drop expired subscriptions; disable leave-no-trace when premium lapses. */
  private enforcePremiumExpiryForCurrentUser(): void {
    const meId = this.currentUserId;
    if (!meId) return;
    const me = this.users.find((u: User) => u?.id === meId);
    if (!me) return;

    const now = Date.now();
    const subs = normalizePremiumSubscriptions(me, now);
    const consolidated = consolidateProfilePremiumSubscriptions(subs, now);
    const active = consolidated.filter((s) => s.expiresAt > now);
    const hadActive = userHasProfilePremium(me, now);
    const hasActive = active.some(
      (s) => s.packageId === PROFILE_PREMIUM_ENTITLEMENT_ID
    );

    const stored = me.premiumSubscriptions;
    const legacy = me.purchasedPremiumPackages;
    const needsPersist =
      JSON.stringify(consolidated) !== JSON.stringify(stored ?? []) ||
      (Array.isArray(legacy) && legacy.length > 0) ||
      (!hasActive && hadActive);

    if (!needsPersist) return;

    this.updateUser(meId, (u) => {
      const next: Partial<User> = {
        premiumSubscriptions: consolidated.filter((s) => s.expiresAt > now),
        purchasedPremiumPackages: undefined,
      };
      return { ...u, ...next };
    });

    if (hadActive && !hasActive && this.settings.hiddenProfileViews) {
      this.updateSettings({ hiddenProfileViews: false });
    }
  }

  /** Purchase or extend a profile premium tier (local wallet simulation). */
  purchasePremiumPackage(packageId: PremiumPackageId): {
    ok: boolean;
    reason?: string;
    extended?: boolean;
    expiresAt?: number;
    tierId?: ProfilePremiumTierId;
  } {
    if (!isProfilePremiumTierId(packageId)) {
      return { ok: false, reason: 'Unknown package' };
    }
    const pkg = PREMIUM_PACKAGES[packageId];

    const meId = this.currentUserId;
    const now = Date.now();
    const durationMs = getPackageDurationMs(packageId);
    let expiresAt = now + durationMs;
    let extended = false;

    this.updateUser(meId, (u) => {
      const subs = normalizePremiumSubscriptions(u, now);
      const premiumRows = subs.filter((s) =>
        isProfilePremiumPackageId(s.packageId)
      );
      const prevExpiry = premiumRows.reduce(
        (max, s) => Math.max(max, s.expiresAt),
        0
      );
      extended = prevExpiry > now;
      const base = Math.max(now, prevExpiry);
      expiresAt = base + durationMs;

      const other = subs.filter(
        (s) => !isProfilePremiumPackageId(s.packageId)
      );
      const merged: PremiumSubscription = {
        packageId: PROFILE_PREMIUM_ENTITLEMENT_ID,
        purchasedAt: now,
        expiresAt,
        lastTierId: packageId,
      };
      const nextSubs = consolidateProfilePremiumSubscriptions(
        [...other, merged],
        now
      ).filter((s) => s.expiresAt > now);

      const { purchasedPremiumPackages: _legacy, ...rest } = u;
      return {
        ...rest,
        premiumSubscriptions: nextSubs,
        purchasedPremiumPackages: undefined,
      };
    });

    this.notifyListeners();
    const orderId = `ord${Date.now()}`;
    this.pushNotificationForUser(meId, {
      type: 'order',
      title: 'Order confirmed',
      text: `Order ${orderId} confirmed — $${pkg.price.toFixed(2)}`,
      orderId,
    });

    return { ok: true, extended, expiresAt, tierId: packageId };
  }

  /** Drop legacy hidden rows; leave no trace now skips recording entirely. */
  private purgeHiddenProfileVisitEntries() {
    const store = this.getProfileVisitsStore();
    let changed = false;
    const next: Record<string, ProfileVisitEntry[]> = {};
    for (const ownerId of Object.keys(store)) {
      const list = store[ownerId];
      if (!Array.isArray(list)) continue;
      const filtered = list.filter((v) => v?.visitorUserId && !v.isHidden);
      if (filtered.length !== list.length) changed = true;
      if (filtered.length > 0) next[ownerId] = filtered;
    }
    if (changed) this.saveProfileVisitsStore(next);
  }

  private ownerContentPreview(
    ownerId: string,
    surface: ProfileVisitSurface,
    index: number
  ): { contentId?: string; previewUrl?: string } {
    if (surface === 'posts') {
      const posts = (this.posts ?? []).filter(
        (p: Post) => p?.user?.id === ownerId && !p.isArchived
      );
      const post = posts[index % Math.max(posts.length, 1)];
      if (!post) return {};
      return {
        contentId: post.id,
        previewUrl: post.imageUrl || post.videoUrl,
      };
    }
    if (surface === 'reels') {
      const reels = (this.reels ?? []).filter(
        (r: Reel) => r?.user?.id === ownerId
      );
      const reel = reels[index % Math.max(reels.length, 1)];
      if (!reel) return {};
      return { contentId: reel.id, previewUrl: reel.videoUrl };
    }
    return {};
  }

  private resolveVisitPreviewUrl(
    ownerId: string,
    entry: ProfileVisitEntry
  ): string | undefined {
    if (entry.lastPreviewUrl) return entry.lastPreviewUrl;
    const surface = entry.lastSurface;
    const contentId = entry.lastContentId;
    if (!contentId) return undefined;
    if (surface === 'posts') {
      const post = (this.posts ?? []).find((p: Post) => p.id === contentId);
      if (post?.user?.id === ownerId) return post.imageUrl || post.videoUrl;
    }
    if (surface === 'reels') {
      const reel = (this.reels ?? []).find((r: Reel) => r.id === contentId);
      if (reel?.user?.id === ownerId) return reel.videoUrl;
    }
    return undefined;
  }

  /** Add surface + preview to demo rows created before visit-context tracking. */
  private backfillProfileVisitorSurfaces() {
    const ownerId = this.currentUserId;
    if (!ownerId) return;
    const list = this.getProfileVisitList(ownerId);
    if (list.length === 0 || list.some((e) => e.lastSurface)) return;

    const surfaces: ProfileVisitSurface[] = [
      'profile',
      'posts',
      'reels',
      'story',
      'live',
    ];
    const liveKinds: LiveKind[] = ['solo', 'audio-room', 'pk', 'commerce'];
    const next = list.map((entry, i) => {
      const surface = surfaces[i % surfaces.length];
      const content =
        surface === 'posts' || surface === 'reels'
          ? this.ownerContentPreview(ownerId, surface, i)
          : {};
      const liveKind =
        surface === 'live' ? liveKinds[i % liveKinds.length] : undefined;
      return {
        ...entry,
        lastSurface: surface,
        lastContentId: content.contentId,
        lastPreviewUrl: content.previewUrl,
        lastLiveKind: liveKind,
        recentEvents: [
          buildVisitEvent(entry.lastVisitedAt, {
            surface,
            ...content,
            liveKind,
          }),
        ],
      };
    });
    const store = this.getProfileVisitsStore();
    this.saveProfileVisitsStore({ ...store, [ownerId]: next });
  }

  private ensureDemoProfileVisitors() {
    const ownerId = this.currentUserId;
    if (!ownerId || !this.profileVisitorTrackingEnabled(ownerId)) return;
    if (this.getProfileVisitList(ownerId).length > 0) return;

    const demoVisitorIds = this.getFollowerIds(ownerId).slice(0, 8);
    if (demoVisitorIds.length === 0) return;

    const surfaces: ProfileVisitSurface[] = [
      'profile',
      'posts',
      'reels',
      'story',
      'live',
    ];
    const liveKinds: LiveKind[] = ['solo', 'audio-room', 'pk', 'commerce'];
    const now = Date.now();
    const entries: ProfileVisitEntry[] = demoVisitorIds.map((visitorUserId, i) => {
      const surface = surfaces[i % surfaces.length];
      const at = now - (i + 1) * 45 * 60 * 1000;
      const content =
        surface === 'posts' || surface === 'reels'
          ? this.ownerContentPreview(ownerId, surface, i)
          : {};
      const liveKind =
        surface === 'live' ? liveKinds[i % liveKinds.length] : undefined;
      const event = buildVisitEvent(at, {
        surface,
        ...content,
        liveKind,
      });
      return {
        visitorUserId,
        lastVisitedAt: at,
        visitCount: 1 + (i % 3),
        lastSurface: surface,
        lastContentId: content.contentId,
        lastPreviewUrl: content.previewUrl,
        lastLiveKind: liveKind,
        recentEvents: [event],
      };
    });

    const store = this.getProfileVisitsStore();
    this.saveProfileVisitsStore({ ...store, [ownerId]: entries });
  }

  /**
   * Record that the logged-in viewer opened someone's profile or a section on it.
   * Skips self, blocked users, and duplicate rapid revisits to the same place.
   */
  recordProfileVisit(
    profileUserId: string,
    context?: ProfileVisitContext
  ): boolean {
    const ownerId = String(profileUserId || '').trim();
    const visitorId = this.currentUserId;
    if (!ownerId || !visitorId || ownerId === visitorId) return false;
    if (!this.profileVisitorTrackingEnabled(ownerId)) return false;
    if (this.viewerUsesHiddenVisit()) return false;
    if (this.isUserBlocked(ownerId) || this.isUserBlocked(visitorId)) return false;

    const ctx: ProfileVisitContext = {
      surface: context?.surface ?? 'profile',
      contentId: context?.contentId,
      previewUrl: context?.previewUrl,
      liveKind: context?.liveKind,
    };

    const store = this.getProfileVisitsStore();
    const list = [...this.getProfileVisitList(ownerId)];
    const now = Date.now();
    const idx = list.findIndex((v) => v.visitorUserId === visitorId);
    const prev = idx >= 0 ? list[idx] : undefined;
    const prevCtx: ProfileVisitContext = {
      surface: prev?.lastSurface ?? 'profile',
      contentId: prev?.lastContentId,
      liveKind: prev?.lastLiveKind,
    };

    if (
      prev &&
      now - prev.lastVisitedAt < 60_000 &&
      visitContextKey(prevCtx) === visitContextKey(ctx)
    ) {
      return false;
    }

    const incrementCount = !prev || now - prev.lastVisitedAt >= 60_000;
    const event = buildVisitEvent(now, ctx);
    const recentEvents = [...(prev?.recentEvents ?? []), event].slice(-8);

    const nextEntry: ProfileVisitEntry = {
      visitorUserId: visitorId,
      lastVisitedAt: now,
      visitCount: incrementCount
        ? (prev?.visitCount || 0) + 1
        : prev?.visitCount || 1,
      lastSurface: ctx.surface,
      lastContentId: ctx.contentId,
      lastPreviewUrl: ctx.previewUrl,
      lastLiveKind: ctx.liveKind,
      recentEvents,
      isHidden: false,
    };

    if (idx >= 0) {
      list[idx] = nextEntry;
    } else {
      list.push(nextEntry);
    }

    list.sort((a, b) => b.lastVisitedAt - a.lastVisitedAt);
    const capped = list.slice(0, LocalDB.PROFILE_VISITS_CAP);
    this.saveProfileVisitsStore({ ...store, [ownerId]: capped });
    if (ctx.surface === 'live') {
      this.notifyLiveJoined(ownerId, visitorId, ctx.liveKind);
    }
    this.notifyListeners();
    return true;
  }

  getProfileVisitorStats(profileUserId: string): ProfileVisitorStats {
    const ownerId = String(profileUserId || '').trim();
    const empty = {
      visibleCount: 0,
      hiddenCount: 0,
      totalCount: 0,
      canSeeHidden: false,
      surfaceCounts: emptySurfaceCounts(),
    };
    if (!ownerId || !this.profileVisitorTrackingEnabled(profileUserId)) {
      return empty;
    }

    const entries = this.getProfileVisitList(ownerId).filter(
      (e) => e?.visitorUserId && !this.isUserBlocked(e.visitorUserId)
    );
    const visible = entries.filter((e) => !e.isHidden);
    const surfaceCounts = emptySurfaceCounts();
    for (const entry of visible) {
      const surface = (entry.lastSurface ?? 'profile') as ProfileVisitSurface;
      surfaceCounts[surface] = (surfaceCounts[surface] ?? 0) + 1;
    }

    return {
      visibleCount: visible.length,
      hiddenCount: 0,
      totalCount: visible.length,
      canSeeHidden: false,
      surfaceCounts,
    };
  }

  /** Unique visitors shown in badge (excludes leave-no-trace / legacy hidden rows). */
  getProfileVisitorCount(profileUserId: string): number {
    return this.getProfileVisitorStats(profileUserId).visibleCount;
  }

  /** Visitors with resolved user rows, newest first. Excludes blocked accounts. */
  getProfileVisitors(profileUserId: string): ProfileVisitorRow[] {
    const ownerId = String(profileUserId || '').trim();
    if (!ownerId || !this.profileVisitorTrackingEnabled(profileUserId)) return [];

    const entries = this.getProfileVisitList(ownerId)
      .filter((entry) => !entry.isHidden)
      .sort((a, b) => b.lastVisitedAt - a.lastVisitedAt);

    const rows: ProfileVisitorRow[] = [];
    for (const entry of entries) {
      const user = this.users.find((u: User) => u?.id === entry.visitorUserId);
      if (!user || this.isUserBlocked(user.id)) continue;
      const previewUrl = this.resolveVisitPreviewUrl(ownerId, entry);
      rows.push({
        ...entry,
        lastPreviewUrl: previewUrl ?? entry.lastPreviewUrl,
        user: resolveUser(this.users, user),
      });
    }
    return rows;
  }

  /** Who is visiting — followers, mutuals, verified (for insights banner). */
  getProfileVisitorAudienceSummary(profileUserId: string) {
    const ownerId = String(profileUserId || '').trim();
    const visitors = this.getProfileVisitors(profileUserId).map((r) => r.user);
    const followingIds = new Set(
      ownerId ? this.getFollowingIds(ownerId) : []
    );
    let followingYou = 0;
    let youFollowThem = 0;
    let mutual = 0;
    let verified = 0;
    for (const user of visitors) {
      const theyFollowYou = !!user.isFollowing;
      const youFollow = followingIds.has(user.id);
      if (theyFollowYou) followingYou += 1;
      if (youFollow) youFollowThem += 1;
      if (theyFollowYou && youFollow) mutual += 1;
      if (user.isVerified) verified += 1;
    }
    return {
      followingYou,
      youFollowThem,
      mutual,
      verified,
      notFollowingYou: Math.max(0, visitors.length - followingYou),
      total: visitors.length,
    };
  }

  /** Live creator level + XP from posts, reels, likes, followers, stories, visits. */
  getCreatorProgress(profileUserId: string): CreatorProgress {
    const userId = String(profileUserId || '').trim();
    const user = this.users.find((u: User) => u?.id === userId);
    const posts = this.posts ?? [];
    const reels = this.reels ?? [];

    let likesReceived = 0;
    let postCount = 0;
    for (const raw of posts) {
      if (postUserId(raw) !== userId || raw?.isArchived) continue;
      postCount += 1;
      likesReceived += Math.max(0, Number(raw.likes) || 0);
    }

    let reelCount = 0;
    for (const raw of reels) {
      if (reelUserId(raw) !== userId) continue;
      reelCount += 1;
      likesReceived += Math.max(0, Number(raw.likes) || 0);
    }

    const storySegmentCount = this.getUserStorySegments(userId).length;
    const profileVisitCount = this.profileVisitorTrackingEnabled(userId)
      ? this.getProfileVisitorStats(userId).visibleCount
      : 0;

    const stats: CreatorActivityStats = {
      postCount,
      reelCount,
      likesReceived,
      followers: this.getFollowerIds(userId).length,
      storySegmentCount,
      profileVisitCount,
      hasActivePremium: this.userHasProfilePremium(userId),
    };

    return buildCreatorProgress(stats);
  }

  /** Remove a visitor entry from the owner's history (e.g. dismiss). */
  removeProfileVisitor(profileUserId: string, visitorUserId: string): boolean {
    const meId = this.currentUserId;
    const ownerId = String(profileUserId || '').trim();
    const visitorId = String(visitorUserId || '').trim();
    if (!ownerId || ownerId !== meId || !visitorId) return false;

    const store = this.getProfileVisitsStore();
    const list = this.getProfileVisitList(ownerId);
    const next = list.filter((v) => v.visitorUserId !== visitorId);
    if (next.length === list.length) return false;

    this.saveProfileVisitsStore({ ...store, [ownerId]: next });
    this.notifyListeners();
    return true;
  }

  // Workspace

  get tasks(): WorkspaceTask[] {
    return this.load<WorkspaceTask[]>('workspace_tasks', [
      { id: 101, title: 'Update Marketing Assets', team: 'Design', due: 'Today', user: 1, completed: false },
      { id: 102, title: 'Setup Secure Payment Gateway', team: 'Engineering', due: 'Tomorrow', user: 3, completed: false },
      { id: 103, title: 'Weekly Analytics Review', team: 'Management', due: 'In 2 days', user: 0, completed: true },
    ]) || [];
  }
  
  addTask(task: WorkspaceTask) {
    const newTask = {
      ...task,
      id: task.id || Date.now(),
    };
    this.save('workspace_tasks', [newTask, ...this.tasks]);
    const meId = this.currentUserId;
    const assigneeId = this.resolveTaskAssigneeUserId(newTask);
    if (assigneeId && meId && assigneeId !== meId) {
      this.pushNotificationForUser(assigneeId, {
        type: 'task',
        actorUserId: meId,
        taskId: newTask.id,
        title: 'New task assigned',
        text: `"${newTask.title}" · ${newTask.team ?? 'General'} · Due ${newTask.due ?? 'soon'}`,
        targetTab: 'workspace',
      });
    }
  }

  updateTask(id: number, updateFn: (task: WorkspaceTask) => WorkspaceTask) {
    const prior = this.tasks.find((t) => t.id === id);
    const updated = this.tasks.map((t) => (t.id === id ? updateFn(t) : t));
    this.save('workspace_tasks', updated);
    const next = updated.find((t) => t.id === id);
    if (!prior || !next) return;

    const meId = this.currentUserId;
    const assigneeId = this.resolveTaskAssigneeUserId(next);
    if (!meId || !assigneeId || assigneeId === meId) return;

    if (!prior.completed && next.completed) {
      this.pushNotificationForUser(assigneeId, {
        type: 'task',
        actorUserId: meId,
        taskId: id,
        title: 'Task completed',
        text: `"${next.title}" was marked done`,
        targetTab: 'workspace',
      });
      return;
    }

    const metaChanged =
      prior.title !== next.title ||
      prior.due !== next.due ||
      prior.team !== next.team ||
      prior.user !== next.user;
    if (metaChanged) {
      this.pushNotificationForUser(assigneeId, {
        type: 'task',
        actorUserId: meId,
        taskId: id,
        title: 'Task updated',
        text: `"${next.title}" · Due ${next.due ?? 'soon'}`,
        targetTab: 'workspace',
      });
    }
  }

  deleteTask(id: number) {
    const prior = this.tasks.find((t: { id: number }) => t.id === id);
    this.save(
      'workspace_tasks',
      this.tasks.filter((t: { id: number }) => t.id !== id)
    );
    if (!prior) return;
    const meId = this.currentUserId;
    const assigneeId = this.resolveTaskAssigneeUserId(prior);
    if (assigneeId && meId && assigneeId !== meId) {
      this.pushNotificationForUser(assigneeId, {
        type: 'task',
        actorUserId: meId,

        taskId: id,
        title: 'Task removed',
        text: `"${prior.title}" was deleted from the workspace`,
        targetTab: 'workspace',
      });
    }
  }
  
  get auditLogs() {
    return this.load('workspace_auditLogs', [
      { id: 1, text: 'Sarah updated "Stripe Integration"', time: 'Just now' },
      { id: 2, text: 'Backup completed.', time: '1h ago' },
    ]) || [];
  }
  
  addAuditLog(log: Partial<WorkspaceAuditLog>) {
    const entry = {
      id: log?.id ?? Date.now(),
      text: String(log?.text ?? 'Workspace activity'),
      time: log?.time ?? 'Just now',
    };
    this.save('workspace_auditLogs', this.cappedList([entry, ...this.auditLogs], 'audit'));
    this.notifyWorkspaceTeam(
      {
        type: 'activity',
        actorUserId: this.currentUserId,
        title: 'Workspace activity',
        text: entry.text,
        targetTab: 'workspace',
      },
      this.currentUserId
    );
  }

  get reels(): Reel[] {
    const defaultReels: Reel[] = [
      {
        id: 'demo-carousel',
        user: this.users[1],
        likes: 3200,
        comments: 88,
        caption: 'Swipe for more — multi-media reel demo 📸',
        videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        isLiked: false,
        isSaved: false,
        mediaList: [
          {
            url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
            type: 'video',
            name: 'Clip 1',
          },
          {
            url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1080&h=1920&fit=crop',
            type: 'image',
            name: 'Still 2',
          },
          {
            url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
            type: 'video',
            name: 'Clip 3',
          },
        ],
      },
      { id: '1', user: this.users[1], likes: 12400, comments: 452, caption: '🎬 #reels', videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', isLiked: false, isSaved: false },
      { id: '2', user: this.users[2], likes: 8900, comments: 210, caption: '🔥 #editing', videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4', isLiked: false, isSaved: false },
      { id: 'r_u1_1', user: this.users[0], likes: 2180, comments: 94, caption: 'Behind the scenes — new reel series 🎥 #reels #design', videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', isLiked: false, isSaved: false },
      { id: 'r_u1_2', user: this.users[0], likes: 940, comments: 31, caption: 'Quick tip: layout grids in 60s ⚡', videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4', isLiked: false, isSaved: false },
    ];
    const raw = this.load<Reel[]>('reels', defaultReels) || defaultReels;
    return this.filterItemsByBlockedAuthors(raw);
  }

  addReel(reel: Partial<Reel> & { user?: User }) {
    const author = resolveUser(this.users, reel.user, this.currentUser);
    const newReel = {
      ...reel,
      user: author,
      id: reel.id || `r_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    };
    this.save('reels', this.cappedList([newReel, ...this.reels], 'reels'));
  }

  updateReel(id: string, updateFn: (reel: Reel) => Reel) {
    const updated = this.reels.map((r) => r.id === id ? updateFn(r) : r);
    this.save('reels', updated);
  }

  deleteReel(id: string) {
    const updated = this.reels.filter((r) => r.id !== id);
    this.save('reels', updated);
  }


  private static readonly NOTIFICATION_INBOX_KEY = 'notification_inbox';
  private static readonly LEGACY_NOTIFICATIONS_KEY = 'notifications';
  private static readonly NOTIFICATIONS_CAP = 120;

  private getNotificationInboxStore(): Record<string, AppNotification[]> {
    const raw = this.load<Record<string, AppNotification[]>>(
      LocalDB.NOTIFICATION_INBOX_KEY,
      {}
    );
    return raw && typeof raw === 'object' ? raw : {};
  }

  private saveNotificationInboxStore(store: Record<string, AppNotification[]>) {
    this.save(LocalDB.NOTIFICATION_INBOX_KEY, store);
  }

  private migrateLegacyNotificationsInbox() {
    const legacy = this.load<AppNotification[]>(LocalDB.LEGACY_NOTIFICATIONS_KEY, []);
    if (!Array.isArray(legacy) || legacy.length === 0) return;
    const meId = this.currentUserId;
    if (!meId) return;
    const store = this.getNotificationInboxStore();
    if (Array.isArray(store[meId]) && store[meId].length > 0) return;
    const normalized = legacy.map((n) => this.normalizeNotificationRow(n));
    this.saveNotificationInboxStore({ ...store, [meId]: normalized });
  }

  private normalizeNotificationRow(raw: Partial<AppNotification>): AppNotification {
    const type = (raw.type ?? 'system') as AppNotificationType;
    const actorUserId =
      raw.actorUserId ?? raw.user?.id ?? undefined;
    const actor = actorUserId
      ? this.users.find((u: User) => u?.id === actorUserId)
      : raw.user;
    return {
      id: raw.id ?? `n_${Math.random().toString(36).slice(2, 11)}`,
      type,
      createdAt:
        typeof raw.createdAt === 'number' && raw.createdAt > 0
          ? raw.createdAt
          : Date.now() - 3600_000,
      read: !!raw.read,
      actorUserId,
      user: actor ? resolveUser(this.users, actor) : undefined,
      title: raw.title,
      text: raw.text,
      postId: raw.postId,
      reelId: raw.reelId,
      postImage: raw.postImage,
      orderId: raw.orderId,
      link: raw.link,
      taskId: raw.taskId,
      targetTab: raw.targetTab,
      liveKind: raw.liveKind,
    };
  }

  private notifyLiveStarted(hostUserId: string, liveKind?: LiveKind) {
    const hostId = safeUserId(hostUserId);
    if (!hostId) return;
    const kind = liveKind ?? 'solo';
    const label = LIVE_KIND_LABELS[kind] ?? 'Live';
    const followers = this.getFollowerIds(hostId);
    for (const followerId of followers) {
      if (!followerId || followerId === hostId) continue;
      this.pushNotificationForUser(followerId, {
        type: 'live',
        actorUserId: hostId,
        liveKind: kind,
        title: 'Live now',
        text: `started a ${label} live — tap to watch`,
        targetTab: 'live',
        link: `live:${hostId}`,
      });
    }
  }

  private notifyLiveJoined(
    hostUserId: string,
    viewerUserId: string,

    liveKind?: LiveKind
  ) {
    const hostId = safeUserId(hostUserId);
    const viewerId = safeUserId(viewerUserId);
    if (!hostId || !viewerId || hostId === viewerId) return;
    const kind = liveKind ?? 'solo';
    const label = LIVE_KIND_LABELS[kind] ?? 'Live';
    this.pushNotificationForUser(hostId, {
      type: 'live',
      actorUserId: viewerId,
      liveKind: kind,
      title: 'Live viewer',
      text: `joined your ${label} live`,
      targetTab: 'live',
      link: `live:${hostId}`,
    });
  }

  private syncUserRefsInNotificationInboxes(userId: string, fresh: User) {
    const store = this.getNotificationInboxStore();
    let changed = false;
    const next: Record<string, AppNotification[]> = {};
    for (const ownerId of Object.keys(store)) {
      const list = store[ownerId].map((n) => {
        if (n.actorUserId !== userId && n.user?.id !== userId) return n;
        changed = true;
        return {
          ...n,
          actorUserId: n.actorUserId ?? userId,
          user: resolveUser(this.users, fresh),
        };
      });
      next[ownerId] = list;
    }
    if (changed) this.saveNotificationInboxStore(next);
  }

  getNotificationsForUser(ownerUserId: string): AppNotification[] {
    const ownerId = String(ownerUserId || '').trim();
    if (!ownerId) return [];
    const list = this.getNotificationInboxStore()[ownerId] ?? [];
    return [...list]
      .map((n) => this.normalizeNotificationRow(n))
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  get notifications(): AppNotification[] {
    const meId = this.currentUserId;
    return meId ? this.getNotificationsForUser(meId) : [];
  }

  getUnreadNotificationCount(ownerUserId?: string): number {
    const ownerId = String(ownerUserId || this.currentUserId || '').trim();
    if (!ownerId) return 0;
    return this.getNotificationsForUser(ownerId).filter((n) => !n.read).length;
  }

  private notificationsDeliveryEnabled(): boolean {
    return this.settings.notificationsEnabled !== false;
  }

  private resolveTaskAssigneeUserId(task: { user?: unknown }): string | null {
    const assignee = userAtModuloIndex(this.users, task?.user, this.currentUser);
    return safeUserId(assignee?.id);
  }

  private notifyWorkspaceTeam(
    payload: Omit<AppNotification, 'id' | 'createdAt' | 'read' | 'user'> & {
      type: 'activity';
    },
    excludeUserId?: string
  ) {
    const actorId = safeUserId(excludeUserId ?? payload.actorUserId);
    for (const user of this.users) {
      const userId = safeUserId(user?.id);
      if (!userId || (actorId && userId === actorId)) continue;
      this.pushNotificationForUser(userId, payload);
    }
  }

  pushNotificationForUser(
    ownerUserId: string,
    payload: Omit<AppNotification, 'id' | 'createdAt' | 'read' | 'user'> & {
      type: AppNotificationType;
    }
  ): AppNotification | null {
    if (!this.notificationsDeliveryEnabled()) return null;
    const ownerId = String(ownerUserId || '').trim();
    if (!ownerId) return null;

    const row = this.normalizeNotificationRow({
      ...payload,
      id: `n_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: Date.now(),
      read: false,
    });

    const store = this.getNotificationInboxStore();
    const list = store[ownerId] ?? [];
    const key = notificationDedupeKey(row);
    const filtered = list.filter((n) => notificationDedupeKey(n) !== key);
    const next = [row, ...filtered].slice(0, LocalDB.NOTIFICATIONS_CAP);
    this.saveNotificationInboxStore({ ...store, [ownerId]: next });

    if (ownerId === this.currentUserId) {
      this.setHasUnreadNotifications(true);
    }
    this.notifyListeners();
    return row;
  }

  addNotification(notification: Partial<AppNotification> & { type: AppNotificationType }) {
    const meId = this.currentUserId;
    if (!meId) return null;
    const actorUserId =
      notification.actorUserId ??
      notification.user?.id ??
      undefined;
    return this.pushNotificationForUser(meId, {
      ...notification,
      actorUserId,
      type: notification.type,
    });
  }

  removeNotificationMatches(
    ownerUserId: string,
    match: {
      type?: AppNotificationType;
      actorUserId?: string;
      postId?: string;
    }
  ) {
    const ownerId = String(ownerUserId || '').trim();
    if (!ownerId) return;
    const store = this.getNotificationInboxStore();
    const list = store[ownerId] ?? [];
    const next = list.filter((n) => {
      if (match.type && n.type !== match.type) return true;
      if (match.actorUserId && n.actorUserId !== match.actorUserId) return true;
      if (match.postId && n.postId !== match.postId) return true;
      return false;
    });
    if (next.length === list.length) return;
    this.saveNotificationInboxStore({ ...store, [ownerId]: next });
    this.notifyListeners();
  }

  markNotificationRead(notificationId: string, ownerUserId?: string) {
    const ownerId = String(ownerUserId || this.currentUserId || '').trim();
    if (!ownerId || !notificationId) return;
    const store = this.getNotificationInboxStore();
    const list = store[ownerId] ?? [];
    const next = list.map((n) =>
      n.id === notificationId ? { ...n, read: true } : n
    );
    this.saveNotificationInboxStore({ ...store, [ownerId]: next });
    if (ownerId === this.currentUserId) {
      const unread = next.filter((n) => !n.read).length;
      this.setHasUnreadNotifications(unread > 0);
    }
    this.notifyListeners();
  }

  markAllNotificationsRead(ownerUserId?: string) {
    const ownerId = String(ownerUserId || this.currentUserId || '').trim();
    if (!ownerId) return;
    const store = this.getNotificationInboxStore();
    const next = (store[ownerId] ?? []).map((n) => ({ ...n, read: true }));
    this.saveNotificationInboxStore({ ...store, [ownerId]: next });
    if (ownerId === this.currentUserId) {
      this.setHasUnreadNotifications(false);
    }
    this.notifyListeners();
  }

  removeNotification(notificationId: string, ownerUserId?: string) {
    const ownerId = String(ownerUserId || this.currentUserId || '').trim();
    if (!ownerId || !notificationId) return;
    const store = this.getNotificationInboxStore();
    const list = store[ownerId] ?? [];
    const next = list.filter((n) => n.id !== notificationId);
    this.saveNotificationInboxStore({ ...store, [ownerId]: next });
    this.notifyListeners();
  }

  private compactNotificationInboxForCurrentUser() {
    const meId = this.currentUserId;
    if (!meId) return;
    const store = this.getNotificationInboxStore();
    const list = store[meId] ?? [];
    if (list.length === 0) return;
    const seen = new Set<string>();
    const next: AppNotification[] = [];
    const sorted = [...list].sort(
      (a, b) =>
        (b.createdAt ?? 0) - (a.createdAt ?? 0) ||
        String(b.id).localeCompare(String(a.id))
    );
    for (const n of sorted) {
      const key = notificationDedupeKey(this.normalizeNotificationRow(n));
      if (seen.has(key)) continue;
      seen.add(key);
      next.push(this.normalizeNotificationRow(n));
    }
    if (next.length !== list.length) {
      this.saveNotificationInboxStore({ ...store, [meId]: next });
    }
  }

  private ensureDemoNotifications() {
    const meId = this.currentUserId;
    if (!meId) return;
    const existing = this.getNotificationsForUser(meId);
    if (existing.length > 0) return;

    const now = Date.now();
    const myPosts = (this.posts ?? []).filter((p: Post) => postUserId(p) === meId);
    const firstPost = myPosts[0];
    const followers = this.getFollowerIds(meId).slice(0, 3);

    type Seed = Omit<AppNotification, 'id' | 'read' | 'user'> & { createdAt: number };
    const seeds: Seed[] = [];

    followers.forEach((actorId, i) => {
      seeds.push({
        type: 'follow',
        actorUserId: actorId,
        createdAt: now - (i + 1) * 90_000,
      });
    });

    if (firstPost && followers[0]) {
      seeds.push({
        type: 'like',
        actorUserId: followers[0],
        postId: firstPost.id,
        postImage: firstPost.imageUrl || firstPost.videoUrl,
        createdAt: now - 45 * 60_000,
      });
    }

    if (followers[1] && firstPost) {
      seeds.push({
        type: 'comment',
        actorUserId: followers[1],
        postId: firstPost.id,
        postImage: firstPost.imageUrl || firstPost.videoUrl,
        text: 'This looks amazing! 🔥',
        createdAt: now - 20 * 60_000,
      });
    }

    if (followers[2] && firstPost) {
      seeds.push({
        type: 'mention',
        actorUserId: followers[2],
        postId: firstPost.id,
        postImage: firstPost.imageUrl || firstPost.videoUrl,
        text: `mentioned you: "@${this.currentUser?.username ?? 'you'} check this out"`,
        createdAt: now - 12 * 60_000,
      });
    }

    seeds.push({
      type: 'order',
      title: 'Order confirmed',
      text: 'Order ord1779081254922 confirmed — $42.50',
      orderId: 'ord1779081254922',
      createdAt: now - 3 * 3600_000,
    });

    seeds.push({
      type: 'task',
      actorUserId: followers[0] ?? meId,
      taskId: 101,
      title: 'Task assigned',
      text: '"Update Marketing Assets" · Design · Due Today',
      targetTab: 'workspace',
      createdAt: now - 2 * 3600_000,
    });

    seeds.push({
      type: 'activity',
      title: 'Workspace activity',
      text: 'Sarah updated "Stripe Integration"',
      targetTab: 'workspace',
      createdAt: now - 90 * 60_000,
    });

    if (followers[1]) {
      seeds.push({
        type: 'message',
        actorUserId: followers[1],
        text: 'Shared a post with you',
        targetTab: 'messages',
        createdAt: now - 6 * 3600_000,
      });
    }

    const liveHostId = followers[0] ?? followers[1];
    if (liveHostId) {
      seeds.push({
        type: 'live',
        actorUserId: liveHostId,
        liveKind: 'audio-room',
        title: 'Live now',
        text: 'started an Audio live — tap to watch',
        targetTab: 'live',
        link: `live:${liveHostId}`,
        createdAt: now - 18 * 60_000,
      });
    }

    seeds.push({
      type: 'live',
      actorUserId: followers[2] ?? followers[1] ?? meId,
      liveKind: 'solo',
      title: 'Live viewer',
      text: 'joined your Solo live',
      targetTab: 'live',
      link: `live:${meId}`,
      createdAt: now - 8 * 60_000,
    });

    const store = this.getNotificationInboxStore();
    const rows = seeds
      .map((s) =>
        this.normalizeNotificationRow({
          ...s,
          id: `demo_${Math.random().toString(36).slice(2, 9)}`,
          read: false,
        })
      )
      .sort((a, b) => b.createdAt - a.createdAt);
    this.saveNotificationInboxStore({ ...store, [meId]: rows });
    this.setHasUnreadNotifications(true);
  }

  get files() {
    const defaultFiles = [
      { id: '1', name: 'App_Architecture.pdf', date: '2 hrs ago', size: '2.4 MB', author: 1 },
      { id: '2', name: 'Financials.xlsx', date: 'Yesterday', size: '1.1 MB', author: 0 },
    ];
    return this.load('workspace_files', defaultFiles) || defaultFiles;
  }

  addFile(file: WorkspaceFile) {
    this.save('workspace_files', [file, ...this.files]);
    this.notifyWorkspaceTeam(
      {
        type: 'activity',
        actorUserId: this.currentUserId,
        title: 'File uploaded',
        text: `${file?.name ?? 'New file'} added to workspace files`,
        targetTab: 'workspace',
      },
      this.currentUserId
    );
  }

  deleteFile(id: string) {
    this.save('workspace_files', this.files.filter((f) => f.id !== id));
  }


  get messages(): MessagesByChatStore {
    return this.load<MessagesByChatStore>('messages', {}) || {};
  }

  get chatPresence(): ChatPresenceStore {
    return this.load<ChatPresenceStore>('chat_presence', {}) || {};
  }

  get chatReadState(): ChatTimestampStore {
    return this.load<ChatTimestampStore>('chat_read_state', {}) || {};
  }

  get chatPeerReadState(): ChatTimestampStore {
    return this.load<ChatTimestampStore>('chat_peer_read_state', {}) || {};
  }

  getUserPresence(userId: string) {
    if (!userId) {
      return {
        online: false,
        typing: false,
        lastSeenAt: 0,
        lastActiveAt: 0,
      };
    }
    const presence = this.chatPresence;
    const entry = presence[userId];
    return {
      online: !!entry?.online,
      typing: !!entry?.typing,
      lastSeenAt: typeof entry?.lastSeenAt === 'number' ? entry.lastSeenAt : 0,
      lastActiveAt: typeof entry?.lastActiveAt === 'number' ? entry.lastActiveAt : 0,
    };
  }

  setUserPresence(userId: string, patch: {
    online?: boolean;
    typing?: boolean;
    lastSeenAt?: number;
    lastActiveAt?: number;
  }) {
    if (!userId) return;
    const presence = this.chatPresence;
    const current = this.getUserPresence(userId);
    this.save('chat_presence', {
      ...presence,
      [userId]: {
        ...current,
        ...(patch || {}),
      },
    });
  }

  setChatPresenceMap(nextPresence: ChatPresenceStore) {
    if (!nextPresence || typeof nextPresence !== 'object') return;
    this.save('chat_presence', nextPresence);
  }

  setUserTyping(userId: string, typing: boolean) {
    if (!userId) return;
    this.setUserPresence(userId, { typing: !!typing });
  }

  setUserOnline(userId: string, online: boolean, at = Date.now()) {
    if (!userId) return;
    if (online) {
      this.setUserPresence(userId, {
        online: true,
        lastActiveAt: at,
      });
      return;
    }
    this.setUserPresence(userId, {
      online: false,
      lastSeenAt: at,
    });
  }

  touchUserActive(userId: string, at = Date.now()) {

    if (!userId) return;
    this.setUserPresence(userId, {
      online: true,
      lastActiveAt: at,
    });
  }

  getChatReadAt(chatId: string) {
    if (!chatId) return 0;
    const readState = this.chatReadState;
    const value = readState[chatId];
    return typeof value === 'number' ? value : 0;
  }

  setChatReadAt(chatId: string, timestamp: number) {
    if (!chatId) return;
    const readState = this.chatReadState;
    const previous = typeof readState[chatId] === 'number' ? readState[chatId] : 0;
    const nextValue = typeof timestamp === 'number' ? timestamp : previous;
    if (nextValue <= previous) return;
    this.save('chat_read_state', {
      ...readState,
      [chatId]: nextValue,
    });
  }

  getChatPeerReadAt(chatId: string) {
    if (!chatId) return 0;
    const peerReadState = this.chatPeerReadState;
    const value = peerReadState[chatId];
    return typeof value === 'number' ? value : 0;
  }

  setChatPeerReadAt(chatId: string, timestamp: number) {
    if (!chatId) return;
    const peerReadState = this.chatPeerReadState;
    const previous = typeof peerReadState[chatId] === 'number' ? peerReadState[chatId] : 0;
    const nextValue = typeof timestamp === 'number' ? timestamp : previous;
    if (nextValue <= previous) return;
    this.save('chat_peer_read_state', {
      ...peerReadState,
      [chatId]: nextValue,
    });
  }

  get chatWallpapers(): Record<string, { selectedId?: string; customWallpapers?: unknown[] }> {
    return this.load('chat_wallpapers', {}) || {};
  }

  getChatWallpaper(chatId: string) {
    if (!chatId) {
      return { selectedId: 'default', customWallpapers: [] as ChatWallpaperItem[] };
    }
    const all = this.chatWallpapers;
    const entry = all[chatId];
    if (!entry || typeof entry !== 'object') {
      return { selectedId: 'default', customWallpapers: [] as ChatWallpaperItem[] };
    }
    return {
      selectedId: typeof entry.selectedId === 'string' && entry.selectedId.length > 0 ? entry.selectedId : 'default',
      customWallpapers: Array.isArray(entry.customWallpapers) ? entry.customWallpapers : [],
    };
  }

  setChatWallpaper(chatId: string, payload: { selectedId: string; customWallpapers: ChatWallpaperItem[] }) {
    if (!chatId) return;
    const all = this.chatWallpapers;
    this.save('chat_wallpapers', {
      ...all,
      [chatId]: {
        selectedId: typeof payload?.selectedId === 'string' && payload.selectedId.length > 0 ? payload.selectedId : 'default',
        customWallpapers: Array.isArray(payload?.customWallpapers) ? payload.customWallpapers.slice(0, 24) : [],
      },
    });
  }

  addMessage(chatId: string, message: ChatMessage) {
    const msgs = this.messages;
    const existing = msgs[chatId] || [];
    const nextMessage = this.ensureMessageId(message, chatId);
    this.setUnreadMessagesCount(this.unreadMessagesCount + 1);
    this.save('messages', {
      ...msgs,
      [chatId]: this.cappedList([...existing, nextMessage], 'messages'),
    });
    const meId = this.currentUserId;
    const recipientId = safeUserId(chatId);
    if (nextMessage?.isAuthor && recipientId && meId && recipientId !== meId) {
      const preview = String(nextMessage.text ?? '').trim().slice(0, 120);
      this.pushNotificationForUser(recipientId, {
        type: 'message',
        actorUserId: meId,
        text: preview || 'Sent you a message',
        link: `chat:${recipientId}`,
        targetTab: 'messages',
      });
    }
  }

  toggleMessageReaction(chatId: string, messageIndex: number, emoji: string) {
    if (!chatId || !emoji) return;
    const msgs = this.messages;
    const existing = Array.isArray(msgs[chatId]) ? [...msgs[chatId]] : [];
    if (messageIndex < 0 || messageIndex >= existing.length) return;

    const message = existing[messageIndex];
    if (!message || typeof message !== 'object') return;

    const currentReaction =
      message.reactionState && typeof message.reactionState === 'object'
        ? message.reactionState
        : { selected: null as string | null, counts: {} as Record<string, number> };

    const counts: Record<string, number> = { ...(currentReaction.counts ?? {}) };
    let selected: string | null =
      typeof currentReaction.selected === 'string' ? currentReaction.selected : null;

    if (selected === emoji) {
      counts[emoji] = Math.max(0, (counts[emoji] || 0) - 1);
      if (counts[emoji] === 0) delete counts[emoji];
      selected = null;
    } else {
      if (selected) {
        counts[selected] = Math.max(0, (counts[selected] || 0) - 1);
        if (counts[selected] === 0) delete counts[selected];
      }
      counts[emoji] = (counts[emoji] || 0) + 1;
      selected = emoji;
    }

    existing[messageIndex] = {
      ...message,
      reactionState: {
        selected,
        counts,
      },
    };

    this.save('messages', {
      ...msgs,
      [chatId]: this.cappedList(existing, 'messages'),
    });

    const meId = this.currentUserId;
    const recipientId = safeUserId(chatId);
    const addedReaction = selected === emoji;
    if (
      addedReaction &&
      recipientId &&
      meId &&
      recipientId !== meId &&
      !message?.isAuthor
    ) {
      this.pushNotificationForUser(recipientId, {
        type: 'activity',
        actorUserId: meId,
        title: 'Message reaction',
        text: `reacted ${emoji} to your message`,
        link: `chat:${recipientId}`,
        targetTab: 'messages',
      });
    }
  }

  updateMessage(chatId: string, messageIndex: number, updater: (message: ChatMessage) => ChatMessage) {
    if (!chatId || typeof updater !== 'function') return;
    const msgs = this.messages;
    const existing = Array.isArray(msgs[chatId]) ? [...msgs[chatId]] : [];
    if (messageIndex < 0 || messageIndex >= existing.length) return;
    const current = existing[messageIndex];
    existing[messageIndex] = updater(current);
    this.save('messages', {
      ...msgs,
      [chatId]: this.cappedList(existing, 'messages'),
    });
  }

  deleteMessage(chatId: string, messageIndex: number) {
    if (!chatId) return;
    const msgs = this.messages;
    const existing = Array.isArray(msgs[chatId]) ? [...msgs[chatId]] : [];
    if (messageIndex < 0 || messageIndex >= existing.length) return;
    existing.splice(messageIndex, 1);

    const normalized = existing.map((message: ChatMessage) => {
      if (!message || typeof message !== 'object' || !message.replyTo || typeof message.replyTo !== 'object') {
        if (!message || typeof message !== 'object' || !Array.isArray(message.replyToMany)) {
          return message;
        }
        const nextReplyToMany = message.replyToMany
          .filter((reply: MessageReplyRef) => typeof reply?.index === 'number' && reply.index !== messageIndex)
          .map((reply: MessageReplyRef) => ({
            ...reply,
            index: reply.index > messageIndex ? reply.index - 1 : reply.index,
          }));
        return {
          ...message,
          replyToMany: nextReplyToMany,
        };
      }

      const replyIndex = typeof message.replyTo.index === 'number' ? message.replyTo.index : null;
      if (replyIndex === null) {
        if (!Array.isArray(message.replyToMany)) return message;
        const nextReplyToMany = message.replyToMany
          .filter((reply: MessageReplyRef) => typeof reply?.index === 'number' && reply.index !== messageIndex)
          .map((reply: MessageReplyRef) => ({
            ...reply,
            index: reply.index > messageIndex ? reply.index - 1 : reply.index,
          }));
        return {
          ...message,
          replyToMany: nextReplyToMany,
        };
      }

      if (replyIndex === messageIndex) {
        const { replyTo: _replyTo, ...rest } = message;
        return Array.isArray(message.replyToMany)
          ? {
              ...rest,
              replyToMany: message.replyToMany
                .filter((reply: MessageReplyRef) => typeof reply?.index === 'number' && reply.index !== messageIndex)
                .map((reply: MessageReplyRef) => ({
                  ...reply,
                  index: reply.index > messageIndex ? reply.index - 1 : reply.index,
                })),
            }
          : rest;
      }

      if (replyIndex > messageIndex) {
        const withReplyTo = {
          ...message,
          replyTo: {
            ...message.replyTo,
            index: replyIndex - 1,
          },
        };
        if (!Array.isArray(message.replyToMany)) return withReplyTo;
        return {
          ...withReplyTo,
          replyToMany: message.replyToMany
            .filter((reply: MessageReplyRef) => typeof reply?.index === 'number' && reply.index !== messageIndex)
            .map((reply: MessageReplyRef) => ({
              ...reply,
              index: reply.index > messageIndex ? reply.index - 1 : reply.index,
            })),
        };
      }

      if (!Array.isArray(message.replyToMany)) return message;
      return {
        ...message,
        replyToMany: message.replyToMany
          .filter((reply: MessageReplyRef) => typeof reply?.index === 'number' && reply.index !== messageIndex)
          .map((reply: MessageReplyRef) => ({
            ...reply,
            index: reply.index > messageIndex ? reply.index - 1 : reply.index,
          })),
      };
    });

    this.save('messages', {
      ...msgs,
      [chatId]: this.cappedList(normalized, 'messages'),
    });
  }


  get stories(): StoriesByUserStore {
    return this.load<StoriesByUserStore>('stories', {}) || {};
  }

  /**
   * Demo LIVE + story rings on the home feed (and profile when that user has segments).
   * In DEV, re-applies on each load; use applyDemoStoryStrip() from the dev panel anytime.
   */
  async applyDemoStoryStrip(options?: { resetViews?: boolean }) {
    await this.whenReady();

    const nextStories: StoriesByUserStore = { ...this.stories };
    Object.entries(DEMO_STORY_SEGMENTS).forEach(([userId, segments]) => {
      nextStories[userId] = segments.map((s, idx) => ({
        ...s,
        createdAt:
          (s as StoryDraftMedia).createdAt ??
          Date.now() - (segments.length - idx) * 3_600_000,
      }));
    });
    this.cache['stories'] = nextStories;

    const statusPatches = DEMO_USER_STATUS_PATCHES;
    const liveKindPatches = DEMO_LIVE_KIND_PATCHES;
    const userById = new Map<string, User>(
      this.users.map((u) => [u.id, u] as const)
    );
    USERS.forEach((template) => {
      if (template?.id && !userById.has(template.id)) {
        userById.set(template.id, { ...template });
      }
    });
    const updatedUsers = Array.from(userById.values()).map((u) => {
      const nextStatus = statusPatches[u?.id];
      if (nextStatus === undefined) return u;
      const liveKind =
        nextStatus === 'live' ? liveKindPatches[u?.id] ?? 'solo' : undefined;
      if (u.status === nextStatus && u.liveKind === liveKind) return u;
      if (nextStatus === 'live' && u.status !== 'live' && u?.id) {
        this.notifyLiveStarted(u.id, liveKind);
      }
      return { ...u, status: nextStatus, liveKind };
    });
    this.cache['users'] = updatedUsers;

    const views = { ...this.storyViews };
    let viewsChanged = false;
    if (options?.resetViews !== false) {
      Object.keys(DEMO_STORY_SEGMENTS).forEach((userId) => {
        if (views[userId]) {
          delete views[userId];
          viewsChanged = true;
        }
      });
      if (viewsChanged) this.cache['story_views'] = views;
    }

    this.cache['demo_stories_seeded'] = true;

    await this.saveToIDB('stories', nextStories);
    await this.saveToIDB('users', updatedUsers);
    if (viewsChanged) await this.saveToIDB('story_views', views);
    await this.saveToIDB('demo_stories_seeded', true);

    try {
      localStorage.setItem('users', JSON.stringify(updatedUsers));
    } catch {
      /* ignore */
    }

    if (import.meta.env.DEV) {
      recordCollectionSave('stories', nextStories);
      recordCollectionSave('users', updatedUsers);
    }

    this.notifyListeners();

    return {
      storyUsers: Object.keys(DEMO_STORY_SEGMENTS).length,
      storyOnlyUsers: Object.keys(DEMO_STORY_SEGMENTS).filter(
        (id) => statusPatches[id] === 'story'
      ),
      liveUsers: Object.entries(statusPatches)

        .filter(([, s]) => s === 'live')
        .map(([id]) => id),
      liveKinds: Object.entries(liveKindPatches).map(
        ([id, kind]) => `${id}:${kind}`
      ),
    };
  }

  private async seedDemoStoriesIfNeeded() {
    if (import.meta.env.DEV) {
      await this.applyDemoStoryStrip({ resetViews: false });
      return;
    }

    if (this.load('demo_stories_seeded', false)) return;

    const existing = this.stories;
    const hasAny = Object.values(existing).some(
      (list) => Array.isArray(list) && list.length > 0
    );
    if (hasAny) {
      this.save('demo_stories_seeded', true);
      return;
    }

    await this.applyDemoStoryStrip({ resetViews: false });
  }

  addStorySegment(userId: string, segment: StoryDraftMedia) {
    const all = this.stories;
    const userSegs = all[userId] || [];
    const stamped: StoryDraftMedia = {
      ...segment,
      createdAt: segment.createdAt ?? Date.now(),
    };
    this.save('stories', { ...all, [userId]: this.cappedList([stamped, ...userSegs], 'stories') });
  }

  get storyViews() {
    return this.load('story_views', {}) as Record<string, boolean>;
  }

  hasViewedStory(userId: string) {
    return !!this.storyViews[userId];
  }

  markStoryViewed(userId: string) {
    this.save('story_views', { ...this.storyViews, [userId]: true });
  }

  get settings(): AppSettings {
    const defaults: AppSettings = {
      notificationsEnabled: true,
      theme: 'dark',
      isPrivate: false,
      /** When false, others' visits are not saved and the visitors list is hidden. */
      profileVisitorsEnabled: true,
      /** Premium only: do not record visits when browsing (leave no trace). */
      hiddenProfileViews: false,
      hideProfileViews: false,
      language: 'English',
      offlineSync: false,
      cloudSyncEnabled: false,
      cloudProvider: 'None',
      cloudAutoSync: false,
      cloudLastSyncAt: null as string | null,
      cloudActiveConnectionId: null as string | null,
      cloudConnections: [] as Array<{
        id: string;
        provider: string;
        connected: boolean;
        storageName: string;
        accountLabel: string;
        bucket: string;
        region: string;
        endpoint: string;
        credentialHint: string;
        lastValidatedAt: string;
        dataTypes: CloudDataType[];
      }>,
      cloudConnection: null as null | {
        id?: string;
        provider: string;
        connected: boolean;
        storageName?: string;
        accountLabel: string;
        bucket: string;
        region: string;
        endpoint: string;
        credentialHint: string;
        lastValidatedAt: string;
        dataTypes?: CloudDataType[];
      }
    };
    return this.load('app_settings', defaults) || defaults;
  }

  updateSettings(update: Partial<AppSettings>) {
    const next = { ...this.settings, ...update };
    if ('hiddenProfileViews' in update && update.hiddenProfileViews === true) {
      if (!this.hasProfilePremium()) {
        next.hiddenProfileViews = false;
      }
    }
    delete next.hideProfileViews;
    this.save('app_settings', next);
    if (
      'hiddenProfileViews' in update &&
      update.hiddenProfileViews === true &&
      next.hiddenProfileViews === true
    ) {
      this.scrubViewerTracesFromAllProfiles(this.currentUserId);
    }
    if (
      'profileVisitorsEnabled' in update &&
      typeof update.profileVisitorsEnabled === 'boolean'
    ) {
      const meId = this.currentUserId;
      this.updateUser(meId, (u) => ({
        ...u,
        profileVisitorsEnabled: update.profileVisitorsEnabled,
      }));
    }
  }

  get cloudMeta() {
    const defaults = {
      syncedCollections: 0,
      syncedItems: 0,
      syncedSize: 0,
      status: 'idle' as 'idle' | 'syncing' | 'success'
    };
    return this.load('cloud_meta', defaults) || defaults;
  }

  private countItems(value: unknown): number {
    if (Array.isArray(value)) return value.length;
    if (value && typeof value === 'object') return Object.keys(value).length;
    if (value === null || value === undefined) return 0;
    return 1;
  }

  private getCloudDataTypes(connection: CloudConnection): CloudDataType[] {
    const allTypes: CloudDataType[] = ['photos', 'videos', 'files', 'messages', 'stories', 'posts'];
    if (!Array.isArray(connection?.dataTypes)) {
      return allTypes;
    }
    return connection.dataTypes.filter((type: string): type is CloudDataType =>
      allTypes.includes(type as CloudDataType)
    );
  }

  private isKeyAllowedForConnection(key: string, connection: CloudConnection): boolean {
    const keyMap: Record<CloudDataType, RegExp[]> = {
      photos: [/^posts$/, /^stories$/, /^reels$/],
      videos: [/^reels$/, /^stories$/],
      files: [/^workspace_files$/],
      messages: [/^messages$/, /^chat_wallpapers$/, /^chat_presence$/, /^chat_read_state$/, /^chat_peer_read_state$/],
      stories: [/^stories$/],
      posts: [/^posts$/, /^post_comments$/, /^reel_comments$/]
    };
    const dataTypes = this.getCloudDataTypes(connection);
    return dataTypes.some((type) => keyMap[type].some((pattern) => pattern.test(key)));
  }

  private getCloudConnections(settings = this.settings) {
    if (Array.isArray(settings?.cloudConnections)) {
      return settings.cloudConnections;
    }
    if (settings?.cloudConnection?.connected) {
      const legacy = settings.cloudConnection;
      return [{
        ...legacy,
        id: legacy.id ?? `legacy_${legacy.provider}_${legacy.accountLabel || 'account'}_${legacy.bucket || 'bucket'}`,
        storageName: legacy.storageName || legacy.accountLabel || `${legacy.provider} storage`,
        dataTypes: legacy.dataTypes || ['photos', 'videos', 'files', 'messages', 'stories', 'posts'],
      }];
    }
    return [];
  }

  private getActiveCloudConnection(settings = this.settings) {
    const connections = this.getCloudConnections(settings);
    if (!connections.length) return null;

    const activeId = settings?.cloudActiveConnectionId;
    if (activeId) {
      const active = connections.find((c) => c.id === activeId);
      if (active?.connected) return active;
    }

    const selectedProvider = settings?.cloudProvider;
    if (selectedProvider && selectedProvider !== 'None') {
      const byProvider = connections.find((c) => c.connected && c.provider === selectedProvider);
      if (byProvider) return byProvider;
    }

    return connections.find((c) => c.connected) || null;
  }

  syncToCloud(isAuto = false): CloudSyncResult {
    if (this.cloudSyncInProgress) {
      return { ok: false, reason: 'Cloud sync already in progress.' };
    }

    const settings = this.settings;
    if (!settings.cloudSyncEnabled) {
      return { ok: false, reason: 'Cloud sync is disabled.' };
    }
    const connections = this.getCloudConnections(settings).filter((connection) => connection.connected);
    if (connections.length === 0) {
      return { ok: false, reason: 'Connect your cloud provider first.' };
    }

    this.cloudSyncInProgress = true;
    try {
      if (isAuto) {
        this.save('cloud_meta', {
          ...this.cloudMeta,
          status: 'syncing'
        });
      }

      const cacheKeys = Object.keys(this.cache);
      let syncedCollections = 0;
      let syncedItems = 0;
      let syncedSize = 0;

      connections.forEach((connection) => {
        const routedKeys = cacheKeys.filter((key) => this.isKeyAllowedForConnection(key, connection));
        syncedCollections += routedKeys.length;
        routedKeys.forEach((key) => {
          const value = this.cache[key];
          syncedItems += this.countItems(value);
          try {
            const payload = JSON.stringify(value);
            syncedSize += (payload.length + key.length) * 2;
          } catch {
            // Ignore non-serializable entries in size estimate.
          }
        });
      });

      this.save('cloud_meta', {
        syncedCollections,
        syncedItems,
        syncedSize,
        status: 'success'
      });

      this.updateSettings({
        cloudProvider: connections[0].provider,
        cloudActiveConnectionId: this.getActiveCloudConnection(settings)?.id || connections[0].id,
        cloudLastSyncAt: new Date().toISOString()
      });

      return {
        ok: true,
        syncedCollections,
        syncedItems,
        syncedSize
      };
    } finally {
      this.cloudSyncInProgress = false;
    }
  }

  connectCloudProvider(payload: {
    provider: string;
    storageName?: string;
    accountLabel: string;
    bucket: string;
    region?: string;
    endpoint?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    dataTypes?: CloudDataType[];
  }) {
    if (!payload.provider || payload.provider === 'None') {
      return { ok: false, reason: 'Select a cloud provider first.' };
    }
    if (!payload.accountLabel.trim() || !payload.bucket.trim()) {
      return { ok: false, reason: 'Account label and bucket/container are required.' };
    }

    const key = (payload.accessKeyId || '').trim();
    const credentialHint = key.length >= 6 ? `${key.slice(0, 4)}...${key.slice(-2)}` : (key ? `${key[0]}...` : 'configured');
    const connectionId = `cloud_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const cloudConnection = {
      id: connectionId,
      provider: payload.provider,
      connected: true,
      storageName: (payload.storageName || payload.accountLabel || `${payload.provider} storage`).trim(),
      accountLabel: payload.accountLabel.trim(),
      bucket: payload.bucket.trim(),
      region: (payload.region || '').trim(),
      endpoint: (payload.endpoint || '').trim(),
      credentialHint,
      lastValidatedAt: new Date().toISOString(),
      dataTypes: Array.isArray(payload.dataTypes)
        ? payload.dataTypes
        : ['photos', 'videos', 'files', 'messages', 'stories', 'posts']
    };
    const existingConnections = this.getCloudConnections();
    const cloudConnections = [cloudConnection, ...existingConnections];

    this.updateSettings({
      cloudProvider: payload.provider,
      cloudSyncEnabled: true,
      cloudActiveConnectionId: connectionId,
      cloudConnections,
      cloudConnection: cloudConnection
    });

    return { ok: true, cloudConnection };
  }

  updateCloudConnection(connectionId: string, patch: {
    storageName?: string;
    dataTypes?: CloudDataType[];
  }) {
    const settings = this.settings;
    const existingConnections = this.getCloudConnections(settings);
    const cloudConnections = existingConnections.map((connection: CloudConnection) => {
      if (connection.id !== connectionId) return connection;
      return {
        ...connection,
        storageName: patch.storageName !== undefined ? patch.storageName.trim() : connection.storageName,
        dataTypes: patch.dataTypes !== undefined ? patch.dataTypes : connection.dataTypes
      };
    });
    const nextActive = cloudConnections.find((connection) => connection.id === settings.cloudActiveConnectionId) || cloudConnections[0] || null;
    this.updateSettings({
      cloudProvider: nextActive?.provider || 'None',
      cloudActiveConnectionId: nextActive?.id || null,
      cloudConnections,
      cloudConnection: nextActive || null
    });
    return { ok: true };
  }

  disconnectCloudProvider(connectionId?: string) {
    const settings = this.settings;
    const existingConnections = this.getCloudConnections(settings);
    const cloudConnections = connectionId
      ? existingConnections.filter((c) => c.id !== connectionId)
      : [];
    const nextActive = cloudConnections[0] || null;
    this.updateSettings({
      cloudProvider: nextActive?.provider || 'None',
      cloudSyncEnabled: cloudConnections.length > 0 ? settings.cloudSyncEnabled : false,
      cloudAutoSync: cloudConnections.length > 0 ? settings.cloudAutoSync : false,
      cloudActiveConnectionId: nextActive?.id || null,
      cloudConnections,
      cloudConnection: nextActive || null
    });
    return { ok: true };
  }

  /** One-time: prior builds defaulted to muted on load. */
  private migrateGlobalMuteDefault() {
    if (this.load('globalMutedDefaultV2', false)) return;
    this.save('globalMutedDefaultV2', true);
    this.save('globalMuted', false);
  }

  /** Default unmuted; user can toggle mute per session (persisted). */
  get globalMuted() { return this.load('globalMuted', false); }
  setGlobalMuted(muted: boolean) { this.save('globalMuted', muted); }

  get isFullScreenActive() { return this.load('isFullScreenActive', false); }
  setFullScreenActive(active: boolean) { this.save('isFullScreenActive', active); }

  /** True while Shell create / edit modal is open — pauses feed, reels, and modals. */
  get isCreatorEditingActive() { return this.load('isCreatorEditingActive', false); }
  setCreatorEditingActive(active: boolean) { this.save('isCreatorEditingActive', active); }

  get unreadMessagesCount() { return this.load('unreadMessagesCount', 3); }
  setUnreadMessagesCount(count: number) { this.save('unreadMessagesCount', count); }

  get hasUnreadNotifications() { return this.load('hasUnreadNotifications', true); }
  setHasUnreadNotifications(has: boolean) { this.save('hasUnreadNotifications', has); }

  get reelComments(): CommentThreadStore {
    return this.load<CommentThreadStore>('reel_comments', {}) || {};
  }

  addReelComment(reelId: string, comment: CommentLike) {
    const rComments = this.reelComments || {};
    const existing = rComments[reelId] || [];
    const newComment = {
      id: Math.random().toString(36).substring(2, 9),
      likes: 0,
      replies: [],
      timestamp: Date.now(),
      ...this.enrichCommentPayload(comment),
    };
    this.save('reel_comments', {
      ...rComments,
      [reelId]: this.cappedList([newComment, ...existing], 'reel_comments'),
    });
    this.syncReelCommentCount(reelId);
    this.notifyCommentOnReel(reelId, String(newComment.text ?? comment?.text ?? ''));
  }

  addReelCommentReply(reelId: string, commentId: string, reply: CommentLike) {
    const rComments = this.reelComments;
    const existing = rComments[reelId] || [];
    const newReply = {
      id: Math.random().toString(36).substring(2, 9),
      likes: 0,
      replies: [],
      timestamp: Date.now(),
      ...this.enrichCommentPayload(reply),
    };

    const addReply = (comments: CommentLike[]): boolean => {
      for (const comment of comments) {
        if (comment.id === commentId) {
          comment.replies = comment.replies || [];
          comment.replies.push(newReply);
          comment.replies = this.cappedList(comment.replies, 'replies');
          return true;
        }
        if (comment.replies && comment.replies.length > 0) {
          if (addReply(comment.replies)) return true;
        }
      }
      return false;
    };

    if (!addReply(existing)) return;
    this.save('reel_comments', { ...rComments, [reelId]: existing });
    this.syncReelCommentCount(reelId);
    this.notifyReplyOnReel(
      reelId,
      commentId,
      String(newReply.text ?? reply?.text ?? '')
    );
  }

  likeReelComment(reelId: string, commentId: string, userId: string) {
    const rComments = this.reelComments;
    const existing = rComments[reelId] || [];
    let liked = false;
    let authorId: string | null = null;

    const toggleLike = (comments: CommentLike[]): boolean => {
      for (const comment of comments) {
        if (comment.id === commentId) {
          comment.likedBy = comment.likedBy || [];
          const wasLiked = comment.likedBy.includes(userId);
          if (wasLiked) {
            comment.likedBy = comment.likedBy.filter((u: string) => u !== userId);
            comment.likes = Math.max(0, (comment.likes || 0) - 1);
            liked = false;
          } else {
            comment.likedBy.push(userId);
            comment.likes = (comment.likes || 0) + 1;
            liked = true;
          }
          authorId = safeUserId(comment.userId);
          return true;
        }
        if (comment.replies && comment.replies.length > 0) {
          if (toggleLike(comment.replies)) return true;
        }
      }
      return false;
    };

    toggleLike(existing);
    this.save('reel_comments', { ...rComments, [reelId]: existing });

    if (liked && authorId && userId && authorId !== userId) {
      const reel = this.reels.find((r: Reel) => r?.id === reelId);
      this.pushNotificationForUser(authorId, {
        type: 'like',
        actorUserId: userId,
        reelId,
        postImage: reel?.videoUrl,
        text: 'liked your comment',
      });
    }
  }

  toggleReelCommentLike(reelId: string, commentId: string, userId: string) {
    this.likeReelComment(reelId, commentId, userId);
  }

  private commentMentionsUser(text: string, user: User | undefined): boolean {
    const body = String(text ?? '').trim();
    const username = user?.username?.trim();
    if (!body || !username) return false;
    return new RegExp(`@${username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(
      body
    );
  }

  private findPostCommentById(
    postId: string,
    commentId: string,
    comments = this.postComments[postId] ?? []
  ): CommentLike | null {
    for (const comment of comments) {
      if (comment?.id === commentId) return comment;
      const replies = Array.isArray(comment?.replies) ? comment.replies : [];
      const nested = this.findPostCommentById(postId, commentId, replies);
      if (nested) return nested;
    }
    return null;
  }

  private findReelCommentById(
    reelId: string,
    commentId: string,
    comments = this.reelComments[reelId] ?? []
  ): CommentLike | null {
    for (const comment of comments) {
      if (comment?.id === commentId) return comment;
      const replies = Array.isArray(comment?.replies) ? comment.replies : [];
      const nested = this.findReelCommentById(reelId, commentId, replies);
      if (nested) return nested;
    }
    return null;
  }

  private notifyReplyOnPost(
    postId: string,
    parentCommentId: string,
    replyText: string
  ) {
    const meId = this.currentUserId;
    const post = this.posts.find((p: Post) => p?.id === postId);
    const parent = this.findPostCommentById(postId, parentCommentId);
    const parentAuthorId = safeUserId(parent?.userId);

    const ownerId = postUserId(post);
    const parentUser = parentAuthorId
      ? this.users.find((u: User) => u?.id === parentAuthorId)
      : undefined;
    const mention = this.commentMentionsUser(replyText, parentUser);

    if (parentAuthorId && meId && parentAuthorId !== meId) {
      this.pushNotificationForUser(parentAuthorId, {
        type: mention ? 'mention' : 'comment',
        actorUserId: meId,
        postId,
        postImage: post?.imageUrl || post?.videoUrl,
        text: mention
          ? `mentioned you: "${replyText.slice(0, 80)}${replyText.length > 80 ? '…' : ''}"`
          : `replied: ${replyText}`.trim(),
      });
    }

    if (ownerId && meId && ownerId !== meId && ownerId !== parentAuthorId) {
      this.notifyCommentOnPost(postId, replyText);
    } else if (!parentAuthorId || parentAuthorId === meId) {
      this.notifyCommentOnPost(postId, replyText);
    }
  }

  private notifyCommentOnPost(postId: string, text: string) {
    const meId = this.currentUserId;
    const post = this.posts.find((p: Post) => p?.id === postId);
    const ownerId = postUserId(post);
    if (!meId || !ownerId || ownerId === meId) return;
    const owner = this.users.find((u: User) => u?.id === ownerId);
    const mention = this.commentMentionsUser(text, owner);
    this.pushNotificationForUser(ownerId, {
      type: mention ? 'mention' : 'comment',
      actorUserId: meId,
      postId,
      postImage: post?.imageUrl || post?.videoUrl,
      text: mention
        ? `mentioned you: "${text.slice(0, 80)}${text.length > 80 ? '…' : ''}"`
        : text,
    });
  }

  private notifyCommentOnReel(reelId: string, text: string) {
    const meId = this.currentUserId;
    const reel = this.reels.find((r: Reel) => r?.id === reelId);
    const ownerId = reelUserId(reel);
    if (!meId || !ownerId || ownerId === meId) return;
    const owner = this.users.find((u: User) => u?.id === ownerId);
    const mention = this.commentMentionsUser(text, owner);
    this.pushNotificationForUser(ownerId, {
      type: mention ? 'mention' : 'comment',
      actorUserId: meId,
      reelId,
      postImage: reel?.videoUrl,
      text: mention
        ? `mentioned you: "${text.slice(0, 80)}${text.length > 80 ? '…' : ''}"`
        : text,
    });
  }

  private notifyReplyOnReel(
    reelId: string,
    parentCommentId: string,
    replyText: string
  ) {
    const meId = this.currentUserId;
    const reel = this.reels.find((r: Reel) => r?.id === reelId);
    const parent = this.findReelCommentById(reelId, parentCommentId);
    const parentAuthorId = safeUserId(parent?.userId);

    const ownerId = reelUserId(reel);
    const parentUser = parentAuthorId
      ? this.users.find((u: User) => u?.id === parentAuthorId)
      : undefined;
    const mention = this.commentMentionsUser(replyText, parentUser);

    if (parentAuthorId && meId && parentAuthorId !== meId) {
      this.pushNotificationForUser(parentAuthorId, {
        type: mention ? 'mention' : 'comment',
        actorUserId: meId,
        reelId,
        postImage: reel?.videoUrl,
        text: mention
          ? `mentioned you: "${replyText.slice(0, 80)}${replyText.length > 80 ? '…' : ''}"`
          : `replied: ${replyText}`.trim(),
      });
    }

    if (ownerId && meId && ownerId !== meId && ownerId !== parentAuthorId) {
      this.notifyCommentOnReel(reelId, replyText);
    } else if (!parentAuthorId || parentAuthorId === meId) {
      this.notifyCommentOnReel(reelId, replyText);
    }
  }

  get postComments(): CommentThreadStore {
    return this.load<CommentThreadStore>('post_comments', {}) || {};
  }

  addPostComment(postId: string, comment: CommentLike) {
    const pComments = this.postComments || {};
    const existing = pComments[postId] || [];
    const newComment = {
      id: Math.random().toString(36).substring(2, 9),
      likes: 0,
      replies: [],
      timestamp: Date.now(),
      ...this.enrichCommentPayload(comment),
    };
    this.save('post_comments', {
      ...pComments,
      [postId]: this.cappedList([newComment, ...existing], 'post_comments'),
    });
    this.syncPostCommentCount(postId);
    this.notifyCommentOnPost(postId, String(newComment.text ?? comment?.text ?? ''));
  }

  /** Toggle like on a post comment (and nested replies). */
  likePostComment(postId: string, commentId: string, userId: string) {
    const pComments = this.postComments;
    const existing = pComments[postId] || [];
    let liked = false;
    let authorId: string | null = null;

    const toggleLike = (comments: CommentLike[]): boolean => {
      for (const comment of comments) {
        if (comment.id === commentId) {
          comment.likedBy = comment.likedBy || [];
          const wasLiked = comment.likedBy.includes(userId);
          if (wasLiked) {
            comment.likedBy = comment.likedBy.filter((u: string) => u !== userId);
            comment.likes = Math.max(0, (comment.likes || 0) - 1);
            liked = false;
          } else {
            comment.likedBy.push(userId);
            comment.likes = (comment.likes || 0) + 1;
            liked = true;
          }
          authorId = safeUserId(comment.userId);
          return true;
        }
        if (comment.replies && comment.replies.length > 0) {
          if (toggleLike(comment.replies)) return true;
        }
      }
      return false;
    };

    toggleLike(existing);
    this.save('post_comments', { ...pComments, [postId]: existing });

    if (liked && authorId && userId && authorId !== userId) {
      const post = this.posts.find((p: Post) => p?.id === postId);
      this.pushNotificationForUser(authorId, {
        type: 'like',
        actorUserId: userId,
        postId,
        postImage: post?.imageUrl || post?.videoUrl,
        text: 'liked your comment',
      });
    }
  }

  /** Alias for discoverability — same as likePostComment. */
  togglePostCommentLike(postId: string, commentId: string, userId: string) {
    this.likePostComment(postId, commentId, userId);
  }

  addPostCommentReply(postId: string, commentId: string, reply: CommentLike) {
    const pComments = this.postComments;
    const existing = pComments[postId] || [];
    const newReply = {
      id: Math.random().toString(36).substring(2, 9),
      likes: 0,
      replies: [],
      timestamp: Date.now(),
      ...this.enrichCommentPayload(reply),
    };
    
    const addReply = (comments: CommentLike[]): boolean => {
      for (const comment of comments) {
        if (comment.id === commentId) {
          comment.replies = comment.replies || [];
          comment.replies.push(newReply);
          comment.replies = this.cappedList(comment.replies, 'replies');
          return true;
        }
        if (comment.replies && comment.replies.length > 0) {
          if (addReply(comment.replies)) return true;
        }
      }
      return false;
    };
    
    if (!addReply(existing)) return;
    this.save('post_comments', { ...pComments, [postId]: existing });
    this.syncPostCommentCount(postId);
    this.notifyReplyOnPost(
      postId,
      commentId,
      String(newReply.text ?? reply?.text ?? '')
    );
  }

  getUserStorySegments(userId: string): StoryDraftMedia[] {
    const allStories = this.stories;
    const list = allStories[userId];
    if (!Array.isArray(list)) return [];
    return list.map((seg) => normalizeEditorColorFields(seg));
  }

  public clearCache() {
    const preserveKeys = new Set([
      'isLoggedIn',
      'currentUserId',
      'app_settings',
      'users',
      'cloud_meta'
    ]);

    // Preserve selected in-memory keys.
    const preservedCache: Record<string, unknown> = {};
    Object.keys(this.cache).forEach((key) => {
      if (preserveKeys.has(key)) {
        preservedCache[key] = this.cache[key];
      }
    });
    this.cache = preservedCache;

    // Preserve selected localStorage keys.
    const preservedLocalStorage: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (preserveKeys.has(key)) {
        const value = localStorage.getItem(key);
        if (value !== null) preservedLocalStorage[key] = value;
      }
    }
    localStorage.clear();
    Object.entries(preservedLocalStorage).forEach(([key, value]) => {
      localStorage.setItem(key, value);
    });

    // Remove non-preserved keys from IndexedDB store.
    if (this.db) {
      const transaction = this.db.transaction(['collections'], 'readwrite');
      const store = transaction.objectStore('collections');
      const keysRequest = store.getAllKeys();
      keysRequest.onsuccess = () => {
        const keys = keysRequest.result as string[];
        keys.forEach((key) => {
          if (!preserveKeys.has(key)) {
            store.delete(key);
          }
        });
        transaction.oncomplete = () => {
          this.refreshStorageDeviceEstimate().finally(() => this.notifyListeners());
        };
      };
    } else {
      void this.refreshStorageDeviceEstimate().finally(() => this.notifyListeners());
    }
  }

  public getStorageStats() {
    const deviceEstimate = this.load('storage_device_estimate', null) as {
      usage?: number;
      quota?: number;
    } | null;
    return buildStorageStats({
      cache: this.cache,
      tier: this.getStorageTier(),
      unlimited: this.hasUnlimitedPlan(),
      offlineSync: !!this.settings.offlineSync,
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

export const db = new LocalDB();
