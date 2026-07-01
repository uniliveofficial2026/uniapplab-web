import React from 'react';
import { Heart, ChevronLeft, ChevronRight, Music } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Post as PostType } from '../../types';
import { useResolvedMediaUrl } from '../../hooks/useResolvedMediaUrl';
import {
  getFontClass,
  getAlignClass,
  truncateText,
  resolveEditorTextColorClass,
  resolveOverlayTextStyle,
  formatMentionsAndTags,
  handleMediaError,
} from '../../lib/utils';
import { resolvePostDisplayMedia } from '../../lib/safe';
import { resolveEditorSoundtrackUrl } from '../../lib/audioMedia';
import { MediaWithSoundtrack } from '../common/MediaWithSoundtrack';
import { PLAYBACK_SCOPE } from '../../lib/playbackScope';
import { PLAYBACK_PRIORITY } from '../../lib/playbackAudio';
import { buildMediaFilterStyle } from '../../lib/mediaFilters';
import { nativeVideoControlGuardProps } from '../../lib/nativeVideoControls';

type ResolvedPost = ReturnType<typeof import('../../lib/entityResolve').resolvePost>;

export type PostMediaStageProps = {
  post: PostType;
  livePost: ResolvedPost;
  isTextPost: boolean;
  currentMediaIdx: number;
  videoError: boolean;
  setVideoError: (value: boolean) => void;
  loopCarouselItem: boolean;
  hideVideoControls?: boolean;
  showHeartAnimation: boolean;
  onShowFullCaption: () => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  carouselAudioRef: React.RefObject<HTMLAudioElement | null>;
  globalMuted: boolean;
  onSetGlobalMuted: (muted: boolean) => void;
  onOpenFullscreen: (e?: React.MouseEvent) => void;
  onPrevCarouselItem: () => void;
  onNextCarouselItem: () => void;
  postAudioIntentKey: string;
  postAudioPriority: (typeof PLAYBACK_PRIORITY)[keyof typeof PLAYBACK_PRIORITY];
  /** Defaults to livePost.id — set to wrapper post id in modals for coordinator alignment. */
  playbackPostId?: string;
  /** Feed cards use cover; post modal uses contain to match non-repost modal media. */
  mediaObjectFit?: 'cover' | 'contain';
  /** When true, video taps bubble to parent (single-tap fullscreen) except native control bar. */
  deferVideoTapToParent?: boolean;
};

