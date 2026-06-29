/**
 * Per-domain API shapes composed into `LocalDB`.
 * Includes members other domains call via `(this as LocalDB)`.
 */
import type {
  AppSettings,
  CloudConnection,
  LaunchProgress,
  WorkspaceAuditLog,
  WorkspaceFile,
  WorkspaceTask,
} from '../dbTypes';
import type { CommentLike, CommentThreadStore } from '../entityResolve';
import type { CreatorProgress } from '../creatorXP';
import type { PremiumPackageId, ProfilePremiumTierId } from '../premiumPackages';
import type { ProfileVisitContext } from '../profileVisits';
import type { StoryDraftMedia } from '../../components/stories/storyDraft';
import type {
  AppNotification,
  AppNotificationType,
  ChatPresenceStore,
  ChatTimestampStore,
  CloudSyncResult,
  LiveKind,
  Post,
  ProfileVisitorRow,
  ProfileVisitorStats,
  Reel,
  StoriesByUserStore,
  User,
} from '../../types';
import type { ChatMessage, ChatWallpaperItem } from '../dbTypes';
import type { CloudDataType } from './types';

export interface AuthLaunchLayer {
  getLaunchProgress(): LaunchProgress;
  markSplashSeen(): void;
  completeOnboarding(): void;
  completeProfileSetup(): void;
  markTrendingSeen(): void;
  advanceLaunchProgressAfterLogin(profileSetupComplete: boolean): void;
  resetLaunchGatesForNewAccount(userId: string): void;
  hasReachedMainApp(): boolean;
  ensureDemoAuthAccounts(): void;
  signInWithCredentials(
    email: string,
    password: string
  ): { ok: true; userId: string } | { ok: false; reason: string };
  signUpWithCredentials(payload: {
    email: string;
    password: string;
    username: string;
    displayName: string;
  }): { ok: true; userId: string } | { ok: false; reason: string };
  requestPasswordReset(email: string): { ok: true } | { ok: false; reason: string };
  resetPasswordWithCode(
    email: string,
    code: string,
    newPassword: string
  ): { ok: true } | { ok: false; reason: string };
  logoutSession(): void;
}

export interface AuthPostsLayer {
  readonly posts: Post[];
  readonly users: User[];
  readonly isLoggedIn: boolean;
  readonly currentUserId: string;
  readonly currentUser: User;
  login(userId: string): void;
  deleteAccountSnapshot(userId: string): void;
  restoreLegacyDemoContentIfEmpty(userId: string): void;
  logout(): void;
  syncAuthUser(user: User): void;
  registerUser(user: User): void;
  /** Merge cloud search hits into local users (no session switch). */
  cacheDiscoveredUsers(users: User[]): void;
  addPost(post: Partial<Post> & { user?: User }): void;
  updatePost(id: string, updateFn: (post: Post) => Post): void;
  deletePost(id: string): void;
  togglePostArchive(postId: string): boolean;
  updateUser(id: string, updateFn: (user: User) => User): void;
  setUserLiveStatus(userId: string, isLive: boolean, liveKind?: LiveKind): boolean;
  togglePostLike(postId: string): boolean;
  togglePostSave(postId: string): boolean;
  toggleReelLike(reelId: string): boolean;
  toggleReelSave(reelId: string): boolean;
  enrichCommentPayload(comment: Partial<CommentLike>): CommentLike;
  syncPostCommentCount(postId: string): void;
  syncReelCommentCount(reelId: string): void;
}

export interface FollowBlockedLayer {
  getFollowGraph(): { following: Record<string, string[]> };
  getFollowingIds(userId: string): string[];
  getFollowerIds(userId: string): string[];
  isFollowingUser(targetUserId: string): boolean;
  getUsersByIds(userIds: string[]): User[];
  /** Resolved users for followers/following lists (excludes blocked + missing accounts). */
  getFollowListMembers(
    profileUserId: string,
    mode: 'followers' | 'following',
  ): User[];
  /** Idempotently add follower → following (demo seeds). */
  ensureUserFollows(followerId: string, followingId: string): void;
  toggleFollow(targetUserId: string): boolean | null;
  isAccountPrivate(userId: string): boolean;
  setAccountPrivate(enabled: boolean): void;
  hasPendingFollowRequest(targetUserId: string): boolean;
  hasIncomingFollowRequest(requesterId: string): boolean;
  getPendingFollowRequesterIds(profileUserId?: string): string[];
  canViewUserContent(targetUserId: string): boolean;
  getFollowActionState(targetUserId: string): {
    isFollowing: boolean;
    isRequested: boolean;
    canViewContent: boolean;
    isPrivate: boolean;
  };
  approveFollowRequest(requesterId: string): boolean;
  rejectFollowRequest(requesterId: string): boolean;
  filterPostsByPrivateAuthors<T extends { user?: { id?: string } }>(items: T[]): T[];
  getBlockedUserIds(): string[];
  isUserBlocked(targetUserId: string): boolean;
  blockUser(targetUserId: string): boolean;
  getBlockedUsers(): User[];
  unblockUser(targetUserId: string): boolean;
  filterItemsByBlockedAuthors<T extends { user?: { id?: string } }>(items: T[]): T[];
}

