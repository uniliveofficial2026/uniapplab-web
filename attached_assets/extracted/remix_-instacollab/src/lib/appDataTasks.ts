/**
 * Catalog of every user-facing data task and its canonical `db` API.
 * Used by humans and agents — see AGENTS.md for resolve/display rules.
 *
 * Rules for ALL tasks (existing fixes and new features):
 * - Write only through the `db` method below (never duplicate in useState).
 * - Read through `useDB()` plus `resolve*` / hooks in entityResolve.ts & useDB.ts.
 * - Pass entity ids into modals; resolve inside the child.
 */

export type TaskCategory =
  | 'launch'
  | 'post'
  | 'reel'
  | 'user'
  | 'comment'
  | 'story'
  | 'message'
  | 'notification'
  | 'content'
  | 'workspace'
  | 'dating'
  | 'settings'
  | 'ui';

export type AppDataTask = {
  /** What the user does */
  action: string;
  /** Method on `db` from useDB() */
  dbMethod: string;
  /** How to show live state in UI */
  display: string;
  /** Primary screens */
  screens: string[];
};

/** Grouped task catalog — extend when adding features, then update AGENTS.md smoke list. */
export const APP_DATA_TASKS: Record<TaskCategory, AppDataTask[]> = {
  post: [
    { action: 'Like post', dbMethod: 'togglePostLike(postId)', display: 'resolvePost / usePostById', screens: ['Feed', 'Post', 'PostModal', 'Profile', 'Search'] },
    { action: 'Save / unsave post', dbMethod: 'togglePostSave(postId)', display: 'resolvePost', screens: ['Feed', 'Post', 'PostModal', 'Profile saved tab'] },
    { action: 'Archive / unarchive post', dbMethod: 'togglePostArchive(postId)', display: 'resolvePost; hidden from feed/profile when archived', screens: ['Post', 'PostModal', 'PostArchiveModal', 'Profile'] },
    { action: 'Delete post', dbMethod: 'deletePost(postId)', display: 'resolvePost', screens: ['Post', 'PostModal'] },
    { action: 'Report post', dbMethod: 'updatePost(id, fn) → isReported', display: 'resolvePost', screens: ['Post', 'PostModal'] },
    { action: 'Share post (DM)', dbMethod: 'addMessage + link URL', display: 'resolvePost in message preview', screens: ['ShareModal', 'Profile', 'PostModal'] },
  ],
  reel: [
    { action: 'Like reel', dbMethod: 'toggleReelLike(reelId)', display: 'resolveReel', screens: ['Reels'] },
    { action: 'Save reel', dbMethod: 'toggleReelSave(reelId)', display: 'resolveReel', screens: ['Reels'] },
    { action: 'Delete reel', dbMethod: 'deleteReel(reelId)', display: 'resolveReel', screens: ['Reels'] },
    { action: 'Share reel (DM)', dbMethod: 'addMessage + link URL', display: 'resolveReel in message preview', screens: ['Messages'] },
  ],
  launch: [
    { action: 'Splash / onboarding progress', dbMethod: 'markSplashSeen, completeOnboarding', display: 'getLaunchProgress', screens: ['Launch'] },
    { action: 'Log in (local demo)', dbMethod: 'signInWithCredentials(email, password)', display: 'isLoggedIn', screens: ['Launch'] },
    { action: 'Log in (cloud)', dbMethod: 'cloudSignIn → sessionManager.applySupabaseSessionToLocalDb / syncAuthUser', display: 'CloudAuthProvider + useDB', screens: ['Launch'] },
    { action: 'Log in / sign up (Google)', dbMethod: 'cloudSignInWithGoogle → Firebase popup/redirect → syncCloudSessionNow', display: 'CloudAuthProvider', screens: ['Launch'] },
    { action: 'Log in / sign up (Apple)', dbMethod: 'cloudSignInWithApple → Firebase popup/redirect → syncCloudSessionNow', display: 'CloudAuthProvider', screens: ['Launch'] },
    { action: 'Sign up (local demo)', dbMethod: 'signUpWithCredentials(...)', display: 'registerUser + launch progress', screens: ['Launch'] },
    { action: 'Sign up (cloud)', dbMethod: 'cloudSignUp → profiles row + syncAuthUser', display: 'CloudAuthProvider', screens: ['Launch'] },
    { action: 'Forgot / reset password', dbMethod: 'requestPasswordReset / supabaseRequestPasswordReset; resetPasswordWithCode / supabaseUpdatePassword', display: 'launch progress / PASSWORD_RECOVERY', screens: ['Launch'] },
    { action: 'Profile setup', dbMethod: 'updateUser + pushCloudProfile + completeProfileSetup (incl. publicUserId)', display: 'resolveUser; resolvePublicUserId', screens: ['Launch'] },
    { action: 'Set / change public User ID', dbMethod: 'updateUser(publicUserId, publicUserIdChangedAt) + pushCloudProfile; isCloudPublicUserIdAvailable', display: 'resolvePublicUserId; 7-day cooldown in settings', screens: ['Launch', 'Profile settings'] },
    { action: 'Real-time sync (cloud)', dbMethod: 'db.save → scheduleCloudAppStateSync; applyRemoteCollections on realtime', display: 'useDB() on all screens; Supabase Realtime / Firestore listener', screens: ['All tabs when cloud auth configured'] },
    { action: 'Trending gate', dbMethod: 'markTrendingSeen', display: 'hasReachedMainApp', screens: ['Launch'] },
    { action: 'Log out', dbMethod: 'useCloudAuth().signOut → cloudSignOut + logoutSession', display: 'isLoggedIn → auth', screens: ['Profile settings'] },
  ],
  user: [
    { action: 'Follow / unfollow', dbMethod: 'toggleFollow(userId)', display: 'resolveUser / useUserById', screens: ['Feed', 'Post', 'Reels', 'Search', 'Notifications', 'Profile', 'UserProfilePreview', 'FollowListModal'] },
    { action: 'Private account', dbMethod: 'setAccountPrivate(enabled)', display: 'user.isPrivate', screens: ['Profile settings'] },
    { action: 'Approve follow request', dbMethod: 'approveFollowRequest(requesterId)', display: 'follow graph', screens: ['Profile', 'Notifications'] },
    { action: 'Reject follow request', dbMethod: 'rejectFollowRequest(requesterId)', display: 'follow_requests store', screens: ['Profile', 'Notifications'] },
    { action: 'Block / unblock user', dbMethod: 'blockUser(userId) / unblockUser(userId) / getBlockedUsers()', display: 'isUserBlocked; hides posts/reels', screens: ['FollowListModal', 'Messages', 'BlockedUsersModal', 'Profile settings'] },
    { action: 'View followers / following', dbMethod: 'getFollowerIds / getFollowingIds + getUsersByIds', display: 'FollowListModal', screens: ['Profile', 'UserProfilePreview'] },
    { action: 'View profile visitors', dbMethod: 'recordProfileVisit / getProfileVisitors; leave no trace skips recording', display: 'Hidden visits never appear in list', screens: ['Profile', 'ProfileVisitorsModal', 'UserProfilePreview'] },
    { action: 'Purchase Profile Premium', dbMethod: 'purchasePremiumPackage(1m|3m|6m|1y) — stacks on profile_premium expiry', display: 'premiumSubscriptions.expiresAt; hiddenProfileViews', screens: ['Wallet', 'Profile settings'] },
    { action: 'Edit profile', dbMethod: 'updateUser(id, fn)', display: 'findUserById / targetUser; syncs embedded refs; scheduleCloudProfileSync when cloud user', screens: ['Profile'] },
    { action: 'Register user', dbMethod: 'registerUser(user)', display: 'resolveUser', screens: ['Auth flows'] },
    { action: 'Open profile preview', dbMethod: '(read-only) useUserById', display: 'useUserById(userId)', screens: ['App overlay', 'openProfilePreview'] },
  ],
  comment: [
    { action: 'Add post comment', dbMethod: 'addPostComment(postId, buildCommentPayload(...))', display: 'resolveCommentAuthor', screens: ['Post', 'PostModal', 'Profile'] },
    { action: 'Reply to post comment', dbMethod: 'addPostCommentReply(..., buildCommentPayload(...))', display: 'resolveCommentAuthor', screens: ['PostModal'] },
    { action: 'Like post comment', dbMethod: 'likePostComment(postId, commentId, userId)', display: 'resolveCommentAuthor + comment.likes', screens: ['PostModal'] },
    { action: 'Add reel comment', dbMethod: 'addReelComment(reelId, buildCommentPayload(...))', display: 'resolveCommentAuthor', screens: ['Reels'] },
  ],
  story: [
    { action: 'View story', dbMethod: 'markStoryViewed(userId)', display: 'hasViewedStory + StoryRing', screens: ['Feed', 'StoryRing', 'Messages'] },
    { action: 'Add story segment', dbMethod: 'addStorySegment(userId, segment)', display: 'getUserStorySegments', screens: ['StoryRing'] },
  ],
  message: [
    { action: 'Send message', dbMethod: 'addMessage(chatId, payload)', display: 'findUserById for chat user', screens: ['Messages', 'ShareModal', 'PostModal'] },
    { action: 'Send chat file', dbMethod: 'addMessage(chatId, { media: [{ url, name, isFile }] })', display: 'MessageFileCard + download/open in thread', screens: ['Messages'] },
    { action: 'Share location', dbMethod: 'addMessage(chatId, { location })', display: 'MessageLocationCard + in-app OSM map', screens: ['Messages'] },
    { action: 'Edit message', dbMethod: 'updateMessage(chatId, index, fn)', display: 'db.messages', screens: ['Messages'] },
    { action: 'Delete message', dbMethod: 'deleteMessage(chatId, index)', display: 'db.messages', screens: ['Messages'] },
    { action: 'React to message', dbMethod: 'toggleMessageReaction(chatId, index, emoji)', display: 'db.messages', screens: ['Messages'] },
    { action: 'Read receipts / presence', dbMethod: 'setChatReadAt, setChatPeerReadAt, setUserPresence', display: 'db.chatPresence', screens: ['Messages'] },
    { action: 'Typing indicator', dbMethod: 'setUserTyping(userId, typing)', display: 'db.chatPresence + useDB', screens: ['Messages'] },
    { action: 'Chat wallpaper', dbMethod: 'setChatWallpaper(chatId, payload)', display: 'db.chatWallpapers', screens: ['Messages'] },
    { action: 'Open shared post/reel/story link', dbMethod: '(read) resolvePost / resolveReel + resolveUser', display: 'entityResolve', screens: ['Messages'] },
  ],
  notification: [
    { action: 'Push in-app notification', dbMethod: 'pushNotificationForUser(ownerId, payload)', display: 'Per-user inbox; resolveUser on actor', screens: ['Notifications', 'ShareModal', 'db social/workspace hooks'] },
    { action: 'Follow from notification', dbMethod: 'toggleFollow(userId)', display: 'resolveUser', screens: ['Notifications'] },
    { action: 'Task assigned / updated', dbMethod: 'addTask / updateTask / deleteTask → type task', display: 'taskId + targetTab workspace', screens: ['Workspace', 'Notifications'] },
    { action: 'Workspace activity', dbMethod: 'addAuditLog / addFile → type activity', display: 'targetTab workspace', screens: ['Workspace', 'Notifications'] },
    { action: 'Go live / end live', dbMethod: 'setUserLiveStatus(userId, isLive, liveKind)', display: 'Notifies followers when live starts', screens: ['Live', 'Profile', 'Notifications'] },
    { action: 'Join live', dbMethod: 'recordProfileVisit(profileId, { surface: live })', display: 'Notifies host on join', screens: ['StoryRing', 'Avatar', 'UserProfilePreview', 'Notifications'] },
  ],
  content: [
    { action: 'Create post', dbMethod: 'addPost(post)', display: 'resolvePost after create', screens: ['Shell'] },
    { action: 'Create reel', dbMethod: 'addReel(reel)', display: 'resolveReel after create', screens: ['Shell'] },
  ],
  workspace: [
    { action: 'Add / update / delete task', dbMethod: 'addTask, updateTask, deleteTask', display: 'db.tasks', screens: ['Workspace'] },
    { action: 'Add / delete file', dbMethod: 'addFile, deleteFile', display: 'db.files', screens: ['Workspace'] },
    { action: 'Audit log entry', dbMethod: 'addAuditLog(log)', display: 'db.auditLogs', screens: ['Workspace'] },
  ],
  dating: [
    { action: 'Like dating profile', dbMethod: 'likeDatingProfile(userId)', display: 'datingState.matchedUserIds + getDatingMatches', screens: ['Dating'] },
    { action: 'Pass dating profile', dbMethod: 'passDatingProfile(userId)', display: 'datingState.passedUserIds + getDatingCandidates', screens: ['Dating'] },
    { action: 'Undo last dating action', dbMethod: 'undoDatingAction(userId)', display: 'datingState + getDatingCandidates', screens: ['Dating'] },
    { action: 'View likes you', dbMethod: 'getDatingLikesYou()', display: 'resolved users from likes queue', screens: ['Dating'] },
    { action: 'View top picks', dbMethod: 'getDatingTopPicks()', display: 'ranked candidates', screens: ['Dating'] },
    { action: 'Set dating preferences', dbMethod: 'setDatingPreferences({ minAge, maxAge, maxDistanceKm, intents })', display: 'datingState.preferences + candidate deck', screens: ['Dating'] },
    { action: 'Set dating subscription tier', dbMethod: 'setDatingSubscriptionTier(free|plus|gold)', display: 'datingState.subscription + tier gates', screens: ['Dating'] },
    { action: 'Edit dating profile', dbMethod: 'updateDatingProfile({ prompts, mediaUrls, verified })', display: 'datingState.profile', screens: ['Dating'] },
    { action: 'Use super like', dbMethod: 'consumeDatingSuperLike(limit) + likeDatingProfile(userId)', display: 'datingState.usage.superLikesUsed', screens: ['Dating'] },
    { action: 'Report dating profile', dbMethod: 'reportDatingProfile(userId, reason)', display: 'datingState.reports + filtered deck', screens: ['Dating'] },
    { action: 'Likes You premium reveal gate', dbMethod: 'canRevealDatingLikesYou()', display: 'tier-gated Likes You reveal', screens: ['Dating'] },
    { action: 'Conversation icebreaker', dbMethod: 'getDatingConversationStarter(userId)', display: 'first message seed in new match chat', screens: ['Dating', 'Messages'] },
    { action: 'Touch match activity', dbMethod: 'touchDatingMatchActivity(userId)', display: 'datingState.matchMeta.lastActivityAt + expiry extension', screens: ['Dating', 'Messages'] },
    { action: 'Prune expired matches', dbMethod: 'pruneExpiredDatingMatches()', display: 'datingState.matchedUserIds + unmatchedUserIds', screens: ['Dating'] },
    { action: 'Re-engagement nudges', dbMethod: 'getDatingReengagementNudges()', display: 'stale matches prompt list', screens: ['Dating'] },
    { action: 'Profile completeness score', dbMethod: 'getDatingProfileCompleteness(userId?)', display: 'completion progress + ranking boost', screens: ['Dating'] },
    { action: 'Adaptive preference learning', dbMethod: 'likeDatingProfile/passDatingProfile → learnedSignals update', display: 'datingState.learnedSignals', screens: ['Dating'] },
    { action: 'Ranking tuning knobs', dbMethod: 'setDatingRankingTuning(weights)', display: 'datingState.rankingTuning + candidate ordering', screens: ['Dating'] },
    { action: 'Experiment bucket mode', dbMethod: 'setDatingExperimentMode(auto|A|B|C)', display: 'datingState.experiment.mode', screens: ['Dating'] },
    { action: 'Experiment exposure tracking', dbMethod: 'markDatingExposure(userId)', display: 'datingState.experiment.metrics.*.exposures', screens: ['Dating'] },
    { action: 'Experiment performance summary', dbMethod: 'getDatingExperimentSummary()', display: 'bucket-level likes/passes/matches/ctr', screens: ['Dating'] },
    { action: 'Experiment window analytics', dbMethod: 'getDatingExperimentSummaryForWindow(hours)', display: 'time-window bucket conversion metrics', screens: ['Dating'] },
    { action: 'Experiment winner recommendation', dbMethod: 'getDatingExperimentWinner(hours)', display: 'suggested best-performing bucket + score + confidence/status', screens: ['Dating'] },
    { action: 'Experiment confidence guardrails', dbMethod: 'getDatingExperimentWinner(hours) significance checks', display: 'min-sample + confidence + uplift gating', screens: ['Dating'] },
    { action: 'Sequential test stability locks', dbMethod: 'getDatingExperimentWinner(hours) cooldown/hold evaluation', display: 'cooldown_locked + hold_locked statuses', screens: ['Dating'] },
    { action: 'Operator guardrail tuning', dbMethod: 'setDatingExperimentStability({ cooldown, hold, exposure, confidence, delta })', display: 'datingState.experiment.stability + winner status behavior', screens: ['Dating'] },
    { action: 'Guardrail preset profiles', dbMethod: 'applyDatingExperimentPreset(conservative|balanced|aggressive)', display: 'one-click operator policy profiles', screens: ['Dating'] },
    { action: 'Preset audit trail', dbMethod: 'applyDatingExperimentPreset(...) → presetAudit', display: 'lastPreset + lastAppliedAt + lastAppliedBy', screens: ['Dating'] },
    { action: 'Experiment export payload', dbMethod: 'getDatingExperimentExport(hours)', display: 'json snapshot: summary + winner + events + policy', screens: ['Dating'] },
    { action: 'Experiment CSV export', dbMethod: 'getDatingExperimentEventsCsv(hours)', display: 'csv rows for summary/winner/events', screens: ['Dating'] },
    { action: 'Experiment import replay', dbMethod: 'importDatingExperimentExport(payload, append|replace)', display: 'rebuilds metrics from imported events', screens: ['Dating'] },
    { action: 'Experiment lifecycle reset', dbMethod: 'resetDatingExperimentMetrics()', display: 'clears experiment counters/events baseline', screens: ['Dating'] },
    { action: 'Unmatch profile', dbMethod: 'unmatchDatingProfile(userId)', display: 'datingState.matchedUserIds + getDatingMatches', screens: ['Dating'] },
    { action: 'View match list', dbMethod: 'getDatingMatches()', display: 'resolve users from matched ids', screens: ['Dating'] },
    { action: 'Reset dating deck', dbMethod: 'clearDatingState()', display: 'datingState + getDatingCandidates', screens: ['Dating'] },
  ],
  settings: [
    { action: 'App settings', dbMethod: 'updateSettings(partial)', display: 'db.settings', screens: ['Profile settings'] },
    { action: 'Cloud connection', dbMethod: 'updateCloudConnection(id, patch)', display: 'db.settings.cloudConnections', screens: ['Profile'] },
    { action: 'Storage tier', dbMethod: 'setStorageTier(tier)', display: 'db.settings + user tier', screens: ['Profile'] },
    { action: 'Offline sync flag', dbMethod: 'setOfflineSyncEnabled', display: 'db.settings', screens: ['Profile'] },
  ],
  ui: [
    { action: 'Global mute', dbMethod: 'setGlobalMuted', display: 'db.globalMuted', screens: ['Post', 'Reels', 'StoryRing'] },
    { action: 'Fullscreen video', dbMethod: 'setFullScreenActive', display: 'db.isFullScreenActive', screens: ['Post', 'StoryRing'] },
    { action: 'Clear unread badges', dbMethod: 'setHasUnreadNotifications, setUnreadMessagesCount', display: 'db getters', screens: ['Shell nav'] },
  ],
};

/** Flat list for search/grep */
export const ALL_APP_DATA_TASKS: AppDataTask[] = Object.values(APP_DATA_TASKS).flat();
