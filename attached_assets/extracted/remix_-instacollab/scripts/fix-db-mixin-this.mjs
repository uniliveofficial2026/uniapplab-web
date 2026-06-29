#!/usr/bin/env node
/**
 * Fix db domain mixin typing: DbCoreBacked constraint, any[] constructors,
 * cross-domain `this.foo` -> `this.asLocalDB().foo` where foo is not on DbCoreBacked.
 */
import fs from 'fs';
import path from 'path';

const root = path.resolve(import.meta.dirname, '..');
const domainsDir = path.join(root, 'src/lib/db/domains');

const CORE_ONLY = new Set([
  'load',
  'save',
  'cappedList',
  'notifyListeners',
  'asLocalDB',
]);

/** Properties/methods owned by a domain file (keep `this.`). */
const OWN = {
  authPosts: new Set([
    'posts',
    'users',
    'isLoggedIn',
    'currentUserId',
    'currentUser',
    'login',
    'logout',
    'registerUser',
    'addPost',
    'updatePost',
    'deletePost',
    'togglePostArchive',
    'updateUser',
    'setUserLiveStatus',
    'togglePostLike',
    'togglePostSave',
    'toggleReelLike',
    'toggleReelSave',
    'syncUserRefsInContent',
    'purgeUserFromAllContent',
    'backfillCommentThreadsForUser',
  ]),
  followBlocked: new Set([
    'getFollowGraph',
    'getFollowingIds',
    'getFollowerIds',
    'isFollowingUser',
    'getUsersByIds',
    'toggleFollow',
    'getBlockedUserIds',
    'isUserBlocked',
    'blockUser',
    'getBlockedUsers',
    'unblockUser',
    'filterItemsByBlockedAuthors',
    'ensureFollowGraph',
  ]),
  profile: new Set([
    'profileVisitorTrackingEnabled',
    'viewerUsesHiddenVisit',
    'canUseHiddenVisitorMode',
    'hasPurchasedPremium',
    'getPremiumSubscriptionStatus',
    'getProfilePremiumAccessStatus',
    'userHasProfilePremium',
    'hasProfilePremium',
    'purchasePremiumPackage',
    'recordProfileVisit',
    'getProfileVisitorStats',
    'getProfileVisitorCount',
    'getProfileVisitors',
    'getProfileVisitorAudienceSummary',
    'getCreatorProgress',
    'removeProfileVisitor',
    'enforcePremiumExpiryForCurrentUser',
    'scrubViewerTracesFromAllProfiles',
    'ensureDemoProfileVisitors',
    'backfillProfileVisitorSurfaces',
    'purgeHiddenProfileVisitEntries',
  ]),
  workspaceTasks: new Set(['tasks', 'addTask', 'updateTask', 'deleteTask', 'auditLogs', 'addAuditLog']),
  reels: new Set(['reels', 'addReel', 'updateReel', 'deleteReel']),
  notifications: new Set([
    'notifications',
    'hasUnreadNotifications',
    'setHasUnreadNotifications',
    'pushNotificationForUser',
    'ensureDemoNotifications',
    'migrateLegacyNotificationsInbox',
    'compactNotificationInboxForCurrentUser',
    'markNotificationRead',
    'markAllNotificationsRead',
    'dismissNotification',
    'clearNotifications',
  ]),
  workspaceFiles: new Set(['workspaceFiles', 'addWorkspaceFile', 'deleteWorkspaceFile']),
  messages: new Set([
    'messagesByChat',
    'chatWallpapers',
    'chatPresence',
    'chatTimestamps',
    'sendMessage',
    'deleteMessage',
    'setChatWallpaper',
    'markChatRead',
    'getUnreadCount',
    'trimMessagesStore',
  ]),
  stories: new Set([
    'storiesByUser',
    'getUserStorySegments',
    'addStorySegment',
    'deleteStorySegment',
    'seedDemoStoriesIfNeeded',
    'markStoryViewed',
    'getStoryDraft',
    'setStoryDraft',
    'clearStoryDraft',
  ]),
  settings: new Set(['settings', 'updateSettings', 'resetSettings']),
  cloud: new Set([
    'cloudConnections',
    'addCloudConnection',
    'removeCloudConnection',
    'syncFromCloud',
    'setOfflineSyncEnabled',
    'getStorageTier',
    'setStorageTier',
  ]),
  comments: new Set([
    'commentThreads',
    'getCommentThread',
    'setCommentThread',
    'addComment',
    'deleteComment',
    'toggleCommentLike',
  ]),
  uiFlags: new Set([
    'migrateGlobalMuteDefault',
    'globalMuted',
    'setGlobalMuted',
    'hasSeenOnboarding',
    'setHasSeenOnboarding',
    'shellChromeHidden',
    'setShellChromeHidden',
  ]),
};

function patchFile(filePath) {
  const base = path.basename(filePath, '.ts');
  const own = OWN[base] ?? new Set();
  let s = fs.readFileSync(filePath, 'utf8');

  s = s.replace(
    /import \{ DbCore \} from '\.\.\/dbCore';\n/g,
    ''
  );
  s = s.replace(
    /import type \{ Constructor, MixinCtor \} from '\.\.\/mixin';/,
    "import type { Constructor, DbCoreBacked, MixinCtor } from '../mixin';"
  );
  if (!s.includes('DbCoreBacked')) {
    s = s.replace(
      /import type \{ Constructor, MixinCtor \} from '\.\.\/mixin';/,
      "import type { Constructor, DbCoreBacked, MixinCtor } from '../mixin';"
    );
  }
  s = s.replace(
    /<T extends Constructor<InstanceType<typeof DbCore>>>/g,
    '<T extends Constructor<DbCoreBacked>>'
  );
  s = s.replace(/constructor\(\.\.\.args: unknown\[\]\)/g, 'constructor(...args: any[])');

  if (!/as MixinCtor</.test(s) && /return class extends Base/.test(s)) {
    s = s.replace(/\n  \};\n\}$/, '\n  } as unknown as MixinCtor<T, ');
    const layerMatch = s.match(/MixinCtor<T, (\w+)>/);
    if (layerMatch) {
      // already has cast
    } else {
      const layer = s.match(/MixinCtor<T, (\w+Layer)>/);
      const layerName = s.match(/: MixinCtor<T, (\w+Layer)>/);
      if (layerName) {
        s = s.replace(
          /return class extends Base \{([\s\S]*)\n  \};\n\}$/,
          (m, body) => `return class extends Base {${body}\n  } as unknown as MixinCtor<T, ${layerName[1]}>;\n}`
        );
      }
    }
  }

  s = s.replace(/\} as MixinCtor</g, '} as unknown as MixinCtor<');

  // Cross-domain: this.member -> this.asLocalDB().member (skip this.asLocalDB already)
  s = s.replace(/\bthis\.([a-zA-Z_][a-zA-Z0-9_]*)\b/g, (full, name) => {
    if (CORE_ONLY.has(name) || own.has(name)) return full;
    return `this.asLocalDB().${name}`;
  });

  // Undo double asLocalDB
  s = s.replace(/this\.asLocalDB\(\)\.asLocalDB\(\)/g, 'this.asLocalDB()');

  fs.writeFileSync(filePath, s);
}

for (const f of fs.readdirSync(domainsDir)) {
  if (f.endsWith('.ts')) patchFile(path.join(domainsDir, f));
}

console.log('Patched domain mixins');
