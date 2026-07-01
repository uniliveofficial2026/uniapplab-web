import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Avatar } from '../common/Avatar';
import { ProfilePremiumBadgeForUser } from '../common/ProfilePremiumBadge';
import { ShareModal } from './ShareModal';
import { buildPostSharePayload } from '../../lib/shareLinks';
import { Post as PostType } from '../../types';
import { motion } from 'motion/react';
import { Repeat } from 'lucide-react';
import { useToast } from '../../lib/ToastContext';
import { useDB } from '../../lib/useDB';
import { RepostModal } from './RepostModal';
import { openProfilePreview, handleMediaError } from '../../lib/utils';
import { touchClientX, postUserId, resolveUser, resolvePostDisplayMedia } from '../../lib/safe';
import {
  closeNativeVideoFullscreen,
  openNativeVideoFullscreen,
  useNativeVideoFullscreen,
} from '../../lib/useNativeVideoFullscreen';
import { resolvePost, buildCommentPayload } from '../../lib/entityResolve';
import { isPostTextOnly, resolvePostMediaSource, resolveRepostEmbedPost } from '../../lib/repostMedia';
import { RepostPostMediaPanel } from './RepostPostMediaPanel';
import { ProfileNamePrimary } from '../common/ProfileNameLines';
import { useOptionsMenuHover } from '../../lib/optionsMenu';
import { isPlayableAudioUrl, resolveEditorSoundtrackUrl } from '../../lib/audioMedia';
import {
  pinPostAudioEntry,
  unpinPostAudioEntry,
  usePostPlaybackAudio,
} from '../../lib/postAudioRegistry';
import { PostContentFullscreenPortal } from './PostContentFullscreenPortal';
import { PostOptionsMenu } from './PostOptionsMenu';
import { PostMediaStage } from './PostMediaStage';
import { PostCardFooter } from './PostCardFooter';
import { PLAYBACK_PRIORITY } from '../../lib/playbackAudio';
import {
  postPlaybackId,
  resetPostPlayback,
} from '../../lib/postPlayback';
import { useExclusivePlayback } from '../../lib/useExclusivePlayback';
import {
  useFullscreenOpenGuard,
  useMediaOverlayAcquire,
  useMediaOverlayLocked,
} from '../../lib/mediaOverlayLock';
import { useCarouselNativeVideoAdvance } from '../../lib/useCarouselNativeVideoAdvance';
import {
  IMAGE_CAROUSEL_MS,
  nextCarouselIndex,
  postCarouselItemCount,
  shouldLoopCarouselItem,
} from '../../lib/mediaPlayback';


interface PostProps {
  post: PostType;
  onLike?: (id: string) => void;
  onSave?: (id: string) => void;
  onViewComments?: (id: string) => void;
  /** Post id when comments modal is open (keeps feed playback intent alive under overlay). */
  commentsPostId?: string | null;
  hideVideoControls?: boolean;
}