export function PostMediaStage({
  post,
  livePost,
  isTextPost,
  currentMediaIdx,
  videoError,
  setVideoError,
  loopCarouselItem,
  hideVideoControls,
  showHeartAnimation,
  onShowFullCaption,
  videoRef,
  carouselAudioRef,
  globalMuted,
  onSetGlobalMuted,
  onOpenFullscreen,
  onPrevCarouselItem,
  onNextCarouselItem,
  postAudioIntentKey,
  postAudioPriority,
  playbackPostId: playbackPostIdProp,
  mediaObjectFit = 'cover',
  deferVideoTapToParent = false,
}: PostMediaStageProps) {
  const playbackPostId = playbackPostIdProp ?? livePost.id;
  const displayMedia = !isTextPost ? resolvePostDisplayMedia(post, currentMediaIdx) : null;
  const resolvedMediaUrl = useResolvedMediaUrl(displayMedia?.url);
  const resolvedPosterUrl = useResolvedMediaUrl(displayMedia?.posterUrl);
  const isVideoSlide =
    !!displayMedia &&
    displayMedia.type === 'video' &&
    !videoError &&
    !displayMedia.showAsImage &&
    !!(resolvedMediaUrl || displayMedia.url);

  const mediaFitClass =
    mediaObjectFit === 'contain' ? 'object-contain' : 'object-cover';
  const renderMediaContent = () => {
    if (isTextPost) {
      const truncated = truncateText(post.caption, 180);
      return (
        <div className={`w-full h-full flex flex-col items-center justify-center p-8 ${post.bg || 'bg-gradient-to-br from-indigo-500 to-purple-600'} rounded-xl relative`}>
          <div className="w-full flex-1 overflow-y-auto no-scrollbar flex flex-col items-center justify-center py-4">
            <p className={`story-user-text editor-adaptive-text ${getFontClass(post.font)} ${getAlignClass(post.alignment)} ${post.size || (post.caption.length > 50 ? 'text-2xl' : 'text-5xl')} ${resolveEditorTextColorClass(post.color)} font-black break-words w-full`}>
              {formatMentionsAndTags(truncated.text)}
            </p>
          </div>
          {truncated.showMore && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onShowFullCaption();
              }}
              className="mt-4 px-6 py-2 bg-foreground text-background border border-border rounded-full text-sm font-bold shadow-lg hover:opacity-90 transition-all active:scale-95 shrink-0"
            >
              more view...
            </button>
          )}
        </div>
      );
    }

    const displayMediaResolved = displayMedia!;
    const style = buildMediaFilterStyle(post.filter, {
      brightness: post.brightness,
      contrast: post.contrast,
    });

    const posterSrc = resolvedPosterUrl || displayMediaResolved.posterUrl || '';
    const imageSrc =
      displayMediaResolved.type === 'video' || videoError || displayMediaResolved.showAsImage
        ? posterSrc
        : resolvedMediaUrl || displayMediaResolved.url;
    const showVideo = isVideoSlide;
    const soundtrackUrl = resolveEditorSoundtrackUrl(
      livePost.audioUrl,
      displayMediaResolved.type
    );

    if (showVideo) {
      return (
        <MediaWithSoundtrack
          className="relative w-full h-full bg-black"
          style={
            posterSrc
              ? {
                  backgroundImage: `url(${posterSrc})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }
              : undefined
          }
        >
          <video
            data-playback-scope={PLAYBACK_SCOPE.MANAGED}
            ref={videoRef}
            src={resolvedMediaUrl || displayMediaResolved.url || undefined}
            poster={posterSrc || undefined}
            data-poster={posterSrc || undefined}
            loop={loopCarouselItem}
            playsInline
            controls
            muted={soundtrackUrl ? true : globalMuted}
            onEnded={loopCarouselItem ? undefined : onNextCarouselItem}
            onVolumeChange={(e) => {
              if (!soundtrackUrl) {
                onSetGlobalMuted(e.currentTarget.muted);
              }
            }}
            onError={(e) => {
              setVideoError(true);
              handleMediaError(e);
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              onOpenFullscreen();
            }}
            {...nativeVideoControlGuardProps()}
            preload="auto"
            style={style}
            className={`w-full h-full ${mediaFitClass} z-10 bg-black/30`}
          />
        </MediaWithSoundtrack>
      );
    }

    if (displayMediaResolved.type === 'audio') {
      const audioList = post.mediaList || [];
      const audioItem = audioList[currentMediaIdx];
      return (
        <div
          className="flex flex-col items-center justify-center p-6 bg-card border border-border shadow-md rounded-2xl w-full max-w-[280px] aspect-square relative z-10"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-3 relative overflow-hidden animate-pulse">
            <Music className="w-8 h-8 animate-bounce" />
            <div className="absolute inset-0 border-2 border-dashed border-primary/20 rounded-full animate-spin [animation-duration:10s]" />
          </div>
          <p className="font-bold text-xs text-center mb-1 max-w-[240px] truncate">{audioItem?.name || 'Audio Track'}</p>
          <p className="text-[10px] text-muted-foreground mb-3 font-mono">Audio Track</p>
          {resolvedMediaUrl || displayMediaResolved.url ? (
            <audio
              ref={carouselAudioRef}
              src={resolvedMediaUrl || undefined}
              controls
              loop={loopCarouselItem}
              onEnded={loopCarouselItem ? undefined : onNextCarouselItem}
              className="w-full scale-90 accent-primary focus:outline-none"
            />
          ) : (
            <p className="text-xs text-muted-foreground">Audio unavailable</p>
          )}
        </div>
      );
    }

    return (
      <MediaWithSoundtrack className="relative w-full h-full">
        <img
          src={imageSrc || undefined}
          alt="Post content"
          style={style}
          className={`w-full h-full ${mediaFitClass} group-hover:scale-[1.02] transition-transform duration-500 z-10 pointer-events-none`}
          loading="lazy"
          onError={handleMediaError}
        />
      </MediaWithSoundtrack>
    );
  };

  return (
    <div className="relative w-full h-full min-h-0">
      {renderMediaContent()}

      {post.mediaList && post.mediaList.length > 1 && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPrevCarouselItem();
            }}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/75 hidden lg:flex items-center justify-center text-white transition-all z-30 shadow-md active:scale-95"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNextCarouselItem();
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/75 hidden lg:flex items-center justify-center text-white transition-all z-30 shadow-md active:scale-95"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-30 bg-black/30 backdrop-blur-[2px] px-2.5 py-1 rounded-full">
            {post.mediaList.map((_, i) => (
              <div
                key={`dot-${i}`}
                className={`w-1.5 h-1.5 rounded-full transition-all ${i === currentMediaIdx ? 'bg-white scale-110' : 'bg-white/40'}`}
              />
            ))}
          </div>
        </>
      )}

      {post.textOverlay?.trim() && (
        <div
          style={{
            ...resolveOverlayTextStyle(post.textOverlayColor),
            fontSize: `${post.textOverlaySize || 20}px`,
            top: `${post.textOverlayPos ?? 50}%`,
            textShadow: '0 2px 4px rgba(0,0,0,0.8), 0 0 10px rgba(0,0,0,0.5)',
          }}
          className="dark editor-overlay-text absolute left-1/2 -translate-x-1/2 -translate-y-1/2 text-center font-black tracking-tight pointer-events-none z-20 select-none px-4 py-1.5 rounded bg-black/40 backdrop-blur-[2px] border border-white/10"
        >
          {post.textOverlay}
        </div>
      )}

      <AnimatePresence>
        {showHeartAnimation && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
          >
            <Heart className="w-32 h-32 fill-current text-red-500 stroke-red-500 drop-shadow-[0_0_20px_rgba(0,0,0,0.5)]" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
