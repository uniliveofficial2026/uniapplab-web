/**
 * LocalDB collection keys mirrored to cloud for signed-in accounts.
 * Session / device-only keys are excluded.
 */
export const CLOUD_SYNC_COLLECTION_KEYS = [
  'posts',
  'reels',
  'messages',
  'post_comments',
  'reel_comments',
  'stories',
  'story_views',
  'notification_inbox',
  'notifications',
  'users',
  'follow_graph',
  'blocked_users',
  'profile_visits',
  'workspace_tasks',
  'workspace_files',
  'workspace_auditLogs',
  'chat_presence',
  'chat_read_state',
  'chat_peer_read_state',
  'chat_wallpapers',
  'app_settings',
  'globalMuted',
  'globalMutedDefaultV2',
  'unreadMessagesCount',
  'hasUnreadNotifications',
  'dating_state',
] as const;

export type CloudSyncCollectionKey = (typeof CLOUD_SYNC_COLLECTION_KEYS)[number];

const KEY_SET = new Set<string>(CLOUD_SYNC_COLLECTION_KEYS);

export function isCloudSyncCollectionKey(key: string): key is CloudSyncCollectionKey {
  return KEY_SET.has(key);
}
