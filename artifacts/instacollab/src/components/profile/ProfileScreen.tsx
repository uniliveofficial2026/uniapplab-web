import React, { useMemo, useState } from 'react';
import { useDB, useDbRevision } from '../../lib/useDB';
import { Grid, PlaySquare, Bookmark, UserSquare, Heart, MessageCircle, ArrowLeft, UserX, X, CheckCircle, Users, Mic2, UserPen, Archive, UserPlus, UserCheck, UserMinus, Clock } from 'lucide-react';
import { ShareIcon } from '../common/ShareIcon';
import { ShareModal } from '../feed/ShareModal';
import type { ProfileSharePayload } from '../../lib/profileShare';
import { buildContextualProfileSharePayload } from '../../lib/profileShare';
import { Post } from '../feed/Post';
import { useToast } from '../../lib/ToastContext';
import { useAuth } from '../../lib/AuthContext';
import { useCloudAuth } from '../../contexts/CloudAuthContext';
import { isCloudAuthConfigured } from '../../lib/auth/config';
import { useCurrentUser } from '../../lib/useCurrentUser';
import { getFirestoreDB, handleFirestoreError, OperationType } from '../../lib/firebase';
import { addDoc, collection } from 'firebase/firestore';

import { PostModal } from '../feed/PostModal';
import { ProfileReelModal } from './ProfileReelModal';
import { AccountSwitcherModal } from './AccountSwitcherModal';
import { FollowListModal } from './FollowListModal';
import { CreatorLevelBadge } from './CreatorLevelBadge';
import { CreatorProgressModal } from './CreatorProgressModal';
import { handleAvatarError, handleMediaError, fileToBase64 } from '../../lib/utils';
import { useProfileStats } from '../../lib/useProfileStats';
import { resolveProfileGridPost } from '../../lib/profilePostGrid';
import { ProfileGridThumb } from './ProfileGridThumb';
import {
  formatProfileHandle,
  getProfileMentionLabel,
  getProfileDisplayName,
  shouldShowProfileHandle,
} from '../../lib/profileDisplay';
import { nativeVideoControlGuardProps } from '../../lib/nativeVideoControls';
import { reelUserId } from '../../lib/safe';
import { SavedRoomsList } from '../../smule-rooms/components/SavedRoomsList';
import { StoryStrip } from '../feed/StoryStrip';
import { ProfileEditSettingsModal } from './ProfileEditSettingsModal';
import { BlockedUsersModal } from './BlockedUsersModal';
import { StoryRing } from '../feed/StoryRing';
import { useFollowActionState } from '../../lib/useFollowActionState';
import { followToggleToastMessage, getFollowButtonHoverLabel } from '../../lib/followPrivacy';
import {
  getOptionsMenuItemClass,
  optionsMenuItemPointerHandlers,
  useOptionsMenuHover,
} from '../../lib/optionsMenu';
import { navTapButtonClass } from '../../lib/navTap';
import { openKaraokeProfileSurface } from '../../lib/profileSurface';

