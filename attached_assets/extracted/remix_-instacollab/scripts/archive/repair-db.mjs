/**
 * Repair corrupted src/lib/db.ts (missing imports, constructor, initIDB).
 * Reconstructs header from dist bundle + existing method bodies.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const dbPath = path.join(root, 'src/lib/db.ts');
const lines = fs.readFileSync(dbPath, 'utf8').split('\n');

const startIdx = lines.findIndex((l) => l.trim() === 'private notifyListeners() {');
const endIdx = lines.findIndex((l) => l.trim() === 'export const db = new LocalDB();');
if (startIdx < 0 || endIdx < 0) {
  throw new Error(`Could not find body bounds (start=${startIdx}, end=${endIdx})`);
}

let body = lines.slice(startIdx, endIdx).join('\n');

// Fix known corruption from failed monolith restore
body = body.replace(
  /  public setStorageTier\(tier: '50GB' \| '100GB' \| 'Unlimited'\) \{\n    const userId = this\.currentUserId;\n    this\.updateUser\(userId, \(u\) => \(\{ \.\.\.u, storageTier: tier \}\)\);\n    if \(tier === 'Unlimited'\) \{\n      this\.updateSettings\(\{ offlineSync: true \}\);\n    \}\n\n      this\.trimHighChurnCollections\(\);\n    \}\n    this\.notifyListeners\(\);\n  \}/,
  `  public setStorageTier(tier: '50GB' | '100GB' | 'Unlimited') {
    const userId = this.currentUserId;
    this.updateUser(userId, (u) => ({ ...u, storageTier: tier }));
    if (tier === 'Unlimited') {
      this.updateSettings({ offlineSync: true });
    }
    if (tier !== 'Unlimited' && !this.settings.offlineSync) {
      this.trimHighChurnCollections();
    }
    this.notifyListeners();
  }`
);

body = body.replace(
  /  updateUser\(id: string, updateFn: \(user: User\) => User\) \{\n    const prior = this\.users\.find\(\(u: User\) => u\?\.id === id\);\n    const updated = this\.users\.map\(\(u\) => \(u\.id === id \? updateFn\(u\) : u\)\);\n    this\.save\('users', updated\);\n    const next = updated\.find\(\(u: User\) => u\?\.id === id\);\n    if \(prior && next && prior\.status !== 'live' && next\.status === 'live'\) \{\n\n    this\.syncUserRefsInContent\(id\);\n  \}/,
  `  updateUser(id: string, updateFn: (user: User) => User) {
    const prior = this.users.find((u: User) => u?.id === id);
    const updated = this.users.map((u) => (u.id === id ? updateFn(u) : u));
    this.save('users', updated);
    const next = updated.find((u: User) => u?.id === id);
    if (prior && next && prior.status !== 'live' && next.status === 'live') {
      this.notifyLiveStarted(id, next.liveKind);
    }
    this.syncUserRefsInContent(id);
  }`
);

const header = `import {
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
  ChatPresenceStore,
  ChatWallpaperItem,
  ChatWallpapersStore,
  CloudConnection,
  MessageReplyRef,
  MessagesByChatStore,
  WorkspaceAuditLog,
  WorkspaceFile,
  WorkspaceTask,
} from './dbTypes';
import { recordCollectionSave } from './devActivity';
import {
  type CommentLike,
  type CommentThreadStore,
  patchCommentTreeForUser,
} from './entityResolve';
import { resolveUser } from './safe';
import { normalizeEditorColorFields } from './themeText';
import type { StoryDraftMedia } from '../components/stories/storyDraft';
import type {
  CloudSyncResult,
  LiveKind,
  Post,
  Reel,
  StoriesByUserStore,
  User,
} from '../types';

type Listener = () => void;
type CloudDataType = 'photos' | 'videos' | 'files' | 'messages' | 'stories' | 'posts';

class LocalDB {
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
      : \`tab_\${Date.now()}_\${Math.random().toString(36).slice(2)}\`;
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

`;

const footer = `
export const db = new LocalDB();
`;

// Body from corrupted file may already end with class `}`.
body = body.replace(/\n\}\s*$/, '\n');

const monolith = header + body + footer;
fs.writeFileSync(dbPath, monolith);
console.log('Repaired', dbPath, '→', monolith.split('\n').length, 'lines');
