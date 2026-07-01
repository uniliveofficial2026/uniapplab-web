import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Heart, MessageCircle, MoreHorizontal, FileVideo, Bookmark, Play, VolumeX, Volume2, Maximize2, ChevronLeft, ChevronRight, Music } from 'lucide-react';
import { ShareIcon } from '../common/ShareIcon';
import { useDB } from '../../lib/useDB';
import { motion, AnimatePresence } from 'motion/react';
import { useToast } from '../../lib/ToastContext';

import { ShareModal } from '../feed/ShareModal';
import { buildReelSharePayload } from '../../lib/shareLinks';
import { ReelsCommentsDrawer } from './ReelsCommentsDrawer';
import { ReelContentFullscreenPortal } from './ReelContentFullscreenPortal';
import { Avatar } from '../common/Avatar';
import { ProfileNamePrimary } from '../common/ProfileNameLines';
import { formatMentionsAndTags, openProfilePreview, handleAvatarError, handleMediaError, getFontClass, getAlignClass, resolveEditorTextColorClass, resolveOverlayTextStyle, REEL_STAT_LABEL_CLASS, REEL_STAT_LABEL_STYLE, truncateText, formatContentDateTime, contentTimestampIso } from '../../lib/utils';
import {
  touchClientX,
  resolveUser,
  resolvePostDisplayMedia,
  tryExitVideoFullscreen,
} from '../../lib/safe';
import {
  openNativeVideoFullscreen,
  useNativeVideoFullscreen,
} from '../../lib/useNativeVideoFullscreen';
import { FullscreenPostMediaContent } from '../common/FullscreenPostMediaContent';
import { resolveEditorSoundtrackUrl } from '../../lib/audioMedia';
import { resolveReelDiscCoverUrl } from '../../lib/mediaCoverArt';
import { useHorizontalCarouselSwipe } from '../../lib/carouselSwipe';
import { useCarouselNativeVideoAdvance } from '../../lib/useCarouselNativeVideoAdvance';
import { PLAYBACK_SCOPE } from '../../lib/playbackScope';
import type { Post, Reel, User } from '../../types';
import { db as localDb } from '../../lib/db/localDb';
import {
  postCarouselItemCount,
  shouldLoopCarouselItem,
  nextCarouselIndex,
  IMAGE_CAROUSEL_MS,
} from '../../lib/mediaPlayback';
import { MediaWithSoundtrack } from '../common/MediaWithSoundtrack';
import { PLAYBACK_PRIORITY, resetPlaybackMedia } from '../../lib/playbackAudio';
import { reelPlaybackId, resetReelPlayback } from '../../lib/reelPlayback';
import { buildMediaFilterStyle } from '../../lib/mediaFilters';
import { nativeVideoControlGuardProps } from '../../lib/nativeVideoControls';
import { useExclusivePlayback } from '../../lib/useExclusivePlayback';
import {
  useFullscreenOpenGuard,
  useMediaOverlayAcquire,
  useMediaOverlayLocked,
} from '../../lib/mediaOverlayLock';
import { resolveReel, buildCommentPayload } from '../../lib/entityResolve';
import {
  getOptionsMenuItemClass,
  optionsMenuItemPointerHandlers,
  useOptionsMenuHover,
  type OptionsMenuTone,
} from '../../lib/optionsMenu';

export function ReelsScreen() {
  const db = useDB();
  const USERS = db.users;
  const { showToast } = useToast();

  const REELS = db.reels;

  const [activeReelIndex, setActiveReelIndex] = useState(0);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const handleScroll = () => {
      if (document.getElementById('reel-full-screen-modal')) return;
      if (!scrollRef.current) return;
      const index = Math.round(scrollRef.current.scrollTop / scrollRef.current.clientHeight);
      if (index !== activeReelIndex) {
        setActiveReelIndex(index);
      }
    };
    
    const node = scrollRef.current;
    if (node) {
      node.addEventListener('scroll', handleScroll);
      return () => node.removeEventListener('scroll', handleScroll);
    }
  }, [activeReelIndex]);

  return (
    <div className="w-full h-full flex flex-col items-center bg-background overflow-hidden relative">
      <div 
        ref={scrollRef}
        className={`w-full max-w-[470px] h-full overflow-y-auto no-scrollbar snap-y snap-mandatory border-x border-zinc-800 ${isCommentsOpen ? '!overflow-hidden !snap-none' : ''}`}
      >
          {REELS.map((reel, index) => (
            <ReelItem 
              key={reel.id} 
              reel={reel} 
              isActive={index === activeReelIndex} 
              db={db} 
              USERS={USERS} 
              isCommentsOpen={index === activeReelIndex && isCommentsOpen}
              setIsCommentsOpen={setIsCommentsOpen}
              showToast={showToast}
              onUserClick={(user) => openProfilePreview(user)}
            />
         ))}
      </div>
    </div>
  );
}