export interface ProfileLayer {
  profileVisitorTrackingEnabled(profileUserId: string): boolean;
  viewerUsesHiddenVisit(): boolean;
  canUseHiddenVisitorMode(): boolean;
  hasPurchasedPremium(packageId: PremiumPackageId): boolean;
  getPremiumSubscriptionStatus(packageId: PremiumPackageId): ReturnType<
    typeof import('../premium').getPremiumSubscriptionStatus
  >;
  getProfilePremiumAccessStatus(now?: number): ReturnType<
    typeof import('../premium').getProfilePremiumAccessStatus
  >;
  userHasProfilePremium(userId?: string): boolean;
  hasProfilePremium(): boolean;
  purchasePremiumPackage(packageId: PremiumPackageId): {
    ok: boolean;
    reason?: string;
    extended?: boolean;
    expiresAt?: number;
    tierId?: ProfilePremiumTierId;
  };
  recordProfileVisit(profileUserId: string, context?: ProfileVisitContext): boolean;
  getProfileVisitorStats(profileUserId: string): ProfileVisitorStats;
  getProfileVisitorCount(profileUserId: string): number;
  getProfileVisitors(profileUserId: string): ProfileVisitorRow[];
  getProfileVisitorAudienceSummary(profileUserId: string): {
    followingYou: number;
    youFollowThem: number;
    mutual: number;
    verified: number;
    notFollowingYou: number;
    total: number;
  };
  getCreatorProgress(profileUserId: string): CreatorProgress;
  removeProfileVisitor(profileUserId: string, visitorUserId: string): boolean;
  enforcePremiumExpiryForCurrentUser(): void;
  scrubViewerTracesFromAllProfiles(viewerUserId: string): void;
  ensureDemoProfileVisitors(): void;
  backfillProfileVisitorSurfaces(): void;
  purgeHiddenProfileVisitEntries(): void;
}

export interface WorkspaceTasksLayer {
  readonly tasks: WorkspaceTask[];
  addTask(task: WorkspaceTask): void;
  updateTask(id: number, updateFn: (task: WorkspaceTask) => WorkspaceTask): void;
  deleteTask(id: number): void;
  readonly auditLogs: WorkspaceAuditLog[];
  addAuditLog(log: Partial<WorkspaceAuditLog> & { notifyTeam?: boolean }): void;
}

export interface ReelsLayer {
  readonly reels: Reel[];
  addReel(reel: Partial<Reel> & { user?: User }): void;
  updateReel(id: string, updateFn: (reel: Reel) => Reel): void;
  deleteReel(id: string): void;
}

export interface NotificationsLayer {
  getNotificationsForUser(ownerUserId: string): AppNotification[];
  readonly notifications: AppNotification[];
  getUnreadNotificationCount(ownerUserId?: string): number;
  pushNotificationForUser(
    ownerUserId: string,
    payload: Omit<AppNotification, 'id' | 'createdAt' | 'read' | 'user'> & {
      type: AppNotificationType;
    }
  ): AppNotification | null;
  addNotification(
    notification: Partial<AppNotification> & { type: AppNotificationType }
  ): AppNotification | null;
  removeNotificationMatches(
    ownerUserId: string,
    match: { type?: AppNotificationType; actorUserId?: string; postId?: string }
  ): void;
  markNotificationRead(notificationId: string, ownerUserId?: string): void;
  markAllNotificationsRead(ownerUserId?: string): void;
  removeNotification(notificationId: string, ownerUserId?: string): void;
  notifyLiveStarted(hostUserId: string, liveKind?: LiveKind): void;
  notifyLiveJoined(hostId: string, visitorId: string, liveKind?: LiveKind): void;
  resolveTaskAssigneeUserId(task: { user?: unknown }): string | null;
  notifyWorkspaceTeam(
    payload: Omit<AppNotification, 'id' | 'createdAt' | 'read' | 'user'> & {
      type: AppNotificationType;
    },
    excludeUserId?: string | null
  ): void;
  getNotificationInboxStore(): Record<string, AppNotification[]>;
  saveNotificationInboxStore(store: Record<string, AppNotification[]>): void;
  syncUserRefsInNotificationInboxes(userId: string, fresh: User): void;
  migrateLegacyNotificationsInbox(): void;
  compactNotificationInboxForCurrentUser(): void;
  ensureDemoNotifications(): void;
}