export function Post({
  post,
  onLike,
  onSave,
  onViewComments,
  commentsPostId = null,
  hideVideoControls,
}: PostProps) {
  const [commentText, setCommentText] = useState('');
  const [showHeartAnimation, setShowHeartAnimation] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showRepostModal, setShowRepostModal] = useState(false);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const { hoveredMenuItem, setHoveredMenuItem } = useOptionsMenuHover(showOptionsModal);
  const [isContentFullscreen, setIsContentFullscreen] = useState(false);
  const [currentMediaIdx, setCurrentMediaIdx] = useState(0);
  const [videoError, setVideoError] = useState(false);
  const [isMediaInView, setIsMediaInView] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const lastTapRef = useRef<number>(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fsVideoRef = useRef<HTMLVideoElement>(null);
  const carouselAudioRef = useRef<HTMLAudioElement>(null);
  const { showToast } = useToast();
  const db = useDB();

  const minSwipeDistance = 50;

  const livePost = resolvePost(db.posts, post, db.users);
  const sharePayload = React.useMemo(
    () => buildPostSharePayload(livePost.id),
    [livePost.id],
  );
  const { post: mediaPost, livePost: mediaLivePost } = resolvePostMediaSource(
    post,
    livePost,
    db.posts,
    db.users
  );
  const carouselItemCount = postCarouselItemCount(mediaPost);
  const mediaListCount = carouselItemCount > 1 ? carouselItemCount : 0;
  const loopCarouselItem = shouldLoopCarouselItem(carouselItemCount);
  const isRepostEmbed = !!livePost.repost;
  const repostHeaderPost = resolveRepostEmbedPost(livePost, db.posts, db.users);
  const postHeaderSubtitle = isRepostEmbed
    ? 'Repost'
    : livePost.location?.trim() || '';
  const isTextPost = isPostTextOnly(mediaLivePost);
  const displayMediaForPlayback = resolvePostDisplayMedia(mediaPost, currentMediaIdx);
  const feedShowVideo =
    displayMediaForPlayback.type === 'video' &&
    !videoError &&
    !displayMediaForPlayback.showAsImage;

  const { wrapCarouselAdvance } = useCarouselNativeVideoAdvance(
    videoRef,
    currentMediaIdx,
    feedShowVideo ? displayMediaForPlayback.url : undefined,
    feedShowVideo,
    { coordinatorOwnsPlay: true }
  );

  const goToPrevCarouselItem = useCallback(() => {
    if (carouselItemCount <= 1) return;
    wrapCarouselAdvance(() => {
      setCurrentMediaIdx((prev) => (prev === 0 ? carouselItemCount - 1 : prev - 1));
    });
  }, [carouselItemCount, wrapCarouselAdvance]);

  const goToNextCarouselItem = useCallback(() => {
    if (carouselItemCount <= 1) return;
    wrapCarouselAdvance(() => {
      setCurrentMediaIdx((prev) => nextCarouselIndex(prev, carouselItemCount));
    });
  }, [carouselItemCount, wrapCarouselAdvance]);

  useEffect(() => {
    setVideoError(false);
  }, [post.id, currentMediaIdx]);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(touchClientX(e.targetTouches));
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(touchClientX(e.targetTouches));
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    if (isLeftSwipe || isRightSwipe) {
      if (mediaListCount > 1) {
        if (isLeftSwipe) {
          goToNextCarouselItem();
        } else {
          goToPrevCarouselItem();
        }
      }
    }
  };

  const [fsTouchStart, setFsTouchStart] = useState<number | null>(null);
  const [fsTouchEnd, setFsTouchEnd] = useState<number | null>(null);
  const [showFullCaptionModal, setShowFullCaptionModal] = useState(false);

  const handleFsTouchStart = (e: React.TouchEvent) => {
    setFsTouchEnd(null);
    setFsTouchStart(touchClientX(e.targetTouches));
  };

  const handleFsTouchMove = (e: React.TouchEvent) => {
    setFsTouchEnd(touchClientX(e.targetTouches));
  };

  const handleFsTouchEnd = () => {
    if (!fsTouchStart || !fsTouchEnd) return;
    const distance = fsTouchStart - fsTouchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    if (isLeftSwipe || isRightSwipe) {
      if (carouselItemCount > 1) {
        if (isLeftSwipe) {
          goToNextCarouselItem();
        } else {
          goToPrevCarouselItem();
        }
      }
    }
  };

  const mediaContainerRef = useRef<HTMLDivElement>(null);
  const wasMediaInViewRef = useRef(false);

  const postSoundtrackUrl = resolveEditorSoundtrackUrl(
    livePost.audioUrl,
    displayMediaForPlayback.type
  );
  const postTextAudioUrl =
    isTextPost && isPlayableAudioUrl(livePost.audioUrl)
      ? livePost.audioUrl
      : undefined;
  const feedShowCarouselAudio =
    displayMediaForPlayback.type === 'audio' &&
    !!displayMediaForPlayback.url;
  const isNativeVideoFullscreen = useNativeVideoFullscreen(videoRef, feedShowVideo);
  const isFullscreenUi = isContentFullscreen || isNativeVideoFullscreen;
  const mediaOverlayLocked = useMediaOverlayLocked();
  const { markOpened: markContentFsOpened, shouldIgnoreClose: shouldIgnoreFsBackdropClose } =
    useFullscreenOpenGuard(isContentFullscreen);
  useMediaOverlayAcquire(isContentFullscreen);

  // Visibility for feed audio (image soundtrack, text bg audio) and video
  useEffect(() => {
    if (isContentFullscreen) {
      return;
    }
    const node = mediaContainerRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setIsMediaInView(entry.isIntersecting && entry.intersectionRatio >= 0.5);
        });
      },
      { threshold: [0, 0.5, 0.6] }
    );

    observer.observe(node);
    const rect = node.getBoundingClientRect();
    const inView =
      rect.top < window.innerHeight &&
      rect.bottom > 0 &&
      rect.height > 0;
    if (inView) {
      setIsMediaInView(true);
    }

    return () => observer.disconnect();
  }, [isContentFullscreen, livePost.id]);

  const commentsOpenForPost = commentsPostId === livePost.id;

  // Leaving the feed viewport: reset carousel + playback so return starts at 0:00
  useEffect(() => {
    if (isFullscreenUi || commentsOpenForPost) {
      return;
    }
    const wasInView = wasMediaInViewRef.current;
    if (wasInView && !isMediaInView) {
      resetPostPlayback(livePost.id);
      setCurrentMediaIdx(0);
    }
    wasMediaInViewRef.current = isMediaInView;
  }, [isMediaInView, isFullscreenUi, commentsOpenForPost, livePost.id]);
  const feedMediaCanPlay =
    isMediaInView &&
    !isContentFullscreen &&
    !mediaOverlayLocked &&
    !db.isCreatorEditingActive;
  const feedPlaybackEligible =
    feedMediaCanPlay ||
    isContentFullscreen ||
    isNativeVideoFullscreen ||
    commentsOpenForPost;

  const postAudioActive = feedPlaybackEligible && !db.globalMuted;
  const postAudioPriority = isContentFullscreen
    ? PLAYBACK_PRIORITY.POST_FS
    : PLAYBACK_PRIORITY.FEED;
  const postAudioIntentKey = isContentFullscreen ? 'post-fs' : 'feed';

  useEffect(() => {
    pinPostAudioEntry(livePost.id);
    return () => unpinPostAudioEntry(livePost.id);
  }, [livePost.id]);

  usePostPlaybackAudio(livePost.id, postAudioIntentKey, {
    soundtrackUrl: postSoundtrackUrl,
    textAudioUrl: postTextAudioUrl,
    priority: postAudioPriority,
    active: postAudioActive,
    muted: db.globalMuted,
    loop: loopCarouselItem,
    onEnded: loopCarouselItem ? undefined : goToNextCarouselItem,
  });

  // Still images in a multi-item carousel advance after a fixed duration
  useEffect(() => {
    if (loopCarouselItem) return;
    const item = mediaPost.mediaList?.[currentMediaIdx];
    if (!item || item.type !== 'image') return;
    const canAdvance = isContentFullscreen || feedMediaCanPlay;
    if (!canAdvance) return;

    const timer = window.setTimeout(goToNextCarouselItem, IMAGE_CAROUSEL_MS);
    return () => window.clearTimeout(timer);
  }, [
    loopCarouselItem,
    currentMediaIdx,
    mediaPost.mediaList,
    isContentFullscreen,
    feedMediaCanPlay,
    goToNextCarouselItem,
  ]);

  const postInlineVideoWantsPlay =
    feedPlaybackEligible &&
    feedShowVideo &&
    !isContentFullscreen &&
    !postSoundtrackUrl;

  const postFsVideoWantsPlay =
    isContentFullscreen && feedShowVideo && !postSoundtrackUrl;

  useExclusivePlayback(
    postPlaybackId(livePost.id, 'video'),
    postAudioPriority,
    postInlineVideoWantsPlay,
    videoRef,
    'feed'
  );

  useExclusivePlayback(
    postPlaybackId(livePost.id, 'video-fs'),
    PLAYBACK_PRIORITY.POST_FS,
    postFsVideoWantsPlay,
    fsVideoRef,
    'post-fs'
  );

  useExclusivePlayback(
    postPlaybackId(livePost.id, 'carousel-audio'),
    postAudioPriority,
    postAudioActive && feedShowCarouselAudio,
    carouselAudioRef,
    postAudioIntentKey
  );

  const postAuthor = resolveUser(db.users, livePost.user);
  const isFollowing = !!postAuthor.isFollowing;

  const handleFollowToggle = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const authorId = postUserId(livePost);
    if (!authorId) return;
    const next = db.toggleFollow(authorId);
    if (next === null) return;
    const label = postAuthor.username || postAuthor.displayName || 'user';
    showToast(next ? `Following ${label}` : `Unfollowed ${label}`);
  };

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    db.addPostComment(
      livePost.id,
      buildCommentPayload(resolveUser(db.users, db.currentUser), commentText)
    );
    setCommentText('');
  };

  const handleOpenFullscreen = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    markContentFsOpened();
    setIsContentFullscreen(true);
  };

  const handleCloseFullscreen = (e?: React.MouseEvent | React.TouchEvent) => {
    if (e) e.stopPropagation();
    closeNativeVideoFullscreen(videoRef.current);
    setIsContentFullscreen(false);
    setIsMediaInView(true);
  };

  const handleDoubleTap = () => {
    const now = Date.now();
    const DOUBLE_PRESS_DELAY = 300;
    
    if (lastTapRef.current && (now - lastTapRef.current) < DOUBLE_PRESS_DELAY) {
      if (!livePost.isLiked && onLike) {
        onLike(livePost.id);
      }
      setShowHeartAnimation(true);
      setTimeout(() => setShowHeartAnimation(false), 1000);
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
      setTimeout(() => {
        if (lastTapRef.current === now) {
          handleOpenFullscreen();
        }
      }, DOUBLE_PRESS_DELAY);
    }
  };

  if (!post?.id || !post?.user?.id) {
    return null;
  }

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`w-full max-w-[470px] bg-card rounded-[32px] p-2 flex flex-col mb-8 border border-border shadow-sm isolate overflow-visible ${
        showOptionsModal ? 'relative z-[120]' : ''
      }`}
      style={isContentFullscreen && (mediaPost.videoUrl || mediaPost.mediaList?.some((m) => m.type === 'video')) ? { transform: 'none', filter: 'none', zIndex: 9999, position: 'relative' } : {}}
    >
      {/* Header — stays above post media when the ⋯ menu is open */}
      <div
        className={`flex items-center justify-between px-4 pb-4 pt-10 cursor-pointer overflow-visible relative ${
          showOptionsModal ? 'z-30' : 'z-10'
        }`}
      >
        <div className="flex items-center gap-3 group overflow-visible" onClick={() => openProfilePreview(postAuthor)}>
          <Avatar user={postAuthor} size="md" thoughtBubbleMode="inline" />
          <div className="flex flex-col">
            <span className="text-[15px] font-bold leading-tight group-hover:text-primary transition-colors flex items-center gap-1 flex-wrap">
              <ProfileNamePrimary user={postAuthor} fallback="Unknown" />
              {postAuthor.isVerified && <span className="bg-primary/20 text-primary text-[10px] px-1 rounded-sm">✓</span>}
              <ProfilePremiumBadgeForUser user={postAuthor} size="sm" />
            </span>
            {postHeaderSubtitle ? (
              <span className="text-[13px] text-muted-foreground font-medium leading-tight truncate max-w-[220px]">
                {postHeaderSubtitle}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-3 relative z-10 overflow-visible">
          {livePost.user?.id !== db.currentUser?.id && (
            <button 
              onClick={handleFollowToggle} 
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors border ${isFollowing ? 'bg-background text-foreground border-border hover:bg-secondary' : 'bg-primary text-primary-foreground border-transparent hover:bg-primary/90'}`}
            >
              {isFollowing ? 'Following' : 'Follow'}
            </button>
          )}
          <PostOptionsMenu
            isOpen={showOptionsModal}
            onOpenChange={setShowOptionsModal}
            hoveredMenuItem={hoveredMenuItem}
            onHoverMenuItem={setHoveredMenuItem}
            isOwnPost={livePost.user?.id === db.currentUser?.id}
            isArchived={!!livePost.isArchived}
            isFollowing={isFollowing}
            onArchive={() => {
              db.togglePostArchive(livePost.id);
              showToast('Post archived');
              setShowOptionsModal(false);
            }}
            onDelete={() => {
              db.deletePost(livePost.id);
              showToast('Post deleted');
            }}
            onReport={() => {
              db.updatePost(livePost.id, (p) => ({ ...p, isReported: true }));
              showToast('Post reported');
            }}
            onUnfollow={() => handleFollowToggle()}
            onFavorite={() => {
              db.togglePostSave(livePost.id);
              showToast('Added to favorites');
            }}
            onCopyLink={() => {
              navigator.clipboard.writeText(sharePayload.shareUrl);
              showToast('Link copied');
            }}
          />
        </div>
      </div>
      {/* Image/Video with Double Tap and single tap */}
      <div 
        ref={mediaContainerRef}
        className={`w-full rounded-[24px] bg-secondary border border-border aspect-square flex items-center justify-center relative cursor-pointer group overflow-hidden ${
          showOptionsModal ? 'z-0' : 'z-[1]'
        }`}
        onClick={(e) => {
          if (showOptionsModal) {
            e.stopPropagation();
            setShowOptionsModal(false);
            return;
          }
          handleDoubleTap();
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {isRepostEmbed && repostHeaderPost ? (
          <RepostPostMediaPanel
            repost={repostHeaderPost}
            mediaPost={mediaPost}
            mediaLivePost={mediaLivePost}
            isTextPost={isTextPost}
            mediaStageProps={{
              currentMediaIdx,
              videoError,
              setVideoError,
              loopCarouselItem,
              hideVideoControls,
              showHeartAnimation,
              onShowFullCaption: () => setShowFullCaptionModal(true),
              videoRef,
              carouselAudioRef,
              globalMuted: db.globalMuted,
              onSetGlobalMuted: db.setGlobalMuted,
              onOpenFullscreen: handleOpenFullscreen,
              onPrevCarouselItem: goToPrevCarouselItem,
              onNextCarouselItem: goToNextCarouselItem,
              postAudioIntentKey,
              postAudioPriority,
              playbackPostId: livePost.id,
            }}
          />
        ) : (
          <PostMediaStage
            post={mediaPost}
            livePost={mediaLivePost}
            isTextPost={isTextPost}
            currentMediaIdx={currentMediaIdx}
            videoError={videoError}
            setVideoError={setVideoError}
            loopCarouselItem={loopCarouselItem}
            hideVideoControls={hideVideoControls}
            showHeartAnimation={showHeartAnimation}
            onShowFullCaption={() => setShowFullCaptionModal(true)}
            videoRef={videoRef}
            carouselAudioRef={carouselAudioRef}
            globalMuted={db.globalMuted}
            onSetGlobalMuted={db.setGlobalMuted}
            onOpenFullscreen={handleOpenFullscreen}
            onPrevCarouselItem={goToPrevCarouselItem}
            onNextCarouselItem={goToNextCarouselItem}
            postAudioIntentKey={postAudioIntentKey}
            postAudioPriority={postAudioPriority}
            playbackPostId={livePost.id}
          />
        )}
      </div>

      <PostCardFooter
        post={post}
        livePost={livePost}
        postAuthor={postAuthor}
        showOptionsModal={showOptionsModal}
        onLike={onLike}
        onSave={onSave}
        onViewComments={onViewComments}
        onOpenShareModal={() => setShowShareModal(true)}
        onOpenRepostModal={() => setShowRepostModal(true)}
        commentText={commentText}
        onCommentTextChange={setCommentText}
        onCommentSubmit={handleCommentSubmit}
        showFullCaptionModal={showFullCaptionModal}
        onShowFullCaption={() => setShowFullCaptionModal(true)}
        onCloseFullCaption={() => setShowFullCaptionModal(false)}
        postComments={db.postComments}
        currentUser={db.currentUser}
        users={db.users}
        originalPostCreatedAt={isRepostEmbed ? mediaPost.createdAt : undefined}
      />

      {/* Share Modal */}
      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        shareUrl={sharePayload.shareUrl}
        itemTitle={sharePayload.itemTitle}
        shareText={sharePayload.shareText}
        kind={sharePayload.kind}
        notificationText={sharePayload.notificationText}
      />

      {showRepostModal && (
        <RepostModal post={livePost} onClose={() => setShowRepostModal(false)} />
      )}

      <PostContentFullscreenPortal
        isOpen={isContentFullscreen}
        post={mediaPost}
        livePost={mediaLivePost}
        currentMediaIdx={currentMediaIdx}
        isTextPost={isTextPost}
        loopCarouselItem={loopCarouselItem}
        videoError={videoError}
        carouselAudioRef={carouselAudioRef}
        fsVideoRef={fsVideoRef}
        globalMuted={db.globalMuted}
        onSetGlobalMuted={db.setGlobalMuted}
        postAudioIntentKey={postAudioIntentKey}
        postAudioPriority={postAudioPriority}
        playbackPostId={livePost.id}
        onClose={() => handleCloseFullscreen()}
        shouldIgnoreBackdropClose={shouldIgnoreFsBackdropClose}
        onRequestNativeVideoFullscreen={() => openNativeVideoFullscreen(fsVideoRef.current)}
        onTouchStart={handleFsTouchStart}
        onTouchMove={handleFsTouchMove}
        onTouchEnd={handleFsTouchEnd}
        onPrevCarouselItem={goToPrevCarouselItem}
        onNextCarouselItem={goToNextCarouselItem}
      />
    </motion.div>
  );
}
