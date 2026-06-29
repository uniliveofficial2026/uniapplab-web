import React from 'react';
import { motion } from 'motion/react';
import { User } from '../../types';
import { Grid, ChevronLeft, Mic2, MoreHorizontal } from 'lucide-react';
import { ShareIcon } from '../common/ShareIcon';
import { ShareModal } from '../feed/ShareModal';
import type { ProfileSharePayload } from '../../lib/profileShare';
import { buildContextualProfileSharePayload } from '../../lib/profileShare';
import { useDB } from '../../lib/useDB';
import { Avatar } from '../common/Avatar';
import { ProfilePremiumBadgeForUser } from '../common/ProfilePremiumBadge';
import { handleMediaError } from '../../lib/utils';
import { useToast } from '../../lib/ToastContext';
import { resolveProfileGridPost } from '../../lib/profilePostGrid';
import { FollowListModal } from './FollowListModal';
import { CreatorLevelBadge } from './CreatorLevelBadge';
import { CreatorProgressModal } from './CreatorProgressModal';
import { StoryStrip } from '../feed/StoryStrip';
import { ProfilePrivateContentGate } from './ProfilePrivateContentGate';
import { useFollowActionState } from '../../lib/useFollowActionState';
import { followToggleToastMessage, getFollowButtonHoverLabel } from '../../lib/followPrivacy';
import { useProfileStats } from '../../lib/useProfileStats';
import { getProfileMentionLabel, getProfileDisplayName, formatProfileHandle, shouldShowProfileHandle } from '../../lib/profileDisplay';
import { ProfileNamePrimary } from '../common/ProfileNameLines';
import {
  getOptionsMenuItemClass,
  optionsMenuItemPointerHandlers,
  useOptionsMenuHover,
} from '../../lib/optionsMenu';
import { openAppProfileSurface, openKaraokeProfileSurface } from '../../lib/profileSurface';
import { captureShareProfileReturnContext } from '../../lib/karaokeReturnContext';

