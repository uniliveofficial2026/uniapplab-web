/**
 * Authoritative map of real-time cloud data paths for the entire app.
 * Every social surface must use one of these transports — never invent a parallel path.
 *
 * CU = cross-user shared table / Realtime / platform API
 * AS = same-user multi-device via user_app_state (correct for personal prefs only)
 * N  = notification delivery (user_notifications)
 */
export const LIVE_DATA_FLOW_MAP = {
  messages: {
    write:
      'queueCloudMessageSend (text + photo/video/audio/file/pdf/location) via chat-media upload → chat_messages.payload; groups → chat_threads.meta; reactions/reads/edit/delete; calls → call events + LiveKit /api/livekit/chat/token',
    read: 'startCloudChatRealtime + syncCloudChatInbox (1:1 + group threads, reactions, receipts, call invites)',
    users: 'resolveUser / ensurePeerProfileCached / message.from in groups',
    transport: 'CU',
  },
  notifications: {
    write: 'queueCloudNotificationDelivery → user_notifications',
    read: 'startCloudNotificationRealtime + syncCloudNotifications',
    users: 'resolveUser / ensureActorCached',
    transport: 'CU',
  },
  posts: {
    write: 'scheduleCloudPostPublish / scheduleCloudPostMutation / scheduleCloudPostDelete → posts',
    read: 'syncCloudSocialFeed + posts realtime',
    users: 'resolveUser on author',
    transport: 'CU',
  },
  reels: {
    write: 'scheduleCloudReelPublish → posts (payload.contentKind=reel)',
    read: 'syncCloudSocialFeed (split reels) + posts realtime',
    users: 'resolveUser on author',
    transport: 'CU',
  },
  comments: {
    write: 'queueCloudCommentPublish → social_comments',
    read: 'syncCloudCommentsForTargets + social_comments realtime',
    users: 'resolveUser on author',
    transport: 'CU',
  },
  engagement: {
    write: 'queueCloudEngagement → social_engagement',
    read: 'syncCloudEngagementForTargets + social_engagement realtime',
    users: 'current user like/save state',
    transport: 'CU',
  },
  stories: {
    write: 'queueCloudStoryPublish → social_stories',
    read: 'syncCloudStories + social_stories realtime',
    users: 'ensureAuthor on author_id',
    transport: 'CU',
  },
  follows: {
    write: 'cloudFollowToggle / cloudFollowRequestToggle → follows + user_notifications',
    read: 'hydrateCloudFollowsForUser',
    users: 'resolveUser / useUserById',
    transport: 'CU',
  },
  blocks: {
    write: 'queueCloudBlock → user_blocks',
    read: 'startCloudBlocksRealtime + syncCloudBlocks (both directions)',
    users: 'isUserBlocked filters feeds/messages',
    transport: 'CU',
  },
  profileVisits: {
    write: 'queueCloudProfileVisit → profile_visits',
    read: 'startCloudProfileVisitsRealtime + syncCloudProfileVisits (owner inbox)',
    users: 'visitor profiles cached',
    transport: 'CU',
  },
  thoughts: {
    write: 'updateUser → profiles.note',
    read: 'thoughtNoteCloudSync profiles realtime',
    users: 'resolveUser / useUserById',
    transport: 'CU',
  },
  live: {
    write: 'setUserLiveStatus → profiles live_* + notifyLiveStarted',
    read: 'useCloudLiveDiscovery streams/party_rooms/profiles realtime',
    users: 'resolveUser on host',
    transport: 'CU',
  },
  party: {
    write: 'insertPartyRoomMessage / upsertPartyRoom / presence channel',
    read: 'usePartyRoomChat / usePartyRoomPresence / useCloudPartyRooms',
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
    read: 'hydratePlatformSession + syncServerWalletBalance',
    users: 'self account',
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
