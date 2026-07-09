/**
 * Authoritative map of real-time cloud data paths for the entire app.
 * Every social surface must use one of these transports — never invent a parallel path.
 *
 * Dual backend: Supabase is primary; Firebase mirrors the same payloads when Supabase is
 * unreachable or the account is on Firebase backup (`shouldUseFirebaseForCloudData`).
 * Party live bus, chat, posts, blocks, notifications, and profile visits all route through
 * the unified *Cloud facades — never call provider SDKs directly from UI.
 *
 * CU = cross-user shared table / Realtime / platform API
 * AS = same-user multi-device via user_app_state (correct for personal prefs only)
 * N  = notification delivery (user_notifications)
 */
export const LIVE_DATA_FLOW_MAP = {
  messages: {
    write:
      'queueCloudMessageSend → Supabase chat_messages / Firestore chat_threads/.../messages; reactions + reads + edit/delete on same lane',
    read: 'startCloudChatRealtime (Supabase postgres_changes or Firestore listeners) + syncCloudChatInbox',
    users: 'resolveUser / ensurePeerProfileCached',
    transport: 'CU',
  },
  notifications: {
    write: 'queueCloudNotificationDelivery → notificationsCloud (Supabase or Firestore user_notifications)',
    read: 'startCloudNotificationRealtime + syncCloudNotifications',
    users: 'resolveUser / ensureActorCached',
    transport: 'CU',
  },
  posts: {
    write: 'scheduleCloudPostPublish / postsCloud → Supabase posts + post-media OR Firestore posts + Firebase Storage',
    read: 'syncCloudSocialFeed + postsCloud realtime (Supabase postgres_changes or Firestore listeners)',
    users: 'resolveUser on author',
    transport: 'CU',
  },
  reels: {
    write: 'scheduleCloudReelPublish → posts (payload.contentKind=reel) via postsCloud',
    read: 'syncCloudSocialFeed (split reels) + postsCloud realtime',
    users: 'resolveUser on author',
    transport: 'CU',
  },
  comments: {
    write: 'queueCloudCommentPublish → social_comments (Supabase or Firestore)',
    read: 'syncCloudCommentsForTargets + social realtime',
    users: 'resolveUser on author',
    transport: 'CU',
  },
  engagement: {
    write: 'queueCloudEngagement → social_engagement (Supabase or Firestore)',
    read: 'syncCloudEngagementForTargets + social realtime',
    users: 'current user like/save state',
    transport: 'CU',
  },
  stories: {
    write: 'queueCloudStoryPublish → social_stories (Supabase or Firestore)',
    read: 'syncCloudStories + social realtime',
    users: 'ensureAuthor on author_id',
    transport: 'CU',
  },
  follows: {
    write: 'cloudFollowToggle / cloudFollowRequestToggle → followsCloud + notificationsCloud',
    read: 'hydrateCloudFollowsForUser (followsCloud)',
    users: 'resolveUser / useUserById',
    transport: 'CU',
  },
  blocks: {
    write: 'queueCloudBlock → blocksCloud (Supabase or Firestore user_blocks)',
    read: 'startCloudBlocksRealtime + syncCloudBlocks',
    users: 'isUserBlocked filters feeds/messages',
    transport: 'CU',
  },
  profileVisits: {
    write: 'queueCloudProfileVisit → profileVisitsCloud',
    read: 'startCloudProfileVisitsRealtime + syncCloudProfileVisits',
    users: 'visitor profiles cached',
    transport: 'CU',
  },
  thoughts: {
    write: 'updateUser → profiles.note (Supabase or Firestore profiles)',
    read: 'thoughtNoteCloudSync profiles realtime (Supabase or Firestore)',
    users: 'resolveUser / useUserById',
    transport: 'CU',
  },
  live: {
    write: 'setUserLiveStatus → profiles live_* + notifyLiveStarted',
    read: 'useCloudLiveDiscovery streams/party_rooms/profiles realtime (Supabase + Firebase partyRoomsCloud)',
    users: 'resolveUser on host',
    transport: 'CU',
  },
  party: {
    write:
      'partyRoomsCloud: insertPartyRoomMessage / upsertPartyRoom / presence / party_room_sync_events (gifts, PK, commerce, game, seats) — Supabase or Firestore',
    read: 'partyRoomsCloud: usePartyRoomChat / usePartyRoomPresence / useCloudPartyRooms / useLiveRoomBus (incl. seats snapshot)',
    users: 'room host profile fetch',
    transport: 'CU',
  },
  profile: {
    write: 'scheduleCloudProfileSync → profiles (incl. is_private)',
    read: 'subscribeProfileRow + syncCloudUserSocial',
    users: 'canonical profiles row',
    transport: 'CU',
  },
  presence: {
    write: 'postPresenceHeartbeat + postChatTyping',
    read: 'fetchOnlinePresence / heartbeat friendIds / typing poll',
    users: 'cloud auth ids only',
    transport: 'CU',
  },
  wallet: {
    write: 'platform wallet APIs / transferCoins',
    read: 'hydratePlatformSession + syncServerWalletBalance (visibility + inbox poll)',
    users: 'self account',
    transport: 'CU',
  },
  gifts: {
    write:
      'adminCatalogStore upsert/delete → platform_gift_catalog (Supabase realtime) + admin_published_gifts user_app_state',
    read: 'usePartyGiftCatalog + platformGiftCatalogCloud realtime + getMergedPartyGiftCatalog',
    users: 'all viewers in live rooms; admin edits from Creation Studio or in-room gift panel',
    transport: 'CU+AS',
  },
  appBrand: {
    write:
      'AppBrandPortalCard → publishPlatformAppBrand → platform_app_brand (Supabase + Firestore platform_app_brand/default)',
    read: 'platformAppBrandCloud fetch/realtime (Supabase postgres_changes + Firestore onSnapshot) → appBrandRuntime',
    users: 'all users + logged-out install/PWA surfaces',
    transport: 'CU',
  },
  karaoke: {
    write: 'karaoke upload cloud + user_app_state metadata',
    read: 'scheduleLiveSessionSync + party/live surfaces',
    users: 'resolveUser on hosts/profiles',
    transport: 'CU+AS',
  },
  personalCollections: {
    write: 'db.save → scheduleCloudAppStateSync (settings, wallpapers, drafts)',
    read: 'startCloudAppStateRealtime',
    users: 'same account only — correct path',
    transport: 'AS',
  },
} as const;

export type LiveDataFlowKey = keyof typeof LIVE_DATA_FLOW_MAP;

/** Surfaces that must never stay local-only for cloud accounts. */
export const CROSS_USER_LIVE_SURFACES: LiveDataFlowKey[] = [
  'messages',
  'notifications',
  'posts',
  'reels',
  'comments',
  'engagement',
  'stories',
  'follows',
  'blocks',
  'profileVisits',
  'thoughts',
  'live',
  'party',
  'profile',
  'presence',
];
