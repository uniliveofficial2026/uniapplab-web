/**
 * user_app_state v2 — AS-only allowlist (private same-user application state).
 * CU/EP collections must never be written through user_app_state.
 */
export const USER_APP_STATE_KEYS = [
  'app_settings',
  'chat_wallpapers',
  'globalMuted',
  'globalMutedDefaultV2',
  'dating_state',
  'karaoke_user_state',
] as const;

export type UserAppStateKey = (typeof USER_APP_STATE_KEYS)[number];

/**
 * Legacy v1 keys mirrored wholesale to user_app_state — read for migration only;
 * never written in v2 sync paths.
 */
export const LEGACY_CLOUD_SYNC_KEYS = [
  'posts',
  'reels',
  'messages',
  'post_comments',
  'reel_comments',
  'stories',
  'profile_stories',
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
  'unreadMessagesCount',
  'hasUnreadNotifications',
  'karaoke_uploads',
  'karaoke_profile_backgrounds',
  'karaoke_recordings',
  'admin_published_gifts',
  'admin_published_beauty',
  'coins_balance',
  'game_coins',
  'cash_balance',
  'wallet_transactions',
] as const;

export type LegacyCloudSyncKey = (typeof LEGACY_CLOUD_SYNC_KEYS)[number];

/** @deprecated Prefer USER_APP_STATE_KEYS — kept for gradual migration. */
export const CLOUD_SYNC_COLLECTION_KEYS = USER_APP_STATE_KEYS;

export type CloudSyncCollectionKey = UserAppStateKey;

const USER_APP_STATE_KEY_SET = new Set<string>(USER_APP_STATE_KEYS);
const LEGACY_KEY_SET = new Set<string>(LEGACY_CLOUD_SYNC_KEYS);

export function isUserAppStateKey(key: string): key is UserAppStateKey {
  return USER_APP_STATE_KEY_SET.has(key);
}

export function isLegacyCloudSyncKey(key: string): key is LegacyCloudSyncKey {
  return LEGACY_KEY_SET.has(key);
}

export function isCloudSyncCollectionKey(key: string): key is CloudSyncCollectionKey {
  return isUserAppStateKey(key);
}
