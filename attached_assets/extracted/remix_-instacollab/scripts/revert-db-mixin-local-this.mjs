#!/usr/bin/env node
/** Revert mistaken this.asLocalDB() for same-class private/core members. */
import fs from 'fs';
import path from 'path';

const domainsDir = path.join(path.resolve(import.meta.dirname, '..'), 'src/lib/db/domains');

const REVERT = [
  // DbCore protected / public
  'whenReady',
  'cache',
  'saveToIDB',
  'cloudSyncInProgress',
  'followGraphEnsured',
  // profile private
  'getProfileVisitsStore',
  'saveProfileVisitsStore',
  'getProfileVisitList',
  'resolveVisitPreviewUrl',
  'scrubViewerTracesFromAllProfiles',
  'enforcePremiumExpiryForCurrentUser',
  'purgeHiddenProfileVisitEntries',
  'ownerContentPreview',
  'backfillProfileVisitorSurfaces',
  'ensureDemoProfileVisitors',
  // notifications private (same file)
  'getNotificationInboxStore',
  'saveNotificationInboxStore',
  'migrateLegacyNotificationsInbox',
  'normalizeNotificationRow',
  'notifyLiveStarted',
  'notifyLiveJoined',
  'syncUserRefsInNotificationInboxes',
  'notificationsDeliveryEnabled',
  'resolveTaskAssigneeUserId',
  'compactNotificationInboxForCurrentUser',
  'ensureDemoNotifications',
  // followBlocked private
  'ensureFollowGraph',
  'syncIsFollowingFromGraph',
  'setUserFollows',
  'getBlockedUsersStore',
  'saveBlockedUsersStore',
  // cloud private
  'countItems',
  'getCloudDataTypes',
  'isKeyAllowedForConnection',
  'getCloudConnections',
  'getActiveCloudConnection',
  // authPosts private
  'mergeUserIntoEmbedded',
  'syncUserRefsInContent',
  'syncUserRefsInComments',
  'syncPostCommentCount',
  'syncReelCommentCount',
  'syncPostMediaInNotifications',
  'enrichCommentPayload',
  // comments private
  'commentMentionsUser',
  'findPostCommentById',
  'notifyReplyOnPost',
  'notifyCommentOnPost',
  'notifyCommentOnReel',
  // uiFlags
  'migrateGlobalMuteDefault',
  // stories own getters/methods
  'applyDemoStoryStrip',
  'storyViews',
  'stories',
  'seedDemoStoriesIfNeeded',
  // workspaceFiles own getter
  'files',
  // notifications public on layer but implemented private — use this for in-file
  'notifyWorkspaceTeam',
];

for (const f of fs.readdirSync(domainsDir)) {
  if (!f.endsWith('.ts')) continue;
  let s = fs.readFileSync(path.join(domainsDir, f), 'utf8');
  for (const name of REVERT) {
    const re = new RegExp(`this\\.asLocalDB\\(\\)\\.${name}\\b`, 'g');
    s = s.replace(re, `this.${name}`);
  }
  fs.writeFileSync(path.join(domainsDir, f), s);
}

console.log('Reverted local this.asLocalDB() calls');
