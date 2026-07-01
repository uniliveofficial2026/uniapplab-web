export type Tab = 'home' | 'search' | 'reels' | 'messages' | 'notifications' | 'workspace' | 'dating' | 'profile' | 'live' | 'karaoke' | 'rooms' | 'local-games' | 'third-party-games' | 'wallet';

/** Live ring style when `status` is `live`. */
export type LiveKind =
  | 'solo'
  | 'audio-room'
  | 'video-multi'
  | 'pk'
  | 'commerce'
  | 'game';

export type PlatformRole = 'user' | 'streamer' | 'admin';

export interface User {
  id: string;
  role?: PlatformRole;
  bannedAt?: number;
  banReason?: string;
  mutedUntil?: number;
  /** Public User ID (customizable on setup; changeable every 7 days in settings). */
  publicUserId?: string;
  /** Unix ms when publicUserId was last set or changed. */
  publicUserIdChangedAt?: number;
  username: string;
  displayName: string;
  avatarUrl: string;
  isVerified?: boolean;
  followers?: number;
  following?: number;
  isFollowing?: boolean;
  /** When true, only approved followers see posts/reels on profile and in feed. */
  isPrivate?: boolean;
  bio?: string;
  /** Short thought/note shown as a speech bubble on the avatar. */
  note?: string;
  /** Unix ms when `note` was last saved. */
  noteUpdatedAt?: number;
  status?: 'story' | 'live' | 'none';
  /** Ring color/style for live streams (defaults to solo / red). */
  liveKind?: LiveKind;
  storageTier?: '50GB' | '100GB' | 'Unlimited';
  /** Per-user override: allow profile visit tracking (defaults to on). */
  profileVisitorsEnabled?: boolean;
  /** @deprecated Migrated to premiumSubscriptions — kept for older local data. */
  purchasedPremiumPackages?: string[];
  /** Active and expired premium passes with expiry timestamps. */
  premiumSubscriptions?: PremiumSubscription[];
}

export interface PremiumSubscription {
  packageId: string;
  purchasedAt: number;
  expiresAt: number;
  /** Last profile premium tier purchased or extended (1m / 3m / 6m / 1y). */
  lastTierId?: string;
}

export type ProfileVisitSurface = 'profile' | 'posts' | 'reels' | 'story' | 'live';

export interface ProfileVisitEvent {
  at: number;
  surface: ProfileVisitSurface;
  contentId?: string;
  previewUrl?: string;
  liveKind?: LiveKind;
}

/** Someone who viewed a profile (stored per profile owner). */
export interface ProfileVisitEntry {
  visitorUserId: string;
  lastVisitedAt: number;
  visitCount: number;
  /** Premium hidden mode — legacy; filtered from lists. */
  isHidden?: boolean;
  /** Where they spent time last (profile grid, post, reel, story, live). */
  lastSurface?: ProfileVisitSurface;
  lastContentId?: string;
  lastPreviewUrl?: string;
  lastLiveKind?: LiveKind;
  /** Recent views for preview chips (newest last). */
  recentEvents?: ProfileVisitEvent[];
}

export interface ProfileVisitorRow extends ProfileVisitEntry {
  user: User;
}

export interface ProfileVisitorStats {
  visibleCount: number;
  hiddenCount: number;
  totalCount: number;
  canSeeHidden: boolean;
  surfaceCounts: Record<ProfileVisitSurface, number>;
}

export interface Post {
  id: string;
  user: User;
  imageUrl: string;
  videoUrl?: string;
  caption: string;
  location?: string;
  likes: number;
  comments: number;
  createdAt: string;
  isLiked: boolean;
  isSaved: boolean;
  isReported?: boolean;
  /** Hidden from profile and feed; visible only in owner's archive. */
  isArchived?: boolean;
  filter?: string;
  brightness?: number;
  contrast?: number;
  textOverlay?: string;
  textOverlayColor?: string;
  textOverlaySize?: number;
  textOverlayPos?: number;
  audioUrl?: string;
  /** Embedded album art / video frame for soundtrack disc UI */
  audioCoverUrl?: string;
  mediaList?: Array<{ url: string; type: 'image' | 'video' | 'audio'; name: string; coverUrl?: string }>;
  font?: string;
  color?: string;
  alignment?: string;
  size?: string;
  bg?: string;
  /** Users tagged in this post (profile Tagged tab). */
  taggedUserIds?: string[];
  reposts?: number;
  repost?: Post;
}

