import React from 'react';
import { Heart, VolumeX, Volume2, Maximize2, ChevronLeft, ChevronRight, Music } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Post as PostType } from '../../types';
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
import { PLAYBACK_PRIORITY, setPlaybackIntent } from '../../lib/playbackAudio';
import { buildMediaFilterStyle } from '../../lib/mediaFilters';
import { postPlaybackId } from '../../lib/postPlayback';

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
}: PostMediaStageProps) {
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

    const style = buildMediaFilterStyle(post.filter, {
      brightness: post.brightness,
      contrast: post.contrast,
    });

    const displayMedia = resolvePostDisplayMedia(post, currentMediaIdx);
    const imageSrc =
      displayMedia.type === 'video' || videoError || displayMedia.showAsImage
        ? displayMedia.posterUrl
        : displayMedia.url;
    const showVideo =
      displayMedia.type === 'video' && !videoError && !displayMedia.showAsImage;
    const soundtrackUrl = resolveEditorSoundtrackUrl(
      livePost.audioUrl,
      displayMedia.type
    );

    if (showVideo) {
      return (
        <MediaWithSoundtrack
          className="relative w-full h-full"
          style={{
            backgroundImage: `url(${displayMedia.posterUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <video
            data-playback-scope={PLAYBACK_SCOPE.MANAGED}
            ref={videoRef}
            src={displayMedia.url}
            poster={displayMedia.posterUrl}
            data-poster={displayMedia.posterUrl}
            loop={loopCarouselItem}
            playsInline
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
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const clickY = e.clientY - rect.top;
              if (clickY > rect.height - 60) {
                e.stopPropagation();
                return;
              }
              e.stopPropagation();
              const v = videoRef.current;
              if (!v) return;
              const videoPlaybackId = postPlaybackId(livePost.id, 'video');
              if (v.paused) {
                setPlaybackIntent(
                  videoPlaybackId,
                  postAudioIntentKey,
                  postAudioPriority,
                  true
                );
              } else {
                setPlaybackIntent(
                  videoPlaybackId,
                  postAudioIntentKey,
                  postAudioPriority,
                  false
                );
                v.pause();
              }
            }}
            controls
            preload="auto"
            style={style}
            className="w-full h-full object-cover z-10 bg-black/30"
          />
          {!hideVideoControls && (
            <div className="absolute bottom-4 right-4 z-20 flex gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenFullscreen(e);
                }}
                className="p-2.5 bg-black/60 hover:bg-black/80 rounded-full text-white transition-all shadow-md active:scale-95"
                title="Fullscreen"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSetGlobalMuted(!globalMuted);
                }}
                className="p-2.5 bg-black/60 hover:bg-black/80 rounded-full text-white transition-all shadow-md active:scale-95"
                title={globalMuted ? 'Unmute' : 'Mute'}
              >
                {globalMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>
          )}
        </MediaWithSoundtrack>
      );
    }

    if (displayMedia.type === 'audio') {
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
          {displayMedia.url ? (
            <audio
              ref={carouselAudioRef}
              src={displayMedia.url}
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
      <MediaWithSoundtrack>
        <img
          src={imageSrc}
          alt="Post content"
          style={style}
          className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500 z-10 pointer-events-none"
          loading="lazy"
          onError={handleMediaError}
        />
      </MediaWithSoundtrack>
    );
  };

  return (
    <>
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
    </>
  );
}