export function UserProfilePreview({
  userId,
  user: userSnapshot,
  onClose,
}: {
  userId: string;
  user?: User;
  onClose: () => void;
}) {
  const db = useDB();
  const { showToast } = useToast();
  const {
    profileUser,
    userPosts,
    followerCount,
    followingCount,
    creatorProgress,
  } = useProfileStats(userSnapshot, userId);
  const [followHover, setFollowHover] = React.useState(false);
  const [followListMode, setFollowListMode] = React.useState<'followers' | 'following' | null>(
    null
  );
  const [showCreatorProgress, setShowCreatorProgress] = React.useState(false);
  const [showActionsMenu, setShowActionsMenu] = React.useState(false);
  const [profileShareModal, setProfileShareModal] = React.useState<ProfileSharePayload | null>(null);
  const { hoveredMenuItem, setHoveredMenuItem } = useOptionsMenuHover(showActionsMenu);

  const isSelf = profileUser.id === db.currentUser?.id;
  const isBlocked = !isSelf && db.isUserBlocked(profileUser.id);
  const followAction = useFollowActionState(isSelf ? undefined : profileUser.id);
  const canViewProfileContent = isSelf || (followAction?.canViewContent ?? true);

  React.useEffect(() => {
    if (!isSelf && profileUser.id) {
      if (profileUser.status === 'live') {
        db.recordProfileVisit(profileUser.id, {
          surface: 'live',
          liveKind: profileUser.liveKind ?? 'solo',
        });
      } else {
        db.recordProfileVisit(profileUser.id, { surface: 'profile' });
      }
    }
  }, [profileUser.id, profileUser.status, profileUser.liveKind, isSelf, db]);

  const handleFollowToggle = () => {
    db.toggleFollow(profileUser.id);
    const after = db.getFollowActionState(profileUser.id);
    const label = getProfileMentionLabel(profileUser);
    showToast(followToggleToastMessage(after, label));
    setFollowHover(false);
  };

  const profileLabel = getProfileMentionLabel(profileUser);

  const handleBlockUser = () => {
    if (
      !window.confirm(
        `Block @${profileLabel}? Their posts will be hidden and they will be unfollowed.`,
      )
    ) {
      return;
    }
    if (!db.blockUser(profileUser.id)) return;
    showToast(`Blocked @${profileLabel}`);
    setShowActionsMenu(false);
    onClose();
  };

  const handleUnblockUser = () => {
    if (!db.unblockUser(profileUser.id)) return;
    showToast(`Unblocked @${profileLabel}`);
    setShowActionsMenu(false);
  };

  const handleReportUser = () => {
    showToast('Reported');
    setShowActionsMenu(false);
  };

  const openProfileShareModal = () => {
    setProfileShareModal(
      buildContextualProfileSharePayload({
        user: profileUser,
        isSelf,
      }),
    );
  };

  return (
    <>
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6 pb-20 pointer-events-none" data-app-overlay-root>
              <div className="absolute inset-0 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md pointer-events-auto" onClick={onClose} />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="w-full max-w-sm bg-card rounded-[32px] border border-border shadow-2xl relative z-10 pointer-events-auto overflow-hidden flex flex-col max-h-[80vh]"
      >
        <div className="p-4 border-b border-border flex items-center justify-between sticky top-0 bg-card z-10">
           <div className="flex items-center gap-4">
              <button onClick={onClose} className="p-2 hover:bg-secondary rounded-full -ml-2 transition-colors"><ChevronLeft className="w-6 h-6" /></button>
              <h3 className="font-bold text-lg flex items-center gap-2 min-w-0">
                <ProfileNamePrimary user={profileUser} className="truncate" />
                <ProfilePremiumBadgeForUser user={profileUser} size="sm" />
              </h3>
           </div>
           <div className="flex items-center gap-2 shrink-0">
             {!isSelf ? (
               <div className="relative">
                 <button
                   type="button"
                   aria-label={`More actions for ${profileLabel}`}
                   aria-expanded={showActionsMenu}
                   onClick={() => setShowActionsMenu((open) => !open)}
                   className="p-2 rounded-full text-foreground/70 hover:text-foreground hover:bg-secondary transition-colors"
                 >
                   <MoreHorizontal className="w-5 h-5" />
                 </button>
                 {showActionsMenu ? (
                   <>
                     <button
                       type="button"
                       aria-label="Close menu"
                       className="fixed inset-0 z-[111] cursor-default"
                       onClick={() => setShowActionsMenu(false)}
                     />
                     <div
                       role="menu"
                       className="absolute right-0 top-full z-[112] mt-1 min-w-[11rem] rounded-xl border border-border bg-background p-1.5 shadow-xl"
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
                           {...optionsMenuItemPointerHandlers(
                             'unblock-user',
                             setHoveredMenuItem,
                           )}
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
                           {...optionsMenuItemPointerHandlers(
                             'block-user',
                             setHoveredMenuItem,
                           )}
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
                         {...optionsMenuItemPointerHandlers(
                           'report-user',
                           setHoveredMenuItem,
                         )}
                         onClick={handleReportUser}
                       >
                         Report...
                       </button>
                     </div>
                   </>
                 ) : null}
               </div>
             ) : null}
             <div className="flex items-center gap-2">
             <button 
               onClick={() => {
                 onClose();
                 openAppProfileSurface({ userId: profileUser.id });
               }}
               className="text-xs font-bold text-primary hover:underline hover:text-primary/80 transition-colors"
             >
               InstaCollab
             </button>
             <span className="text-muted-foreground/40">·</span>
             <button
               onClick={() => {
                 onClose();
                 openKaraokeProfileSurface({
                   userId: profileUser.id,
                   displayName: getProfileDisplayName(profileUser),
                   username: profileUser.username,
                   isSelf: profileUser.id === db.currentUser?.id,
                   returnContext: captureShareProfileReturnContext(),
                   closeRoomFlow: captureShareProfileReturnContext().surface === 'karaoke-party-room',
                 });
               }}
               className="text-xs font-bold text-primary hover:underline hover:text-primary/80 transition-colors inline-flex items-center gap-1"
             >
               <Mic2 className="w-3 h-3" />
               K-Star
             </button>
             </div>
           </div>
        </div>
        
        <div className="overflow-y-auto overflow-x-visible no-scrollbar p-6 pt-8">
          <StoryStrip
            mode="profile"
            compact
            className="mb-2 -mx-1"
            showAddStory={profileUser.id === db.currentUser?.id}
            onlyUserId={profileUser.id}
          />
          <div 
            onClick={() => {
              onClose();
              openAppProfileSurface({ userId: profileUser.id });
            }}
            className="flex items-center gap-6 mb-6 cursor-pointer group/avatar overflow-visible"
          >
             <div className="w-20 h-20 shrink-0 shadow-sm group-hover/avatar:opacity-80 transition-opacity overflow-visible relative">
               <Avatar user={profileUser} className="w-20 h-20" thoughtBubbleMode="portal" />
             </div>
             <div className="flex gap-4 flex-1 justify-center">
                <div className="flex flex-col items-center">
                   <span className="font-bold text-lg">{userPosts.length.toLocaleString()}</span>
                   <span className="text-[12px] text-muted-foreground font-bold font-sans">Posts</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFollowListMode('followers');
                  }}
                  className="flex flex-col items-center hover:opacity-70"
                >
                   <span className="font-bold text-lg">{followerCount.toLocaleString()}</span>
                   <span className="text-[12px] text-muted-foreground font-bold font-sans">Followers</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFollowListMode('following');
                  }}
                  className="flex flex-col items-center hover:opacity-70"
                >
                   <span className="font-bold text-lg">{followingCount.toLocaleString()}</span>
                   <span className="text-[12px] text-muted-foreground font-bold font-sans">Following</span>
                </button>
             </div>
          </div>
          
          <CreatorLevelBadge
            progress={creatorProgress}
            shell="pill"
            compact
            showProgressBar={false}
            className="mb-4 items-center"
            onClick={() => setShowCreatorProgress(true)}
          />

          <div className="mb-6">
             <div className="font-bold text-[15px] flex flex-col items-start gap-0.5 flex-wrap">
               <span className="flex items-center gap-2 flex-wrap">
                 <ProfileNamePrimary user={profileUser} />
                 <ProfilePremiumBadgeForUser user={profileUser} size="sm" />
               </span>
               {shouldShowProfileHandle(profileUser) ? (
                 <span className="text-[13px] font-medium text-muted-foreground">{formatProfileHandle(profileUser)}</span>
               ) : null}
             </div>
             <div className="text-[14px] text-foreground/90 mt-1 whitespace-pre-line">{profileUser.bio || 'Digital creator. Living life to the fullest. ✨ #lifestyle'}</div>
          </div>
          
          {isBlocked ? (
            <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-center text-sm font-semibold text-red-600 dark:text-red-400">
              You blocked @{profileLabel}
            </div>
          ) : null}

          <div className="flex gap-3 mb-6">
             <button
               type="button"
               onClick={openProfileShareModal}
               className="group p-2 border border-border rounded-full hover:bg-secondary transition shrink-0"
               aria-label="Share profile"
               title="Share profile"
             >
               <ShareIcon size="sm" />
             </button>
             {profileUser.id !== db.currentUser?.id && !isBlocked && (
               <button
                 type="button"
                 onClick={handleFollowToggle}
                 onMouseEnter={() => setFollowHover(true)}
                 onMouseLeave={() => setFollowHover(false)}
                 aria-pressed={!!followAction?.isFollowing}
                 className={`flex-1 py-1.5 font-bold rounded-lg text-sm border transition-all active:scale-95 ${
                   followAction?.isFollowing
                     ? followHover
                       ? 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/40'
                       : 'bg-background text-foreground border-border hover:bg-secondary'
                     : followAction?.isRequested
                       ? 'bg-secondary text-foreground border-border'
                       : 'bg-primary text-primary-foreground border-transparent hover:bg-primary/90'
                 }`}
               >
                 {followAction
                   ? getFollowButtonHoverLabel(followAction, followHover)
                   : 'Follow'}
               </button>
             )}
             {!isBlocked ? (
             <button 
               onClick={() => {
                 onClose();
                 window.dispatchEvent(new CustomEvent('navigate', { detail: { tab: 'messages', chatId: profileUser.id } }));
               }}
               className="flex-1 py-1.5 bg-secondary text-foreground font-bold rounded-lg text-sm border border-border transition-colors hover:bg-secondary/70">Message</button>
             ) : (
               <button
                 type="button"
                 onClick={handleUnblockUser}
                 className="flex-1 py-1.5 bg-secondary text-foreground font-bold rounded-lg text-sm border border-border transition-colors hover:bg-secondary/70"
               >
                 Unblock
               </button>
             )}
          </div>
          
          {/* Grid */}
          <div className="border-t border-border pt-4">
             <div className="flex justify-center mb-4 text-foreground"><Grid className="w-6 h-6" /></div>
             {!canViewProfileContent ? (
               <ProfilePrivateContentGate username={profileUser.username || 'this user'} compact />
             ) : (
             <div className="grid grid-cols-3 gap-1">
               {userPosts.map((raw) => {
                 const grid = resolveProfileGridPost(raw, db);
                 return (
                 <div key={grid.id} className="aspect-square bg-secondary relative overflow-hidden group cursor-pointer">
                   <img src={grid.thumbUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" onError={handleMediaError} />
                 </div>
                 );
               })}
               {userPosts.length === 0 && (
                 <div className="col-span-3 text-center py-10 text-muted-foreground text-sm font-medium">No posts yet</div>
               )}
             </div>
             )}
          </div>
        </div>
      </motion.div>
    </div>
    {followListMode && (
      <FollowListModal
        profileUserId={profileUser.id}
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
    <ShareModal
      isOpen={Boolean(profileShareModal)}
      onClose={() => setProfileShareModal(null)}
      shareUrl={profileShareModal?.shareUrl ?? ''}
      itemTitle={profileShareModal?.itemTitle ?? 'Share Profile'}
      shareText={profileShareModal?.shareText ?? 'Shared a profile'}
      kind={profileShareModal?.kind ?? 'profile'}
      notificationText={profileShareModal?.notificationText}
    />
    </>
  );
}