export interface Story {
  id: string;
  user: User;
  hasViewed: boolean;
}

export interface Reel {
  id: string;
  user: User;
  likes: number;
  comments: number;
  caption: string;
  videoUrl: string;
  imageUrl?: string;
  isLiked: boolean;
  isSaved: boolean;
  audioUrl?: string;
  /** Embedded album art / video frame for soundtrack disc UI */
  audioCoverUrl?: string;
  mediaList?: Array<{ url: string; type: 'image' | 'video' | 'audio'; name: string; coverUrl?: string }>;
  filter?: string;
  brightness?: number;
  contrast?: number;
  textOverlay?: string;
  textOverlayColor?: string;
  textOverlaySize?: number;
  textOverlayPos?: number;
  shares?: number;
  createdAt?: string;
  font?: string;
  color?: string;
  alignment?: string;
  size?: string;
  bg?: string;
}

export type AppNotificationType =
  | 'follow'
  | 'follow_request'
  | 'like'
  | 'comment'
  | 'mention'
  | 'message'
  | 'order'
  | 'system'
  | 'task'
  | 'activity'
  | 'live';

export interface AppNotification {
  id: string;
  type: AppNotificationType;
  createdAt: number;
  read?: boolean;
  /** User who triggered the notification. */
  actorUserId?: string;
  /** Resolved snapshot for list rendering (kept in sync via db). */
  user?: User;
  title?: string;
  text?: string;
  postId?: string;
  reelId?: string;
  postImage?: string;
  orderId?: string;
  link?: string;
  /** Workspace task id when type is `task`. */
  taskId?: string | number;
  /** Deep-link tab when the row is opened. */
  targetTab?: Tab;
  /** Live stream format when type is `live`. */
  liveKind?: LiveKind;
  /** @deprecated Use createdAt + formatNotificationTime */
  time?: string;
}

export type MessageReplyRef = {
  index: number;
  [key: string]: unknown;
};

export type ChatMessageLocation = {
  latitude: number;
  longitude: number;
  label?: string;
  accuracyMeters?: number;
};

export interface ChatMessage {
  id?: string;
  text?: string;
  from?: string;
  timestamp?: number | string;
  media?: unknown[];
  location?: ChatMessageLocation;
  reactions?: Record<string, string[]>;
  reactionState?: {
    selected?: string | null;
    counts?: Record<string, number>;
  };
  isAuthor?: boolean;
  replyTo?: MessageReplyRef;
  replyToMany?: MessageReplyRef[];
  [key: string]: unknown;
}

export interface ChatPresenceEntry {
  online?: boolean;
  typing?: boolean;
  lastSeenAt?: number;
  lastActiveAt?: number;
  /** DM / group thread id when this user has that chat open (null = not in a thread). */
  activeChatId?: string | null;
}

export type MessagesByChatStore = Record<string, ChatMessage[]>;
export type ChatPresenceStore = Record<string, ChatPresenceEntry>;
export type ChatTimestampStore = Record<string, number>;
export type StoriesByUserStore = Record<string, import('./components/stories/storyDraft').StoryDraftMedia[]>;

export interface ChatGroup {
  id: string;
  displayName: string;
  username: string;
  avatarUrl: string;
  isGroup: true;
  memberIds: string[];
  createdBy: string;
  adminIds: string[];
  mutedMemberIds: string[];
  adminOnlyPosting: boolean;
  requireApprovalToJoin: boolean;
}

export type CloudSyncResult =
  | { ok: true; syncedCollections: number; syncedItems: number; syncedSize: number }
  | { ok: false; reason: string };