export function ProfileScreen({
  userId,
  onBack,
  backLabel,
}: {
  userId?: string;
  onBack?: () => void;
  backLabel?: string;
}) {
  const db = useDB();
  const dbRevision = useDbRevision();
  const { logout: firebaseLogout, switchAccount, deleteAccount, profile: authProfile, setProfile, userAccounts, selectAccount, removeAccount, ensureDeviceAccountsSynced, sendEmailAuthOtp, verifyEmailAuthOtp } = useAuth();
  const { signOut: cloudSignOut, session: cloudSession } = useCloudAuth();
  const currentUser = useCurrentUser();
  const { showToast } = useToast();
  
  const handleLogout = () => {
    if (!window.confirm('Log out of InstaCollab on this device?')) return;
    void (async () => {
      if (isCloudAuthConfigured()) {
        await cloudSignOut();
      } else {
        await firebaseLogout();
      }
      showToast('Logged out');
    })();
  };

  const targetUser = userId ? (db.users.find(u => u.id === userId) || currentUser) : currentUser;
  const isCurrentUser = !!(targetUser && currentUser && targetUser.id === currentUser.id);

  const {
    profileUser,
    userPosts,
    followerCount,
    followingCount,
    creatorProgress,
  } = useProfileStats(targetUser, userId);
  const profileUserId = profileUser.id;
  const profileDisplayName = getProfileDisplayName(profileUser);
  const profileLabel = getProfileMentionLabel(profileUser);
  
  const [activeTab, setActiveTab] = useState<'posts' | 'reels' | 'saved' | 'tagged' | 'rooms'>('posts');
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showBlockedUsers, setShowBlockedUsers] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [selectedReelId, setSelectedReelId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const commentInputRef = React.useRef<HTMLInputElement>(null);
  
  const [localUser, setLocalUser] = useState(profileUser);
  const [showAccountSwitcher, setShowAccountSwitcher] = useState(false);
  const [accountLinking, setAccountLinking] = useState(false);
  const [followListMode, setFollowListMode] = useState<'followers' | 'following' | null>(null);
  const [showCreatorProgress, setShowCreatorProgress] = useState(false);
  const [profileStoryOpen, setProfileStoryOpen] = useState(false);
  const [followHover, setFollowHover] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const { hoveredMenuItem, setHoveredMenuItem } = useOptionsMenuHover(showActionsMenu);

  const followAction = useFollowActionState(isCurrentUser ? undefined : profileUserId);
  const isBlocked = !isCurrentUser && db.isUserBlocked(profileUserId);

  const openKStarProfile = () => {
    openKaraokeProfileSurface({
      userId: profileUserId,
      displayName: profileDisplayName,
      username: profileUser.username,
      isSelf: isCurrentUser,
      returnContext: { surface: 'app', tab: 'profile', useAppBack: true },
    });
  };

  const feedStorySegments = useMemo(
    () => db.getFeedStorySegments(profileUserId),
    [db, dbRevision, profileUserId],
  );
  const hasActiveFeedStories = feedStorySegments.length > 0;
  const hasProfileStories = useMemo(
    () => db.getProfileStorySegments(profileUserId).length > 0,
    [db, dbRevision, profileUserId],
  );
  const headerRingSegmentCount = hasActiveFeedStories
    ? feedStorySegments.length
    : hasProfileStories
      ? db.getProfileStorySegments(profileUserId).length
      : undefined;
  const headerRingViewed = hasActiveFeedStories
    ? db.hasViewedStory(profileUserId, 'feed')
    : db.hasViewedStory(profileUserId, 'profile');

  const handleProfileAvatarClick = () => {
    if (profileUser.status === 'live') {
      window.dispatchEvent(new CustomEvent('navigate', { detail: { tab: 'live' } }));
      return;
    }
    if (hasActiveFeedStories) {
      setProfileStoryOpen(true);
      return;
    }
    if (hasProfileStories) {
      window.dispatchEvent(
        new CustomEvent('profile-open-latest-story-day', {
          detail: { userId: profileUserId },
        }),
      );
      return;
    }
    if (isCurrentUser) {
      fileInputRef.current?.click();
    }
  };

  const profileGridPosts = useMemo(
    () => userPosts.map((raw) => resolveProfileGridPost(raw, db)),
    [userPosts, db],
  );

  const profileReels = useMemo(
    () =>
      (db.reels ?? []).filter((reel) => reelUserId(reel) === profileUserId),
    [db.reels, profileUserId],
  );

  const savedGridPosts = useMemo(
    () =>
      (db.posts ?? [])
        .filter((p) => p.isSaved)
        .map((raw) => resolveProfileGridPost(raw, db)),
    [db.posts, db],
  );

  React.useEffect(() => {
    setLocalUser((prev) => {
      if (
        prev.id === profileUser.id &&
        prev.username === profileUser.username &&
        prev.displayName === profileUser.displayName &&
        prev.avatarUrl === profileUser.avatarUrl &&
        prev.bio === profileUser.bio &&
        prev.isVerified === profileUser.isVerified &&
        prev.followers === profileUser.followers &&
        prev.following === profileUser.following
      ) {
        return prev;
      }
      return profileUser;
    });
  }, [
    profileUser.id,
    profileUser.username,
    profileUser.displayName,
    profileUser.avatarUrl,
    profileUser.bio,
    profileUser.isVerified,
    profileUser.followers,
    profileUser.following,
  ]);

  const handleFollowToggle = () => {
    db.toggleFollow(profileUserId);
    const after = db.getFollowActionState(profileUserId);
    showToast(followToggleToastMessage(after, profileLabel));
    setFollowHover(false);
  };

  const handleBlockUser = () => {
    if (
      !window.confirm(
        `Block @${profileLabel}? Their posts will be hidden and they will be unfollowed.`,
      )
    ) {
      return;
    }
    if (!db.blockUser(profileUserId)) return;
    showToast(`Blocked @${profileLabel}`);
    setShowActionsMenu(false);
    setLocalUser((prev) => ({ ...prev, isFollowing: false }));
  };

  const handleUnblockUser = () => {
    if (!db.unblockUser(profileUserId)) return;
    showToast(`Unblocked @${profileLabel}`);
    setShowActionsMenu(false);
  };

  const handleReportUser = () => {
    showToast('Reported');
    setShowActionsMenu(false);
  };

  const renderProfileActionsMenu = () => (
    <>
      <button
        type="button"
        aria-label="Close menu"
        className="fixed inset-0 z-[120] cursor-default"
        data-app-overlay-root
        onClick={() => setShowActionsMenu(false)}
      />
      <div
        role="menu"
        className="absolute right-0 top-full z-[121] mt-1 min-w-[11rem] rounded-xl border border-border bg-background p-1.5 shadow-xl"
      >
        {isBlocked ? (
          <button
            type="button"
            role="menuitem"
            className={getOptionsMenuItemClass(
              'unblock-user',
              'default',
              hoveredMenuItem,
              'surface',
            )}
            {...optionsMenuItemPointerHandlers('unblock-user', setHoveredMenuItem)}
            onClick={handleUnblockUser}
          >
            Unblock @{profileLabel}
          </button>
        ) : (
          <button
            type="button"
            role="menuitem"
            className={getOptionsMenuItemClass(
              'block-user',
              'danger',
              hoveredMenuItem,
              'surface',
            )}
            {...optionsMenuItemPointerHandlers('block-user', setHoveredMenuItem)}
            onClick={handleBlockUser}
          >
            Block @{profileLabel}
          </button>
        )}
        <button
          type="button"
          role="menuitem"
          className={getOptionsMenuItemClass(
            'report-user',
            'danger',
            hoveredMenuItem,
            'surface',
          )}
          {...optionsMenuItemPointerHandlers('report-user', setHoveredMenuItem)}
          onClick={handleReportUser}
        >
          Report...
        </button>
      </div>
    </>
  );

  const updateUserProfile = async (fieldUpdates: any) => {
    const updatedUser = { ...localUser, ...fieldUpdates, updatedAt: new Date().toISOString() };
    setLocalUser(updatedUser);
    
    // 1. Update local DB
    db.updateUser(localUser.id, () => updatedUser);
    
    // 2. Update AuthContext profile state (only if it matches logged-in user)
    if (isCurrentUser) {
      setProfile(updatedUser);
      // 3. Save to localStorage backup
      try {
        localStorage.setItem('local_profile_' + localUser.id, JSON.stringify(updatedUser));
      } catch (e) {
        console.warn("Storage quota exceeded or error occurred while updating profile in localStorage:", e);
      }
    }
    
    // 4. Update Firestore in the background
    try {
      const dbInstance = getFirestoreDB();
      if (dbInstance) {
        const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
        await setDoc(doc(dbInstance, 'users', localUser.id), {
          ...updatedUser,
          updatedAt: serverTimestamp()
        }, { merge: true });
      }
    } catch (error) {
      console.warn("Background Firestore profile sync failed:", error);
    }
  };
  
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const newAvatarUrl = await fileToBase64(file);
        await updateUserProfile({ avatarUrl: newAvatarUrl });
        showToast('Avatar updated successfully!');
      } catch (err) {
        showToast('Error updating avatar');
      }
    }
  };

  const [profileShareModal, setProfileShareModal] = useState<ProfileSharePayload | null>(null);
  const [showNewCollectionModal, setShowNewCollectionModal] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [collections, setCollections] = useState(['Design Inspo', 'Moodboard']);

  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [verificationReason, setVerificationReason] = useState('');
  const [isSubmittingVerification, setIsSubmittingVerification] = useState(false);

  const handleRequestVerification = async () => {
    if (!verificationReason.trim()) return;
    const firestoreDB = getFirestoreDB();
    if (!firestoreDB) {
      showToast('Firebase is not configured');
      return;
    }
    
    setIsSubmittingVerification(true);
    const requestsRef = collection(firestoreDB, 'verification_requests');
    try {
      await addDoc(requestsRef, {
        userId: currentUser?.id || localUser.id,
        status: 'pending',
        reason: verificationReason,
        createdAt: new Date().toISOString()
      });
      setShowVerificationModal(false);
      setVerificationReason('');
      showToast('Verification request submitted successfully!');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'verification_requests');
      showToast('Failed to submit verification request.');
    } finally {
      setIsSubmittingVerification(false);
    }
  };

  const handleCreateCollection = () => {
      if (!newCollectionName.trim()) return;
      setCollections(prev => [...prev, newCollectionName]);
      setNewCollectionName('');
      setShowNewCollectionModal(false);
      showToast('Collection created!');
  };

  const openProfileShareModal = () => {
    setProfileShareModal(
      buildContextualProfileSharePayload({
        user: profileUser,
        isSelf: isCurrentUser,
      }),
    );
  };

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !selectedPostId) return;
    db.addPostComment(selectedPostId, {
      username: currentUser.username, 
      text: commentText, 
      avatarUrl: currentUser.avatarUrl
    });
    setCommentText('');
  };

  return (
    <div className="w-full max-w-[935px] mx-auto pt-8 px-4 flex flex-col min-h-0 pb-6">
      
      {/* Post Modal View */}
      {showNewCollectionModal && (
        <div className="fixed inset-0 bg-background z-[200] flex items-center justify-center p-4" data-app-overlay-root>
          <div className="absolute inset-0" onClick={() => setShowNewCollectionModal(false)}></div>
          <div className="bg-card border border-border w-full max-w-sm rounded-[24px] shadow-xl p-6 relative">
            <button onClick={() => setShowNewCollectionModal(false)} className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground"><X className="w-5 h-5"/></button>
            <h3 className="font-bold text-lg mb-4">New Collection</h3>
            <div className="mb-4">
               <input 
                 autoFocus
                 type="text" 
                 value={newCollectionName}
                 onChange={e => setNewCollectionName(e.target.value)}
                 className="w-full bg-secondary outline-none px-4 py-3 rounded-xl text-sm font-medium" 
                 placeholder="Collection Name" 
               />
            </div>
            <button 
              onClick={handleCreateCollection} 
              disabled={!newCollectionName.trim()}
              className="w-full bg-primary text-primary-foreground font-bold py-3 rounded-xl hover:bg-primary/90 disabled:opacity-50"
            >
              Create
            </button>
          </div>
        </div>
      )}

      {selectedPostId && (
        <PostModal postId={selectedPostId} onClose={() => setSelectedPostId(null)} />
      )}

      {/* Edit Profile Modal */}
      {showArchive && (
        <div id="archive-modal" className="fixed inset-0 z-[200] flex items-center justify-center bg-background">
          <div className="absolute inset-0" onClick={() => setShowArchive(false)}></div>
          <div className="bg-card w-full max-w-2xl rounded-3xl border border-border shadow-2xl p-6 flex flex-col max-h-[90vh] overflow-y-auto no-scrollbar relative z-10">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Post Archive</h2>
              <button onClick={() => setShowArchive(false)} className="text-muted-foreground hover:text-foreground"><X className="w-6 h-6" /></button>
            </div>
            
            <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
              <div className="w-20 h-20 rounded-full border-2 border-muted flex items-center justify-center mb-6 text-muted-foreground">
                <Bookmark className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-black mb-2 opacity-80">No archived posts</h3>
              <p className="text-muted-foreground font-medium max-w-sm leading-relaxed text-sm">When you archive posts, they will appear here. Only you can see them.</p>
            </div>
          </div>
        </div>
      )}

      {showVerificationModal && (
        <div id="verification-modal" className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="absolute inset-0" onClick={() => !isSubmittingVerification && setShowVerificationModal(false)}></div>
          <div className="bg-card w-full max-w-sm rounded-[32px] border border-border shadow-2xl p-8 relative z-10 flex flex-col">
            <div className="flex justify-center mb-6">
               <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
                  <CheckCircle className="w-8 h-8" />
               </div>
            </div>
            <h2 className="text-2xl font-black text-center mb-2">Request Verification</h2>
            <p className="text-center text-muted-foreground text-sm font-medium mb-6">
              Verified badges confirm that an account is the authentic presence of the public figure, celebrity, or global brand it represents.
            </p>
            <div className="space-y-4 mb-6">
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">Reason for verification</label>
                <textarea 
                  value={verificationReason} 
                  onChange={e => setVerificationReason(e.target.value)} 
                  disabled={isSubmittingVerification}
                  placeholder="Explain why your account should be verified..."
                  className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary h-24 resize-none" 
                />
              </div>
            </div>
            
            <div className="flex flex-col gap-3">
              <button 
                onClick={handleRequestVerification}
                disabled={isSubmittingVerification || !verificationReason.trim()}
                className="w-full py-3.5 bg-blue-500 text-white font-bold rounded-xl hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmittingVerification ? 'Submitting...' : 'Submit Request'}
              </button>
              <button 
                onClick={() => !isSubmittingVerification && setShowVerificationModal(false)}
                className="w-full py-3.5 bg-secondary text-foreground font-bold rounded-xl hover:bg-secondary/80 transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditProfile && isCurrentUser && (
        <ProfileEditSettingsModal
          onClose={() => setShowEditProfile(false)}
          onOpenSettings={() => setShowEditProfile(true)}
          targetUser={targetUser}
          isCurrentUser={isCurrentUser}
          localUser={localUser}
          setLocalUser={setLocalUser}
          fileInputRef={fileInputRef}
          handleAvatarChange={handleAvatarChange}
          onOpenBlockedUsers={() => {
            setShowEditProfile(false);
            setShowBlockedUsers(true);
          }}
          onOpenAccountSwitcher={() => {
            void ensureDeviceAccountsSynced().then(() => setShowAccountSwitcher(true));
          }}
          onRequestVerification={() => setShowVerificationModal(true)}
          onDeleteAccount={deleteAccount}
          onLogout={handleLogout}
        />
      )}

      {showBlockedUsers && (
        <BlockedUsersModal onClose={() => setShowBlockedUsers(false)} />
      )}

      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className={`${navTapButtonClass} flex items-center gap-2 text-muted-foreground hover:text-foreground font-semibold text-sm mb-4 -mt-1 min-h-[44px] px-1 w-fit`}
          aria-label={backLabel ? `Back to ${backLabel}` : 'Back'}
        >
          <ArrowLeft className="w-4 h-4 shrink-0" />
          {backLabel ? `Back to ${backLabel}` : 'Back'}
        </button>
      )}

      {/* Profile Header */}
      <div className="flex flex-col md:flex-row mb-12 gap-8 md:gap-24 items-center md:items-start max-w-[800px] w-full mx-auto">
        <div className="relative shrink-0 group">
          <StoryRing
            story={{
              id: `profile-story-${profileUserId}`,
              user: profileUser,
              hasViewed: headerRingViewed,
            }}
            isCurrentUser={isCurrentUser}
            isOpen={profileStoryOpen}
            hideRing={!headerRingSegmentCount && profileUser.status !== 'live'}
            presentation="header"
            ringSize="profile"
            storyScope="feed"
            ringSegmentCount={headerRingSegmentCount}
            ringViewed={headerRingViewed}
            onRingClick={isCurrentUser ? undefined : handleProfileAvatarClick}
            onClose={() => setProfileStoryOpen(false)}
          />
          {isCurrentUser && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-[10px] font-bold text-white opacity-0 transition-opacity group-hover:opacity-100">
              UPDATE
            </div>
          )}
        </div>
        
        <div className="flex flex-col items-center md:items-start text-center md:text-left flex-1">
          
          <div className="flex flex-col md:flex-row items-center gap-4 mb-5">
            <h1 className="text-[20px] font-normal">{profileDisplayName}</h1>
            <div className="flex items-center gap-2">
              {isCurrentUser ? (
                <>
                  <button
                    type="button"
                    onClick={() => setShowEditProfile(true)}
                    className="p-2 border border-border rounded-full hover:bg-secondary transition bg-card"
                    aria-label="Edit profile"
                    title="Edit profile"
                  >
                    <UserPen className="w-[18px] h-[18px]" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowArchive(true)}
                    className="p-2 border border-border rounded-full hover:bg-secondary transition bg-card"
                    aria-label="View archive"
                    title="View archive"
                  >
                    <Archive className="w-[18px] h-[18px]" />
                  </button>
                  <button
                    type="button"
                    onClick={openProfileShareModal}
                    className="group p-2 border border-border rounded-full hover:bg-secondary transition bg-card"
                    aria-label="Share profile"
                    title="Share profile"
                  >
                    <ShareIcon size="sm" />
                  </button>
                  <button
                    type="button"
                    onClick={openKStarProfile}
                    className="p-2 border border-border rounded-full hover:bg-secondary transition bg-card"
                    aria-label="Open K-Star"
                    title="K-Star"
                  >
                    <Mic2 className="w-[18px] h-[18px]" />
                  </button>
                </>
              ) : (
                <>
                  {!isBlocked ? (
                    <button
                      type="button"
                      onClick={handleFollowToggle}
                      onMouseEnter={() => setFollowHover(true)}
                      onMouseLeave={() => setFollowHover(false)}
                      aria-pressed={!!followAction?.isFollowing}
                      aria-label={
                        followAction
                          ? getFollowButtonHoverLabel(followAction, followHover)
                          : 'Follow'
                      }
                      title={
                        followAction
                          ? getFollowButtonHoverLabel(followAction, followHover)
                          : 'Follow'
                      }
                      className={`p-2 rounded-full border transition ${
                        followAction?.isFollowing
                          ? followHover
                            ? 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/40'
                            : 'bg-card hover:bg-secondary border-border'
                          : followAction?.isRequested
                            ? 'bg-card hover:bg-secondary border-border'
                            : 'bg-primary text-primary-foreground border-transparent hover:bg-primary/95'
                      }`}
                    >
                      {followAction?.isFollowing ? (
                        followHover ? (
                          <UserMinus className="w-[18px] h-[18px]" />
                        ) : (
                          <UserCheck className="w-[18px] h-[18px]" />
                        )
                      ) : followAction?.isRequested ? (
                        followHover ? (
                          <X className="w-[18px] h-[18px]" />
                        ) : (
                          <Clock className="w-[18px] h-[18px]" />
                        )
                      ) : (
                        <UserPlus className="w-[18px] h-[18px]" />
                      )}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleUnblockUser}
                      className="p-2 border border-border rounded-full hover:bg-secondary transition bg-card"
                      aria-label={`Unblock ${profileLabel}`}
                      title={`Unblock @${profileLabel}`}
                    >
                      <UserCheck className="w-[18px] h-[18px]" />
                    </button>
                  )}
                  {!isBlocked ? (
                    <button
                      type="button"
                      onClick={() => {
                        window.dispatchEvent(
                          new CustomEvent('navigate', {
                            detail: { tab: 'messages', chatId: profileUserId },
                          }),
                        );
                      }}
                      className="p-2 border border-border rounded-full hover:bg-secondary transition bg-card"
                      aria-label={`Message ${profileLabel}`}
                      title="Message"
                    >
                      <MessageCircle className="w-[18px] h-[18px]" />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={openKStarProfile}
                    className="p-2 border border-border rounded-full hover:bg-secondary transition bg-card"
                    aria-label="Open K-Star"
                    title="K-Star"
                  >
                    <Mic2 className="w-[18px] h-[18px]" />
                  </button>
                  <button
                    type="button"
                    onClick={openProfileShareModal}
                    className="group p-2 border border-border rounded-full hover:bg-secondary transition bg-card"
                    aria-label="Share profile"
                    title="Share profile"
                  >
                    <ShareIcon size="sm" />
                  </button>
                  <div className="relative">
                    <button
                      type="button"
                      aria-label={`Block or report ${profileLabel}`}
                      title="Block or report"
                      aria-expanded={showActionsMenu}
                      onClick={() => setShowActionsMenu((open) => !open)}
                      className="p-2 border border-border rounded-full hover:bg-secondary transition bg-card"
                    >
                      <UserX className="w-[18px] h-[18px]" />
                    </button>
                    {showActionsMenu ? renderProfileActionsMenu() : null}
                  </div>
                </>
              )}
            </div>
          </div>

          {isBlocked ? (
            <div className="mb-4 w-full rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-center text-sm font-semibold text-red-600 dark:text-red-400">
              You blocked @{profileLabel}
            </div>
          ) : null}

          <div className="flex items-center justify-center md:justify-start gap-8 mb-4">
            <div>
              <span className="font-bold">{userPosts.length.toLocaleString()}</span> posts
            </div>
            <button
              type="button"
              onClick={() => setFollowListMode('followers')}
              className="cursor-pointer hover:opacity-70 text-left"
            >
              <span className="font-bold">{followerCount.toLocaleString()}</span> followers
            </button>
            <button
              type="button"
              onClick={() => setFollowListMode('following')}
              className="cursor-pointer hover:opacity-70 text-left"
            >
              <span className="font-bold">{followingCount.toLocaleString()}</span> following
            </button>
          </div>

          <CreatorLevelBadge
            progress={creatorProgress}
            shell="pill"
            compact
            showProgressBar={false}
            className="mb-4 items-center md:items-start"
            onClick={() => setShowCreatorProgress(true)}
          />

          <div className="flex flex-col mb-4 items-center md:items-start">
            {shouldShowProfileHandle(profileUser) ? (
              <span className="text-[14px] text-muted-foreground">{formatProfileHandle(profileUser)}</span>
            ) : null}
            <span className="text-[14px] whitespace-pre-wrap mt-1 leading-relaxed">{profileUser.bio}</span>
          </div>

        </div>
      </div>

      {!isBlocked ? (
      <StoryStrip
        mode="profile"
        compact
        className="story-strip--profile mb-4 max-w-[800px] w-full mx-auto !border-b-0"
        showAddStory={isCurrentUser}
        onlyUserId={profileUserId}
      />
      ) : null}

      {isBlocked && !isCurrentUser ? (
        <div className="py-20 text-center text-muted-foreground font-medium max-w-md mx-auto">
          Unblock @{profileLabel} to view their posts and reels.
        </div>
      ) : (
      <>
      {/* Tabs */}
      <div className="border-t border-border flex justify-center gap-12 text-[12px] font-bold text-muted-foreground uppercase tracking-widest h-[52px]">
         <div onClick={() => setActiveTab('posts')} className={`flex items-center gap-2 h-full cursor-pointer transition-colors ${activeTab === 'posts' ? 'border-t-2 border-foreground text-foreground' : 'hover:text-foreground'}`}>
             <Grid className="w-4 h-4" /> POSTS
         </div>
         <div onClick={() => setActiveTab('reels')} className={`flex items-center gap-2 h-full cursor-pointer transition-colors hidden sm:flex ${activeTab === 'reels' ? 'border-t-2 border-foreground text-foreground' : 'hover:text-foreground'}`}>
             <PlaySquare className="w-4 h-4" /> REELS
         </div>
         {isCurrentUser && (
           <div onClick={() => setActiveTab('rooms')} className={`flex items-center gap-2 h-full cursor-pointer transition-colors hidden sm:flex ${activeTab === 'rooms' ? 'border-t-2 border-foreground text-foreground' : 'hover:text-foreground'}`}>
               <Users className="w-4 h-4" /> ROOMS
           </div>
         )}
         {isCurrentUser && (
           <div onClick={() => setActiveTab('saved')} className={`flex items-center gap-2 h-full cursor-pointer transition-colors hidden sm:flex ${activeTab === 'saved' ? 'border-t-2 border-foreground text-foreground' : 'hover:text-foreground'}`}>
               <Bookmark className="w-4 h-4" /> SAVED
           </div>
         )}
         <div onClick={() => setActiveTab('tagged')} className={`flex items-center gap-2 h-full cursor-pointer transition-colors hidden sm:flex ${activeTab === 'tagged' ? 'border-t-2 border-foreground text-foreground' : 'hover:text-foreground'}`}>
             <UserSquare className="w-4 h-4" /> TAGGED
         </div>
      </div>

      {/* Grid */}
      {activeTab === 'posts' && (
        <div className="grid grid-cols-3 gap-1 md:gap-4 lg:gap-8">
          {profileGridPosts.map((gridPost) => (
            <div key={gridPost.id} onClick={() => setSelectedPostId(gridPost.id)} className="aspect-square bg-secondary group cursor-pointer relative rounded-xl overflow-hidden shadow-sm">
              <ProfileGridThumb
                thumbUrl={gridPost.thumbUrl}
                isVideo={gridPost.isVideo}
                className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-500"
              />
              {gridPost.isVideo && (
                <div className="absolute top-2 right-2 text-white drop-shadow-md">
                  <PlaySquare className="w-5 h-5 fill-white" />
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white gap-4 backdrop-blur-[2px]">
                <div className="flex items-center gap-1 font-bold"><Heart className="w-5 h-5 fill-white" /> {gridPost.likes.toLocaleString()}</div>
                <div className="flex items-center gap-1 font-bold"><MessageCircle className="w-5 h-5 fill-white" /> {gridPost.comments.toLocaleString()}</div>
              </div>
            </div>
          ))}
          {profileGridPosts.length === 0 && (
            <div className="col-span-3 py-20 text-center text-muted-foreground font-medium">No posts yet</div>
          )}
        </div>
      )}

      {activeTab === 'rooms' && isCurrentUser && (
        <div className="pt-6 px-4">
          <p className="text-muted-foreground mb-4 font-medium text-sm text-center sm:text-left">
            Your saved party rooms — only you can see this list.
          </p>
          <div className="grid grid-cols-1 gap-3 max-w-2xl mx-auto sm:mx-0">
            <SavedRoomsList
              variant="profile"
              onOpenRoom={(roomId) => {
                window.dispatchEvent(
                  new CustomEvent('navigate', {
                    detail: { tab: 'rooms', roomsPath: `/room/${roomId}` },
                  })
                );
              }}
            />
          </div>
        </div>
      )}

      {activeTab === 'saved' && (
        <div className="pt-8 text-center px-4">
          <p className="text-muted-foreground mb-4 font-medium text-sm">Only you can see what you've saved.</p>
          <div className="grid grid-cols-3 gap-1 md:gap-4 lg:gap-8">
            {savedGridPosts.map((gridPost) => (
              <div key={gridPost.id} onClick={() => setSelectedPostId(gridPost.id)} className="aspect-square bg-secondary group cursor-pointer relative rounded-xl overflow-hidden shadow-sm">
                <ProfileGridThumb
                thumbUrl={gridPost.thumbUrl}
                isVideo={gridPost.isVideo}
                className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-500"
              />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white gap-4 backdrop-blur-[2px]">
                  <div className="flex items-center gap-1 font-bold"><Heart className="w-5 h-5 fill-white" /> {gridPost.likes.toLocaleString()}</div>
                  <div className="flex items-center gap-1 font-bold"><MessageCircle className="w-5 h-5 fill-white" /> {gridPost.comments.toLocaleString()}</div>
                </div>
              </div>
            ))}
            {savedGridPosts.length === 0 && (
              <div className="col-span-3 py-20 text-center text-muted-foreground font-medium">No saved posts yet</div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'reels' && (
        <div className="grid grid-cols-3 gap-1 md:gap-4 lg:gap-8">
          {profileReels.map((reel) => (
            <div
              key={reel.id}
              onClick={() => setSelectedReelId(reel.id)}
              className="aspect-[9/16] bg-secondary group cursor-pointer relative rounded-xl overflow-hidden shadow-sm"
            >
              {reel.videoUrl ? (
                <video
                  src={reel.videoUrl}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-500"
                  muted
                  playsInline
                  controls
                  preload="metadata"
                  {...nativeVideoControlGuardProps()}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-zinc-900 text-muted-foreground">
                  <PlaySquare className="w-10 h-10" />
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white gap-4 backdrop-blur-[2px]">
                <div className="flex items-center gap-1 font-bold">
                  <Heart className="w-5 h-5 fill-white" /> {(reel.likes || 0).toLocaleString()}
                </div>
                <div className="flex items-center gap-1 font-bold">
                  <MessageCircle className="w-5 h-5 fill-white" /> {(reel.comments || 0).toLocaleString()}
                </div>
              </div>
            </div>
          ))}
          {profileReels.length === 0 && (
            <div className="col-span-3 py-20 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 rounded-full border-2 border-muted flex items-center justify-center mb-6 text-muted-foreground">
                <PlaySquare className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-black mb-2 opacity-80">Capture your reels</h2>
              <p className="text-muted-foreground font-medium max-w-xs leading-relaxed">
                When you share reels, they will appear on your profile seamlessly.
              </p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'tagged' && (
        <div className="pt-20 flex flex-col items-center justify-center text-center">
           <div className="w-20 h-20 rounded-full border-2 border-muted flex items-center justify-center mb-6 text-muted-foreground">
              <UserSquare className="w-8 h-8" />
           </div>
           <h2 className="text-2xl font-black mb-2 opacity-80">Capture your tagged posts</h2>
           <p className="text-muted-foreground font-medium max-w-xs leading-relaxed">When you are tagged in posts, they will appear on your profile seamlessly.</p>
        </div>
      )}
      </>
      )}

      {selectedReelId && (
        <ProfileReelModal reelId={selectedReelId} onClose={() => setSelectedReelId(null)} />
      )}

      <ShareModal
        isOpen={Boolean(profileShareModal)}
        onClose={() => setProfileShareModal(null)}
        shareUrl={profileShareModal?.shareUrl ?? ''}
        itemTitle={profileShareModal?.itemTitle ?? 'Share Profile'}
        shareText={profileShareModal?.shareText ?? 'Shared a profile'}
        kind={profileShareModal?.kind ?? 'profile'}
        notificationText={profileShareModal?.notificationText}
      />

      <AccountSwitcherModal
        open={showAccountSwitcher}
        accounts={userAccounts}
        activeUid={cloudSession?.user?.id ?? currentUser?.id}
        linking={accountLinking}
        cloudAuthEnabled={isCloudAuthConfigured()}
        onClose={() => setShowAccountSwitcher(false)}
        onSelectAccount={async (uid, password) => {
          try {
            const label =
              userAccounts.find((a) => a.uid === uid)?.displayName || 'selected account';
            showToast(`Switching to ${label}…`);
            await selectAccount(uid, password);
            setShowAccountSwitcher(false);
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to switch account.';
            showToast(message);
          }
        }}
        onRemoveAccount={removeAccount}
        onSendEmailOtp={async (email, mode, profile) => {
          try {
            setAccountLinking(true);
            await ensureDeviceAccountsSynced();
            return await sendEmailAuthOtp(email, {
              createAccount: mode === 'signup',
              displayName: profile?.displayName,
              username: profile?.username,
            });
          } catch {
            return { ok: false, reason: 'Failed to send email code.' };
          } finally {
            setAccountLinking(false);
          }
        }}
        onVerifyEmailOtp={async (email, code) => {
          try {
            setAccountLinking(true);
            const result = await verifyEmailAuthOtp(email, code, { switchAccount: true });
            if (result.ok) {
              setShowAccountSwitcher(false);
              setShowEditProfile(false);
            }
            return result;
          } catch {
            return { ok: false, reason: 'Failed to verify email code.' };
          } finally {
            setAccountLinking(false);
          }
        }}
        onLinkGoogle={async () => {
          try {
            setAccountLinking(true);
            setShowAccountSwitcher(false);
            setShowEditProfile(false);
            await ensureDeviceAccountsSynced();
            const result = await switchAccount();
            if (result.redirecting) {
              showToast('Opening Google sign-in…');
              return;
            }
            if (result.ok) {
              showToast('Google account linked!');
            } else if (result.reason) {
              showToast(result.reason);
            }
          } catch {
            showToast('Failed to start account linking.');
          } finally {
            setAccountLinking(false);
          }
        }}
      />

      {followListMode && (
        <FollowListModal
          profileUserId={profileUserId}
          mode={followListMode}
          onClose={() => setFollowListMode(null)}
        />
      )}

      {showCreatorProgress && (
        <CreatorProgressModal
          progress={creatorProgress}
          username={profileUser.username}
          onClose={() => setShowCreatorProgress(false)}
        />
      )}

    </div>
  );
}