export interface WorkspaceFilesLayer {
  readonly files: WorkspaceFile[];
  addFile(file: WorkspaceFile): void;
  deleteFile(id: string): void;
}

export interface MessagesLayer {
  readonly messages: import('../dbTypes').MessagesByChatStore;
  readonly chatPresence: ChatPresenceStore;
  readonly chatReadState: ChatTimestampStore;
  readonly chatPeerReadState: ChatTimestampStore;
  getUserPresence(userId: string): {
    online: boolean;
    typing: boolean;
    lastSeenAt: number;
    lastActiveAt: number;
    activeChatId: string | null;
  };
  setUserPresence(
    userId: string,
    patch: {
      online?: boolean;
      typing?: boolean;
      lastSeenAt?: number;
      lastActiveAt?: number;
      activeChatId?: string | null;
    }
  ): void;
  setChatPresenceMap(nextPresence: ChatPresenceStore): void;
  setUserTyping(userId: string, typing: boolean): void;
  setUserOnline(userId: string, online: boolean, at?: number): void;
  touchUserActive(userId: string, at?: number): void;
  getChatReadAt(chatId: string): number;
  setChatReadAt(chatId: string, timestamp: number, options?: { allowDecrease?: boolean }): void;
  getChatPeerReadAt(chatId: string): number;
  setChatPeerReadAt(chatId: string, timestamp: number): void;
  readonly chatWallpapers: Record<string, { selectedId?: string; customWallpapers?: unknown[] }>;
  getChatWallpaper(chatId: string): { selectedId: string; customWallpapers: ChatWallpaperItem[] };
  setChatWallpaper(
    chatId: string,
    payload: { selectedId: string; customWallpapers: ChatWallpaperItem[] }
  ): void;
  addMessage(chatId: string, message: ChatMessage): void;
  toggleMessageReaction(chatId: string, messageIndex: number, emoji: string): void;
  updateMessage(
    chatId: string,
    messageIndex: number,
    updater: (message: ChatMessage) => ChatMessage
  ): void;
  deleteMessage(chatId: string, messageIndex: number): void;
  ensureDemoMessagesIfEmpty(): void;
}

export type StoryViewScope = 'feed' | 'profile';

export type StoryViewEntry = {
  feed?: boolean;
  profile?: boolean;
  profileDays?: Record<string, boolean>;
};

export interface StoriesLayer {
  readonly stories: StoriesByUserStore;
  readonly profileStories: StoriesByUserStore;
  applyDemoStoryStrip(options?: { resetViews?: boolean }): Promise<{
    storyUsers: number;
    storyOnlyUsers: string[];
    liveUsers: string[];
    liveKinds: string[];
  }>;
  addStorySegment(userId: string, segment: StoryDraftMedia): void;
  getFeedStorySegments(userId: string): StoryDraftMedia[];
  getProfileStorySegments(userId: string): StoryDraftMedia[];
  getFeedStoriesStore(): StoriesByUserStore;
  readonly storyViews: Record<string, boolean | StoryViewEntry>;
  hasViewedStory(userId: string, scope?: StoryViewScope): boolean;
  hasViewedProfileDay(userId: string, dayKey: string): boolean;
  markStoryViewed(userId: string, scope?: StoryViewScope): void;
  markProfileDayViewed(userId: string, dayKey: string): void;
  seedDemoStoriesIfNeeded(): Promise<void>;
}

export interface SettingsLayer {
  readonly settings: AppSettings;
  updateSettings(update: Partial<AppSettings>): void;
}

export interface CloudLayer {
  readonly cloudMeta: {
    syncedCollections: number;
    syncedItems: number;
    syncedSize: number;
    status: 'idle' | 'syncing' | 'success';
  };
  syncToCloud(isAuto?: boolean): CloudSyncResult;
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
  }): { ok: boolean; reason?: string; cloudConnection?: object };
  updateCloudConnection(
    connectionId: string,
    patch: { storageName?: string; dataTypes?: CloudDataType[] }
  ): { ok: boolean };
  disconnectCloudProvider(connectionId?: string): { ok: boolean };
  getActiveCloudConnection(settings?: AppSettings): CloudConnection | null;
}