/** Keeps carousel arrows/dots clear of the right action rail and bottom caption. */
const REEL_CAROUSEL_INSET = {
  top: '3.5rem',
  right: '4.75rem',
  bottom: '10.5rem',
  left: '0.75rem',
} as const;

function ReelItem({ reel, isActive, db, USERS, isCommentsOpen, setIsCommentsOpen, showToast, onUserClick: _onUserClick }: { reel: Reel, isActive: boolean, db: typeof localDb, USERS: User[], isCommentsOpen: boolean, setIsCommentsOpen: (open: boolean) => void, showToast: (msg: string) => void, onUserClick: (user: User) => void }) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [videoError, setVideoError] = useState(false);
  const [currentMediaIdx, setCurrentMediaIdx] = useState(0);
  const [isContentFullscreen, setIsContentFullscreen] = useState(false);
  const [fsTouchStart, setFsTouchStart] = useState<number | null>(null);
  const [fsTouchEnd, setFsTouchEnd] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fsVideoRef = useRef<HTMLVideoElement>(null);
  const carouselAudioRef = useRef<HTMLAudioElement>(null);
  const mediaSwipeRef = useRef<HTMLDivElement>(null);
  const fullscreenSwipeRef = useRef<HTMLDivElement>(null);
  const liveReel = resolveReel(db.reels, reel, db.users);
  const reelMedia = liveReel as Post;
  const isTextReel =
    (!liveReel.mediaList || liveReel.mediaList.length === 0) &&
    !liveReel.videoUrl &&
    !liveReel.imageUrl;
  const carouselItemCount = postCarouselItemCount(reelMedia);
  const loopCarouselItem = shouldLoopCarouselItem(carouselItemCount);
  const displayMedia = resolvePostDisplayMedia(reelMedia, currentMediaIdx);
  const hasMedia = carouselItemCount > 0 || isTextReel;
  const hasCarousel = carouselItemCount > 1;
  const showVideoSlide =
    displayMedia.type === 'video' && !videoError && !displayMedia.showAsImage;
  const isNativeVideoFullscreen = useNativeVideoFullscreen(
    videoRef,
    showVideoSlide && isActive
  );
  const isFullscreenUi = isContentFullscreen || isNativeVideoFullscreen;
  const mediaOverlayLocked = useMediaOverlayLocked();
  const { markOpened: markReelFsOpened, shouldIgnoreClose: shouldIgnoreReelFsBackdropClose } =
    useFullscreenOpenGuard(isContentFullscreen);
  useMediaOverlayAcquire(isContentFullscreen);
  const canOpenFullscreen = hasMedia;
  const minSwipeDistance = 50;

  const reelVideoPlaybackId = reelPlaybackId(liveReel.id, 'video');
  const reelSoundtrackPlaybackId = reelPlaybackId(liveReel.id, 'soundtrack');

  const { wrapCarouselAdvance, isVideoSlideTransitionRef } =
    useCarouselNativeVideoAdvance(
      videoRef,
      currentMediaIdx,
      showVideoSlide ? displayMedia.url : undefined,
      showVideoSlide,
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

  useHorizontalCarouselSwipe(
    mediaSwipeRef,
    hasCarousel && isActive && !isContentFullscreen,
    { onPrev: goToPrevCarouselItem, onNext: goToNextCarouselItem }
  );

  useHorizontalCarouselSwipe(
    fullscreenSwipeRef,
    hasCarousel && isContentFullscreen,
    { onPrev: goToPrevCarouselItem, onNext: goToNextCarouselItem }
  );

  useEffect(() => {
    if (isContentFullscreen) return;
    if (!isActive) {
      tryExitVideoFullscreen(videoRef.current);
      setIsContentFullscreen(false);
    }
  }, [isActive, isContentFullscreen]);

  useEffect(() => {
    setCurrentMediaIdx(0);
    setVideoError(false);
    tryExitVideoFullscreen(videoRef.current);
    setIsContentFullscreen(false);
    resetReelPlayback(liveReel.id);
  }, [liveReel?.id]);

  useEffect(() => {
    setVideoError(false);
    if (showVideoSlide) return;
    if (isVideoSlideTransitionRef.current) return;
    resetPlaybackMedia(reelVideoPlaybackId);
  }, [currentMediaIdx, showVideoSlide, reelVideoPlaybackId]);

  useEffect(() => {
    if (loopCarouselItem || !isActive) return;
    const item = liveReel?.mediaList?.[currentMediaIdx];
    if (!item || item.type !== 'image') return;
    const timer = window.setTimeout(goToNextCarouselItem, IMAGE_CAROUSEL_MS);
    return () => window.clearTimeout(timer);
  }, [
    loopCarouselItem,
    currentMediaIdx,
    liveReel?.mediaList,
    isActive,
    goToNextCarouselItem,
  ]);

  const reelAuthor = resolveUser(db.users, liveReel?.user);
  const me = resolveUser(db.users, db.currentUser);
  const isFollowing = !!reelAuthor.isFollowing;

  const wasReelActiveRef = useRef(isActive);

  const handleFollowToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const authorId = liveReel?.user?.id;
    if (!authorId) return;
    const next = db.toggleFollow(authorId);
    if (next === null) return;
    const label = reelAuthor.username || reelAuthor.displayName || 'user';
    showToast(next ? `Following ${label}` : `Unfollowed ${label}`);
  };
  
  const [showShareModal, setShowShareModal] = useState(false);
  const sharePayload = React.useMemo(() => buildReelSharePayload(liveReel.id), [liveReel.id]);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const { hoveredMenuItem, setHoveredMenuItem } = useOptionsMenuHover(showOptionsModal);
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<{ commentId: string; username: string } | null>(null);
  const commentInputRef = useRef<HTMLInputElement>(null);

  const renderReelMenuButton = (
    id: string,
    label: string,
    tone: OptionsMenuTone,
    onSelect: () => void
  ) => (
    <button
      type="button"
      role="menuitem"
      className={getOptionsMenuItemClass(id, tone, hoveredMenuItem, 'overlay')}
      {...optionsMenuItemPointerHandlers(id, setHoveredMenuItem)}
      onClick={(e) => {
        e.stopPropagation();
        setShowOptionsModal(false);
        setHoveredMenuItem(null);
        onSelect();
      }}
    >
      {label}
    </button>
  );
  
  const localComments = db?.reelComments?.[liveReel?.id] || [];
  const soundtrackUrl = resolveEditorSoundtrackUrl(
    liveReel?.audioUrl,
    displayMedia.type
  );
  const soundtrackLabel = soundtrackUrl
    ? 'Uploaded soundtrack'
    : liveReel?.audioUrl || 'Original audio';
  const [discCoverUrl, setDiscCoverUrl] = useState<string | undefined>(liveReel?.audioCoverUrl);

  useEffect(() => {
    let cancelled = false;
    void resolveReelDiscCoverUrl(
      liveReel,
      soundtrackUrl,
      displayMedia.type,
      displayMedia.url
    ).then((cover) => {
      if (!cancelled) setDiscCoverUrl(cover);
    });
    return () => {
      cancelled = true;
    };
  }, [
    liveReel.id,
    liveReel.audioCoverUrl,
    liveReel.audioUrl,
    liveReel.imageUrl,
    liveReel.videoUrl,
    liveReel.mediaList,
    soundtrackUrl,
    displayMedia.type,
    displayMedia.url,
  ]);

  const discImageSrc = discCoverUrl || reelAuthor.avatarUrl || undefined;
  const reelMediaActive =
    isActive &&
    isPlaying &&
    !isContentFullscreen &&
    !mediaOverlayLocked &&
    !db.isCreatorEditingActive;
  const reelInlineVideoWantsPlay =
    isActive &&
    isPlaying &&
    showVideoSlide &&
    !isContentFullscreen &&
    !mediaOverlayLocked &&
    !soundtrackUrl &&
    !db.isCreatorEditingActive &&
    !isCommentsOpen;

  const reelFsVideoWantsPlay =
    isContentFullscreen &&
    showVideoSlide &&
    !soundtrackUrl &&
    !db.isCreatorEditingActive;

  useExclusivePlayback(
    reelVideoPlaybackId,
    PLAYBACK_PRIORITY.REEL,
    reelInlineVideoWantsPlay,
    videoRef,
    'reel-inline'
  );

  useExclusivePlayback(
    reelPlaybackId(liveReel.id, 'video-fs'),
    PLAYBACK_PRIORITY.REEL_FS,
    reelFsVideoWantsPlay,
    fsVideoRef,
    'reel-fs'
  );

  const reelShowCarouselAudio =
    displayMedia.type === 'audio' && !!displayMedia.url;
  useExclusivePlayback(
    reelPlaybackId(liveReel.id, 'carousel-audio'),
    isContentFullscreen ? PLAYBACK_PRIORITY.REEL_FS : PLAYBACK_PRIORITY.REEL,
    reelMediaActive && reelShowCarouselAudio && !db.globalMuted,
    carouselAudioRef,
    isContentFullscreen ? 'reel-fs' : 'reel-inline'
  );

  useEffect(() => {
    if (wasReelActiveRef.current && !isActive) {
      resetReelPlayback(liveReel.id);
      setIsPlaying(true);
      setCurrentMediaIdx(0);
    }
    wasReelActiveRef.current = isActive;
  }, [isActive, liveReel.id]);

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    const commentData = buildCommentPayload(me, commentText);
    if (replyingTo) {
      db.addReelCommentReply(liveReel.id, replyingTo.commentId, commentData);
      setReplyingTo(null);
    } else {
      db.addReelComment(liveReel.id, commentData);
    }
    setCommentText('');
  };

  const handleCommentsClose = () => {
    setIsCommentsOpen(false);
    setReplyingTo(null);
    setCommentText('');
  };

  const handleReelClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (showVideoSlide) {
      setIsPlaying(!isPlaying);
    }
  };

  const handleOpenReelFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canOpenFullscreen) return;
    if (showVideoSlide) setIsPlaying(true);
    markReelFsOpened();
    setIsContentFullscreen(true);
  };

  const handleCloseReelFullscreen = (e?: React.MouseEvent | React.TouchEvent) => {
    if (e) e.stopPropagation();
    tryExitVideoFullscreen(videoRef.current);
    setIsContentFullscreen(false);
  };

  const handleFsTouchStart = (e: React.TouchEvent) => {
    setFsTouchEnd(null);
    setFsTouchStart(touchClientX(e.targetTouches));
  };

  const handleFsTouchMove = (e: React.TouchEvent) => {
    setFsTouchEnd(touchClientX(e.targetTouches));
  };

  const handleFsTouchEnd = () => {
    if (!fsTouchStart || !fsTouchEnd || !hasCarousel) return;
    const distance = fsTouchStart - fsTouchEnd;
    if (distance > minSwipeDistance) {
      goToNextCarouselItem();
    } else if (distance < -minSwipeDistance) {
      goToPrevCarouselItem();
    }
  };

  const filterStyle = buildMediaFilterStyle(liveReel.filter, {
    brightness: liveReel.brightness,
    contrast: liveReel.contrast,
  });

  const renderInlineReelBody = () => {
    if (isTextReel) {
      const truncated = truncateText(liveReel.caption, 220);
      return (
        <div
          className={`absolute inset-0 flex flex-col items-center justify-center p-8 ${liveReel.bg || 'bg-gradient-to-br from-indigo-500 to-purple-600'}`}
        >
          <div className="w-full max-w-md flex-1 overflow-y-auto no-scrollbar flex flex-col items-center justify-center py-4">
            <p
              className={`story-user-text editor-adaptive-text ${getFontClass(liveReel.font)} ${getAlignClass(liveReel.alignment)} ${liveReel.size || (liveReel.caption.length > 50 ? 'text-2xl' : 'text-5xl')} ${resolveEditorTextColorClass(liveReel.color)} font-black break-words w-full text-center`}
            >
              {formatMentionsAndTags(truncated.text)}
            </p>
          </div>
          {truncated.showMore && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenReelFullscreen(e);
              }}
              className="mt-4 px-6 py-2 bg-white/90 text-black rounded-full text-sm font-bold shadow-lg hover:opacity-90 transition-all active:scale-95 shrink-0 pointer-events-auto"
            >
              View full post
            </button>
          )}
        </div>
      );
    }

    if (displayMedia.type === 'audio') {
      const audioItem = liveReel.mediaList?.[currentMediaIdx];
      return (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-black/60"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col items-center justify-center p-6 bg-card/90 border border-white/10 shadow-2xl rounded-2xl w-full max-w-[300px] aspect-square relative z-10">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-white mb-3 relative overflow-hidden">
              <Music className="w-8 h-8" />
            </div>
            <p className="font-bold text-sm text-center mb-1 max-w-[240px] truncate text-white">
              {audioItem?.name || 'Audio Track'}
            </p>
            {displayMedia.url ? (
              <audio
                ref={carouselAudioRef}
                src={displayMedia.url}
                controls
                loop={loopCarouselItem}
                onEnded={loopCarouselItem ? undefined : goToNextCarouselItem}
                className="w-full accent-white focus:outline-none"
              />
            ) : (
              <p className="text-xs text-white/70">Audio unavailable</p>
            )}
          </div>
        </div>
      );
    }

    if (showVideoSlide) {
      return (
        <video
          data-playback-scope={PLAYBACK_SCOPE.MANAGED}
          ref={videoRef}
          src={displayMedia.url}
          poster={displayMedia.posterUrl}
          preload="auto"
          loop={loopCarouselItem}
          playsInline
          controls
          muted={soundtrackUrl ? true : db.globalMuted}
          onEnded={loopCarouselItem ? undefined : goToNextCarouselItem}
          onVolumeChange={(e) => {
            if (!soundtrackUrl) {
              db.setGlobalMuted(e.currentTarget.muted);
            }
          }}
          onError={(e) => {
            setVideoError(true);
            handleMediaError(e);
          }}
          style={filterStyle}
          className="absolute inset-0 w-full h-full object-cover z-10"
          {...nativeVideoControlGuardProps()}
        />
      );
    }

    return (
      <img
        key={`reel-image-${liveReel.id}-${currentMediaIdx}`}
        src={
          displayMedia.type === 'video' || videoError
            ? displayMedia.posterUrl
            : displayMedia.url
        }
        alt=""
        style={filterStyle}
        className="absolute inset-0 w-full h-full object-cover z-10 pointer-events-none"
        loading="lazy"
        onError={handleMediaError}
      />
    );
  };

  const renderFullscreenReelBody = () => (
    <FullscreenPostMediaContent
      post={reelMedia}
      livePost={liveReel}
      currentMediaIdx={currentMediaIdx}
      isTextPost={isTextReel}
      loopCarouselItem={loopCarouselItem}
      videoError={videoError}
      filterStyle={filterStyle}
      carouselAudioRef={carouselAudioRef}
      videoRef={fsVideoRef}
      globalMuted={db.globalMuted}
      onSetGlobalMuted={db.setGlobalMuted}
      soundtrackUrl={soundtrackUrl}
      postId={liveReel.id}
      postAudioIntentKey={isContentFullscreen ? 'reel-fs' : 'reel-inline'}
      postAudioPriority={
        isContentFullscreen ? PLAYBACK_PRIORITY.REEL_FS : PLAYBACK_PRIORITY.REEL
      }
      onNextCarouselItem={goToNextCarouselItem}
      onRequestNativeVideoFullscreen={() => openNativeVideoFullscreen(fsVideoRef.current)}
    />
  );
  
  return (
    <div className="w-full h-full relative snap-start snap-always overflow-hidden group">
        {/* Backdrop: video, photo, audio, or text reel */}
        {hasMedia ? (
          <MediaWithSoundtrack
            soundtrackUrl={soundtrackUrl}
            playbackId={reelSoundtrackPlaybackId}
            playbackPriority={PLAYBACK_PRIORITY.REEL}
            active={reelMediaActive}
            muted={db.globalMuted}
            className="absolute inset-0 w-full h-full z-0"
          >
            <div
              ref={mediaSwipeRef}
              className={`absolute inset-0 w-full h-full ${hasCarousel ? 'touch-pan-y' : ''}`}
              onClick={handleReelClick}
            >
              {renderInlineReelBody()}
            </div>
          </MediaWithSoundtrack>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              className={`w-32 h-32 rounded-full border-4 border-white/5 flex items-center justify-center transition-transform duration-1000 ${isActive ? 'scale-150 opacity-100' : 'scale-50 opacity-0'}`}
            >
              <FileVideo className="w-16 h-16 text-white/10" />
            </div>
          </div>
        )}

        {hasCarousel && !isFullscreenUi && (
          <>
            <div
              className="pointer-events-none absolute z-[15] max-lg:hidden flex items-center justify-between"
              style={{
                top: REEL_CAROUSEL_INSET.top,
                right: REEL_CAROUSEL_INSET.right,
                bottom: REEL_CAROUSEL_INSET.bottom,
                left: REEL_CAROUSEL_INSET.left,
              }}
            >
              <button
                type="button"
                aria-label="Previous slide"
                onClick={(e) => {
                  e.stopPropagation();
                  goToPrevCarouselItem();
                }}
                className="pointer-events-auto w-8 h-8 shrink-0 rounded-full bg-black/50 hover:bg-black/75 flex items-center justify-center text-white transition-all shadow-md active:scale-95"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                aria-label="Next slide"
                onClick={(e) => {
                  e.stopPropagation();
                  goToNextCarouselItem();
                }}
                className="pointer-events-auto w-8 h-8 shrink-0 rounded-full bg-black/50 hover:bg-black/75 flex items-center justify-center text-white transition-all shadow-md active:scale-95"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div
              className="absolute left-1/2 -translate-x-1/2 flex gap-1.5 z-[15] bg-black/30 backdrop-blur-[2px] px-2.5 py-1 rounded-full pointer-events-none"
              style={{ bottom: REEL_CAROUSEL_INSET.bottom }}
            >
              {Array.from({ length: liveReel.mediaList?.length ?? 0 }, (_, i) => (
                <div
                  key={`reel-dot-${i}`}
                  className={`w-1.5 h-1.5 rounded-full transition-all ${i === currentMediaIdx ? 'bg-white scale-110' : 'bg-white/40'}`}
                />
              ))}
            </div>
          </>
        )}

        {/* Gradient overlays */}
        <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-black/40 to-transparent pointer-events-none"></div>
        <div className="absolute bottom-0 inset-x-0 h-64 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none"></div>

        {/* Content */}
        {liveReel.textOverlay?.trim() && (
          <div
            className="dark editor-overlay-text absolute left-1/2 -translate-x-1/2 -translate-y-1/2 text-center font-black tracking-tight pointer-events-none z-20 select-none px-4 py-1.5 rounded bg-black/40 backdrop-blur-[2px] border border-white/10"
            style={{ 
              ...resolveOverlayTextStyle(liveReel.textOverlayColor),
              fontSize: `${liveReel.textOverlaySize || 22}px`,
              top: `${liveReel.textOverlayPos ?? 50}%`,
              textShadow: '0 2px 4px rgba(0,0,0,0.8), 0 0 10px rgba(0,0,0,0.5)'
            }} 
          >
            {liveReel.textOverlay}
          </div>
        )}
        <div className="dark reel-video-chrome absolute bottom-0 left-0 w-full p-4 pr-16 z-10 pointer-events-none text-foreground">
          <div className="flex items-center gap-3 mb-3 pointer-events-auto">
             <Avatar user={liveReel?.user} size="sm" className="w-10 h-10" />
             <span className="font-bold text-[15px] cursor-pointer hover:underline shadow-black drop-shadow-md" onClick={(e) => { e.stopPropagation(); openProfilePreview(reelAuthor); }}>
               <ProfileNamePrimary user={reelAuthor} fallback="Unknown User" />
             </span>
             {liveReel?.user?.id !== db?.currentUser?.id && (
               <button 
                 onClick={handleFollowToggle}
                 className={`border-2 rounded-lg px-4 py-1 text-[13px] font-bold transition-colors backdrop-blur-sm ${isFollowing ? 'border-transparent bg-white/20 text-foreground' : 'border-white/80 text-foreground hover:bg-white hover:text-black'}`}>
                 {isFollowing ? 'Following' : 'Follow'}
               </button>
             )}
          </div>
          <p 
            className={`reel-caption-text post-caption-text editor-adaptive-text ${getFontClass(liveReel.font)} ${getAlignClass(liveReel.alignment)} ${liveReel.size || 'text-[14px]'} ${resolveEditorTextColorClass(liveReel.color)} leading-tight shadow-black drop-shadow-md mb-2 pointer-events-auto`}
          >
            {formatMentionsAndTags(liveReel.caption)}
          </p>
          {liveReel.createdAt ? (
            <time
              dateTime={contentTimestampIso(liveReel.createdAt)}
              className="block text-[11px] text-white/80 font-medium mb-3 pointer-events-auto drop-shadow-md"
            >
              {formatContentDateTime(liveReel.createdAt)}
            </time>
          ) : null}
          <div className="flex items-center gap-2 text-foreground/90 text-xs font-bold px-3 py-1.5 bg-black/30 rounded-full w-max backdrop-blur-md pointer-events-auto">
             <MusicIcon className="w-3 h-3 animate-pulse" />
             <span className="marquee-text overflow-hidden max-w-[150px] whitespace-nowrap">{soundtrackLabel}</span>
          </div>
        </div>

        {/* Sidebar Actions */}
        <div
          className="reel-video-chrome absolute bottom-4 right-2 flex flex-col items-center gap-5 z-20 pb-safe text-white"
          style={{ color: '#ffffff' }}
        >
            <button 
              onClick={(e) => { 
                e.stopPropagation(); 
                db.toggleReelLike(liveReel.id); 
              }}
              className="flex flex-col items-center gap-1 text-white hover:opacity-80 transition-transform active:scale-90"
              style={{ color: '#ffffff' }}
            >
                <div className="p-2.5 bg-black/20 rounded-full backdrop-blur-sm">
                  <Heart 
                    fill={liveReel.isLiked ? 'currentColor' : 'none'}
                    className={`w-7 h-7 ${liveReel.isLiked ? 'text-red-500 stroke-red-500' : 'stroke-white stroke-[2px] text-transparent'}`} 
                  />
                </div>
                <span className={REEL_STAT_LABEL_CLASS} style={REEL_STAT_LABEL_STYLE}>{(liveReel?.likes || 0).toLocaleString()}</span>
            </button>
            <button 
              onClick={() => setIsCommentsOpen(true)}
              className="flex flex-col items-center gap-1 text-white hover:opacity-80 transition-transform active:scale-90"
              style={{ color: '#ffffff' }}
            >
                <div className="p-2.5 bg-black/20 rounded-full backdrop-blur-sm">
                  <MessageCircle className="w-7 h-7 stroke-[2px] stroke-white" />
                </div>
                <span className={REEL_STAT_LABEL_CLASS} style={REEL_STAT_LABEL_STYLE}>{(liveReel?.comments || 0).toLocaleString()}</span>
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); setShowShareModal(true); }}
              className="flex flex-col items-center gap-1 text-white hover:opacity-80 transition-transform active:scale-90"
              style={{ color: '#ffffff' }}
            >
                <div className="p-2.5 bg-black/20 rounded-full backdrop-blur-sm">
                  <ShareIcon size="lg" tone="light" />
                </div>
                <span className={REEL_STAT_LABEL_CLASS} style={REEL_STAT_LABEL_STYLE}>{(reel?.shares || 0).toLocaleString()}</span>
            </button>
            <button 
                onClick={(e) => {
                  e.stopPropagation();
                  db.toggleReelSave(liveReel.id);
                }}
                className="flex flex-col items-center gap-1 text-white hover:opacity-80 transition-transform active:scale-90"
                style={{ color: '#ffffff' }}
            >
                <div className="p-2.5 bg-black/20 rounded-full backdrop-blur-sm">
                  <Bookmark 
                    fill={liveReel.isSaved ? 'currentColor' : 'none'}
                    className={`w-6 h-6 stroke-[2px] ${liveReel.isSaved ? 'text-white' : 'stroke-white text-transparent'}`} 
                  />
                </div>
            </button>
            <button 
                onClick={(e) => {
                  e.stopPropagation();
                  db.setGlobalMuted(!db.globalMuted);
                }}
                className="flex flex-col items-center gap-1 hover:opacity-80 transition-transform active:scale-90"
                title={db.globalMuted ? "Unmute" : "Mute"}
            >
                <div className="p-2.5 bg-black/20 rounded-full backdrop-blur-sm">
                  {db.globalMuted ? (
                    <VolumeX className="w-6 h-6 stroke-[2px] stroke-white" />
                  ) : (
                    <Volume2 className="w-6 h-6 stroke-[2px] stroke-white" />
                  )}
                </div>
            </button>
            {canOpenFullscreen && (
              <button
                onClick={handleOpenReelFullscreen}
                className="flex flex-col items-center gap-1 hover:opacity-80 transition-transform active:scale-90"
                title="Fullscreen"
              >
                <div className="p-2.5 bg-black/20 rounded-full backdrop-blur-sm">
                  <Maximize2 className="w-6 h-6 stroke-[2px] stroke-white" />
                </div>
              </button>
            )}
            <div className="relative">
              <button 
                  onClick={(e) => { e.stopPropagation(); setShowOptionsModal(!showOptionsModal); }}
                  className="flex flex-col items-center gap-1 hover:opacity-80 transition-transform active:scale-90 mt-2 relative z-10"
              >
                  <MoreHorizontal className="w-6 h-6 stroke-white" />
              </button>
              
              <AnimatePresence>
                {showOptionsModal && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setShowOptionsModal(false); }}></div>
                    <motion.div
                      role="menu"
                      initial={{ opacity: 0, scale: 0.95, x: 10 }}
                      animate={{ opacity: 1, scale: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.95, x: 10 }}
                      onMouseLeave={() => setHoveredMenuItem(null)}
                      className="absolute right-full bottom-0 mb-0 mr-4 w-48 min-w-[12rem] bg-black/80 backdrop-blur-xl border border-white/10 rounded-xl flex flex-col gap-1 p-1.5 z-50 shadow-2xl overflow-hidden pointer-events-auto"
                    >
                      {liveReel.user?.id === db.currentUser?.id
                        ? renderReelMenuButton('delete', 'Delete Reel', 'danger', () => {
                            db.deleteReel(liveReel.id);
                            showToast('Reel deleted');
                          })
                        : renderReelMenuButton('report', 'Report', 'danger', () => {
                            showToast('Reel reported');
                          })}
                      {renderReelMenuButton('favorite', 'Add to favorites', 'default', () => {
                        if (!liveReel.isSaved) db.toggleReelSave(liveReel.id);
                        showToast('Added to favorites');
                      })}
                      {renderReelMenuButton('copy', 'Copy link', 'default', () => {
                        navigator.clipboard.writeText(sharePayload.shareUrl);
                        showToast('Link copied');
                      })}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
            
            <div className="relative mt-4 w-9 h-9 shrink-0">
              {isActive && (
                <>
                  <span className="reel-disc-music-note reel-disc-music-note--1" aria-hidden>
                    <Music className="w-3 h-3 stroke-[2.5px]" />
                  </span>
                  <span className="reel-disc-music-note reel-disc-music-note--2" aria-hidden>
                    <Music className="w-2.5 h-2.5 stroke-[2.5px]" />
                  </span>
                  <span className="reel-disc-music-note reel-disc-music-note--3" aria-hidden>
                    <Music className="w-2 h-2 stroke-[2.5px]" />
                  </span>
                </>
              )}
              <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-white flex items-center justify-center bg-zinc-900 group cursor-pointer relative">
                <img
                  src={discImageSrc}
                  alt={soundtrackLabel}
                  className={`w-full h-full object-cover ${isActive ? 'animate-[spin_4s_linear_infinite]' : ''}`}
                  onError={handleAvatarError}
                />
                <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
              </div>
            </div>
        </div>

        <ReelsCommentsDrawer
          isOpen={isCommentsOpen}
          onClose={handleCommentsClose}
          liveReel={liveReel}
          localComments={localComments}
          db={db}
          USERS={USERS}
          commentText={commentText}
          onCommentTextChange={setCommentText}
          onSubmit={handleCommentSubmit}
          replyingTo={replyingTo}
          setReplyingTo={setReplyingTo}
          commentInputRef={commentInputRef}
          me={me}
        />

        <ReelContentFullscreenPortal
          isOpen={isContentFullscreen}
          fullscreenSwipeRef={fullscreenSwipeRef}
          hasCarousel={hasCarousel}
          currentMediaIdx={currentMediaIdx}
          carouselLength={liveReel.mediaList?.length ?? 0}
          onClose={() => handleCloseReelFullscreen()}
          shouldIgnoreBackdropClose={shouldIgnoreReelFsBackdropClose}
          onTouchStart={handleFsTouchStart}
          onTouchMove={handleFsTouchMove}
          onTouchEnd={handleFsTouchEnd}
          onPrevCarouselItem={goToPrevCarouselItem}
          onNextCarouselItem={goToNextCarouselItem}
        >
          {renderFullscreenReelBody()}
        </ReelContentFullscreenPortal>

        <ShareModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          shareUrl={sharePayload.shareUrl}
          itemTitle={sharePayload.itemTitle}
          shareText={sharePayload.shareText}
          kind={sharePayload.kind}
          notificationText={sharePayload.notificationText}
        />
    </div>
  );
}

function MusicIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
  );
}
