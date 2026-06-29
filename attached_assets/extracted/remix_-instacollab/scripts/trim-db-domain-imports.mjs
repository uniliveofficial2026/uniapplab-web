#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const domainsDir = path.join(root, 'src/lib/db/domains');

const HEADERS = {
  authPosts: `import { POSTS, USERS } from '../../data';
import {
  type CommentLike,
  countCommentThread,
  patchCommentTreeForUser,
} from '../../entityResolve';
import { postUserId, reelUserId, resolveUser } from '../../safe';
import type { StoryDraftMedia } from '../../../components/stories/storyDraft';
import type {
  AppNotification,
  LiveKind,
  Post,
  Reel,
  StoriesByUserStore,
  User,
} from '../../../types';
import type { AuthPostsLayer } from '../layers';
import type { LocalDB } from '../localDbType';
import type { Constructor, MixinCtor } from '../mixin';

`,
  followBlocked: `import { DEFAULT_FOLLOW_GRAPH } from '../../data';
import { resolveUser } from '../../safe';
import type { User } from '../../../types';
import type { FollowBlockedLayer } from '../layers';
import type { LocalDB } from '../localDbType';
import type { Constructor, MixinCtor } from '../mixin';

`,
  profile: `import { PROFILE_VISITS_CAP, PROFILE_VISITS_KEY } from '../constants';
import {
  buildCreatorProgress,
  type CreatorActivityStats,
  type CreatorProgress,
} from '../../creatorXP';
import {
  consolidateProfilePremiumSubscriptions,
  getPackageDurationMs,
  getProfilePremiumAccessStatus,
  getPremiumSubscriptionStatus,
  normalizePremiumSubscriptions,
  userHasPremiumPackage,
  userHasProfilePremium,
} from '../../premium';
import {
  isProfilePremiumPackageId,
  isProfilePremiumTierId,
  PREMIUM_PACKAGES,
  PROFILE_PREMIUM_ENTITLEMENT_ID,
  type PremiumPackageId,
  type ProfilePremiumTierId,
} from '../../premiumPackages';
import {
  buildVisitEvent,
  emptySurfaceCounts,
  type ProfileVisitContext,
  visitContextKey,
} from '../../profileVisits';
import { postUserId, reelUserId, resolveUser } from '../../safe';
import type {
  LiveKind,
  Post,
  PremiumSubscription,
  ProfileVisitEntry,
  ProfileVisitSurface,
  ProfileVisitorRow,
  ProfileVisitorStats,
  Reel,
  User,
} from '../../../types';
import type { ProfileLayer } from '../layers';
import type { LocalDB } from '../localDbType';
import type { Constructor, MixinCtor } from '../mixin';

`,
  workspaceTasks: `import type { WorkspaceAuditLog, WorkspaceTask } from '../../dbTypes';
import type { WorkspaceTasksLayer } from '../layers';
import type { LocalDB } from '../localDbType';
import type { Constructor, MixinCtor } from '../mixin';

`,
  reels: `import { resolveUser } from '../../safe';
import type { Reel, User } from '../../../types';
import type { ReelsLayer } from '../layers';
import type { LocalDB } from '../localDbType';
import type { Constructor, MixinCtor } from '../mixin';

`,
  notifications: `import {
  LEGACY_NOTIFICATIONS_KEY,
  NOTIFICATION_INBOX_KEY,
  NOTIFICATIONS_CAP,
} from '../constants';
import { LIVE_KIND_LABELS } from '../../liveRing';
import { notificationDedupeKey } from '../../notifications';
import { postUserId, resolveUser, safeUserId, userAtModuloIndex } from '../../safe';
import type {
  AppNotification,
  AppNotificationType,
  LiveKind,
  Post,
  User,
} from '../../../types';
import type { NotificationsLayer } from '../layers';
import type { LocalDB } from '../localDbType';
import type { Constructor, MixinCtor } from '../mixin';

`,
  workspaceFiles: `import type { WorkspaceFile } from '../../dbTypes';
import type { WorkspaceFilesLayer } from '../layers';
import type { LocalDB } from '../localDbType';
import type { Constructor, MixinCtor } from '../mixin';

`,
  messages: `import type {
  ChatMessage,
  ChatWallpaperItem,
  MessageReplyRef,
  MessagesByChatStore,
} from '../../dbTypes';
import { safeUserId } from '../../safe';
import type { ChatPresenceStore, ChatTimestampStore } from '../../../types';
import type { MessagesLayer } from '../layers';
import type { LocalDB } from '../localDbType';
import type { Constructor, MixinCtor } from '../mixin';

`,
  stories: `import {
  DEMO_LIVE_KIND_PATCHES,
  DEMO_STORY_SEGMENTS,
  DEMO_USER_STATUS_PATCHES,
  USERS,
} from '../../data';
import { recordCollectionSave } from '../../devActivity';
import type { StoryDraftMedia } from '../../../components/stories/storyDraft';
import type { StoriesByUserStore, User } from '../../../types';
import type { StoriesLayer } from '../layers';
import type { LocalDB } from '../localDbType';
import type { Constructor, MixinCtor } from '../mixin';

`,
  settings: `import type { AppSettings } from '../../dbTypes';
import type { CloudDataType } from '../types';
import type { SettingsLayer } from '../layers';
import type { LocalDB } from '../localDbType';
import type { Constructor, MixinCtor } from '../mixin';

`,
  cloud: `import type { CloudConnection } from '../../dbTypes';
import type { CloudDataType } from '../types';
import type { CloudSyncResult } from '../../../types';
import type { CloudLayer } from '../layers';
import type { Constructor, MixinCtor } from '../mixin';

`,
  uiFlags: `import type { UiFlagsLayer } from '../layers';
import type { Constructor, MixinCtor } from '../mixin';

`,
  comments: `import { type CommentLike, type CommentThreadStore } from '../../entityResolve';
import { postUserId, reelUserId, safeUserId } from '../../safe';
import { normalizeEditorColorFields } from '../../themeText';
import type { StoryDraftMedia } from '../../../components/stories/storyDraft';
import type { Post, Reel, User } from '../../../types';
import type { CommentsLayer } from '../layers';
import type { LocalDB } from '../localDbType';
import type { Constructor, MixinCtor } from '../mixin';

`,
};