export interface UiFlagsLayer {
  readonly globalMuted: boolean;
  setGlobalMuted(muted: boolean): void;
  readonly isFullScreenActive: boolean;
  setFullScreenActive(active: boolean): void;
  readonly isCreatorEditingActive: boolean;
  setCreatorEditingActive(active: boolean): void;
  readonly unreadMessagesCount: number;
  setUnreadMessagesCount(count: number): void;
  readonly hasUnreadNotifications: boolean;
  setHasUnreadNotifications(has: boolean): void;
  migrateGlobalMuteDefault(): void;
}

export interface CommentsLayer {
  readonly reelComments: CommentThreadStore;
  addReelComment(reelId: string, comment: CommentLike): void;
  addReelCommentReply(reelId: string, commentId: string, reply: CommentLike): void;
  likeReelComment(reelId: string, commentId: string, userId: string): void;
  toggleReelCommentLike(reelId: string, commentId: string, userId: string): void;
  readonly postComments: CommentThreadStore;
  addPostComment(postId: string, comment: CommentLike): void;
  likePostComment(postId: string, commentId: string, userId: string): void;
  togglePostCommentLike(postId: string, commentId: string, userId: string): void;
  addPostCommentReply(postId: string, commentId: string, reply: CommentLike): void;
  getUserStorySegments(userId: string, scope?: StoryViewScope): StoryDraftMedia[];
}

export interface DatingLayer {
  readonly datingState: {
    likedUserIds: string[];
    passedUserIds: string[];
    matchedUserIds: string[];
    unmatchedUserIds: string[];
    preferences: {
      minAge: number;
      maxAge: number;
      maxDistanceKm: number;
      intents: string[];
    };
    usage: {
      dayKey: string;
      superLikesUsed: number;
    };
    subscription: {
      tier: 'free' | 'plus' | 'gold';
    };
    profile: {
      prompts: Array<{ question: string; answer: string }>;
      mediaUrls: string[];
      verified: boolean;
    };
    reports: Array<{ userId: string; reason: string; createdAt: number }>;
    matchMeta: Record<
      string,
      {
        matchedAt: number;
        lastActivityAt: number;
        expiresAt: number;
      }
    >;
    learnedSignals: {
      preferredAvgAge: number | null;
      preferredAvgDistanceKm: number | null;
      likesCount: number;
      passesCount: number;
    };
    rankingTuning: {
      distanceWeight: number;
      affinityWeight: number;
      profileQualityWeight: number;
      completenessWeight: number;
      learningWeight: number;
    };
    experiment: {
      mode: 'auto' | 'A' | 'B' | 'C';
      assignments: Record<string, 'A' | 'B' | 'C'>;
      metrics: Record<
        'A' | 'B' | 'C',
        { exposures: number; likes: number; passes: number; matches: number }
      >;
      events: Array<{
        bucket: 'A' | 'B' | 'C';
        kind: 'exposure' | 'like' | 'pass' | 'match';
        at: number;
      }>;
      stability: {
        cooldownMinutes: number;
        minHoldMinutes: number;
        minExposurePerBucket: number;
        confidenceThreshold: number;
        minDelta: number;
      };
      presetAudit: {
        lastPreset: 'conservative' | 'balanced' | 'aggressive' | null;
        lastAppliedAt: number | null;
        lastAppliedBy: string | null;
      };
    };
  };
  getDatingCandidates(limit?: number): User[];
  getDatingLikesYou(limit?: number): User[];
  getDatingTopPicks(limit?: number): User[];
  setDatingPreferences(patch: {
    minAge?: number;
    maxAge?: number;
    maxDistanceKm?: number;
    intents?: string[];
  }): void;
  likeDatingProfile(userId: string): { ok: boolean; matched: boolean };
  passDatingProfile(userId: string): { ok: boolean };
  undoDatingAction(userId: string): { ok: boolean };
  consumeDatingSuperLike(limit?: number): { ok: boolean; remaining: number };
  unmatchDatingProfile(userId: string): { ok: boolean };
  setDatingSubscriptionTier(tier: 'free' | 'plus' | 'gold'): void;
  updateDatingProfile(payload: {
    prompts?: Array<{ question: string; answer: string }>;
    mediaUrls?: string[];
    verified?: boolean;
  }): void;
  reportDatingProfile(userId: string, reason: string): { ok: boolean };
  canRevealDatingLikesYou(): boolean;
  getDatingConversationStarter(userId: string): string;
  touchDatingMatchActivity(userId: string): void;
  getDatingMatchMeta(userId: string): { matchedAt: number; lastActivityAt: number; expiresAt: number } | null;
  pruneExpiredDatingMatches(): number;
  getDatingReengagementNudges(limit?: number): User[];
  getDatingProfileCompleteness(userId?: string): number;
  setDatingRankingTuning(patch: {
    distanceWeight?: number;
    affinityWeight?: number;
    profileQualityWeight?: number;
    completenessWeight?: number;
    learningWeight?: number;
  }): void;
  markDatingExposure(userId: string): void;
  setDatingExperimentMode(mode: 'auto' | 'A' | 'B' | 'C'): void;
  getDatingExperimentSummary(): Record<
    'A' | 'B' | 'C',
    { exposures: number; likes: number; passes: number; matches: number }
  >;
  getDatingExperimentSummaryForWindow(hours: number): Record<
    'A' | 'B' | 'C',
    { exposures: number; likes: number; passes: number; matches: number }
  >;
  getDatingExperimentAnalytics(hours: number): {
    summary: Record<
      'A' | 'B' | 'C',
      { exposures: number; likes: number; passes: number; matches: number }
    >;
    winner: {
      bucket: 'A' | 'B' | 'C' | null;
      reason: string;
      score: number;
      confidence: number;
      status:
        | 'insufficient_data'
        | 'not_significant'
        | 'significant'
        | 'cooldown_locked'
        | 'hold_locked';
      minExposureRequired: number;
      observedDelta: number;
    };
  };
  getDatingExperimentWinner(hours: number): {
    bucket: 'A' | 'B' | 'C' | null;
    reason: string;
    score: number;
    confidence: number;
    status:
      | 'insufficient_data'
      | 'not_significant'
      | 'significant'
      | 'cooldown_locked'
      | 'hold_locked';
    minExposureRequired: number;
    observedDelta: number;
  };
  setDatingExperimentStability(patch: {
    cooldownMinutes?: number;
    minHoldMinutes?: number;
    minExposurePerBucket?: number;
    confidenceThreshold?: number;
    minDelta?: number;
  }): void;
  applyDatingExperimentPreset(preset: 'conservative' | 'balanced' | 'aggressive'): void;
  getDatingExperimentExport(hours: number): {
    schemaVersion: number;
    generatedAt: number;
    actorUserId: string | null;
    windowHours: number;
    mode: 'auto' | 'A' | 'B' | 'C';
    stability: {
      cooldownMinutes: number;
      minHoldMinutes: number;
      minExposurePerBucket: number;
      confidenceThreshold: number;
      minDelta: number;
    };
    presetAudit: {
      lastPreset: 'conservative' | 'balanced' | 'aggressive' | null;
      lastAppliedAt: number | null;
      lastAppliedBy: string | null;
    };
    summary: Record<'A' | 'B' | 'C', { exposures: number; likes: number; passes: number; matches: number }>;
    winner: {
      bucket: 'A' | 'B' | 'C' | null;
      reason: string;
      score: number;
      confidence: number;
      status:
        | 'insufficient_data'
        | 'not_significant'
        | 'significant'
        | 'cooldown_locked'
        | 'hold_locked';
      minExposureRequired: number;
      observedDelta: number;
    };
    events: Array<{ bucket: 'A' | 'B' | 'C'; kind: 'exposure' | 'like' | 'pass' | 'match'; at: number }>;
  };
  getDatingExperimentEventsCsv(hours: number): string;
  importDatingExperimentExport(
    payload: unknown,
    mode?: 'replace' | 'append'
  ): {
    ok: boolean;
    importedEvents: number;
    message: string;
    schemaVersionUsed: number | null;
    migratedFrom: number | null;
  };
  resetDatingExperimentMetrics(): void;
  getDatingMatches(): User[];
  clearDatingState(): void;
}

export type ComposedDbLayers = AuthLaunchLayer &
  AuthPostsLayer &
  FollowBlockedLayer &
  ProfileLayer &
  WorkspaceTasksLayer &
  ReelsLayer &
  NotificationsLayer &
  WorkspaceFilesLayer &
  MessagesLayer &
  StoriesLayer &
  SettingsLayer &
  CloudLayer &
  UiFlagsLayer &
  CommentsLayer &
  DatingLayer;