const LAYER = {
  authPosts: 'AuthPosts',
  followBlocked: 'FollowBlocked',
  profile: 'Profile',
  workspaceTasks: 'WorkspaceTasks',
  reels: 'Reels',
  notifications: 'Notifications',
  workspaceFiles: 'WorkspaceFiles',
  messages: 'Messages',
  stories: 'Stories',
  settings: 'Settings',
  cloud: 'Cloud',
  uiFlags: 'UiFlags',
  comments: 'Comments',
};

for (const key of Object.keys(HEADERS)) {
  const filePath = path.join(domainsDir, `${key}.ts`);
  let src = fs.readFileSync(filePath, 'utf8');
  src = src.replace(/^[\s\S]*?(?=export function With)/, HEADERS[key]);
  const layer = LAYER[key];
  src = src.replace(
    /export function (With\w+)<T extends Constructor(?:<DbCore>)?>\(Base: T\)(?:: MixinCtor<T, \w+Layer>)? \{/,
    `export function $1<T extends Constructor>(Base: T): MixinCtor<T, ${layer}Layer> {`
  );
  src = src.replace(/constructor\(\.\.\.args: any\[\]\)/g, 'constructor(...args: unknown[])');
  if (!src.includes(`} as MixinCtor<T, ${layer}Layer>`)) {
    src = src.replace(/\n  \};\n\}\s*$/, `\n  } as MixinCtor<T, ${layer}Layer>;\n}\n`);
  }
  fs.writeFileSync(filePath, src);
  console.log('Trimmed', key);
}
