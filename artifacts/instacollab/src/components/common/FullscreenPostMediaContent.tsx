import React, { type CSSProperties, type Ref, type RefObject } from 'react';
import { Music } from 'lucide-react';
import { Post as PostType, Reel } from '../../types';
import { useResolvedMediaUrl } from '../../hooks/useResolvedMediaUrl';
import {
  formatMentionsAndTags,
  getAlignClass,
  getFontClass,
  handleMediaError,
  resolveEditorTextColorClass,
} from '../../lib/utils';
import { resolvePostDisplayMedia, preserveMediaRef } from '../../lib/safe';
import { MediaWithSoundtrack } from './MediaWithSoundtrack';
import { FULLSCREEN_MEDIA_CLASS } from './FullscreenMediaStage';
import { PLAYBACK_SCOPE } from '../../lib/playbackScope';
import { PLAYBACK_PRIORITY } from '../../lib/playbackAudio';
import { nativeVideoControlGuardProps } from '../../lib/nativeVideoControls';

type ResolvedPost = ReturnType<typeof import('../../lib/entityResolve').resolvePost>;

type PlaybackPriority = (typeof PLAYBACK_PRIORITY)[keyof typeof PLAYBACK_PRIORITY];

/** When set (e.g. post modal / comment attachment), render this URL instead of post carousel index. */
export type FullscreenMediaOverride = {
  url: string;
  type: 'image' | 'video' | 'audio';
  posterUrl?: string;
  name?: string;
};

export type FullscreenPostMediaContentProps = {
  post: PostType | Reel;
  livePost: ResolvedPost | Reel;
  currentMediaIdx: number;
  mediaOverride?: FullscreenMediaOverride;
  isTextPost: boolean;
  loopCarouselItem: boolean;
  videoError: boolean;
  filterStyle?: CSSProperties;
  carouselAudioRef?: RefObject<HTMLAudioElement | null>;
  videoRef?: Ref<HTMLVideoElement | null>;
  globalMuted?: boolean;
  onSetGlobalMuted?: (muted: boolean) => void;
  soundtrackUrl?: string;
  postId?: string;
  postAudioIntentKey?: string;
  postAudioPriority?: PlaybackPriority;
  onNextCarouselItem?: () => void;
  onRequestNativeVideoFullscreen?: () => void;
};

export function FullscreenPostMediaContent({
  post,
  livePost,
  currentMediaIdx,
  mediaOverride,
  isTextPost,
  loopCarouselItem,
  videoError,
  filterStyle,
  carouselAudioRef,
  videoRef,
  globalMuted = false,
  onSetGlobalMuted,
  soundtrackUrl,
  postId,
  postAudioIntentKey = 'fs',
  postAudioPriority,
  onNextCarouselItem,
  onRequestNativeVideoFullscreen,
}: FullscreenPostMediaContentProps) {
  const resolvedFromPost = resolvePostDisplayMedia(post as PostType, currentMediaIdx);
  const posterFallback =
    mediaOverride?.posterUrl ??
    resolvedFromPost.posterUrl ??
    preserveMediaRef((post as PostType).imageUrl);
  const fsMedia = isTextPost
    ? null
    : mediaOverride
      ? (() => {
          if (mediaOverride.type === 'video') {
            const videoUrl = preserveMediaRef(mediaOverride.url);
            if (!videoUrl) {
              return {
                type: 'image' as const,
                url: posterFallback,
                posterUrl: posterFallback,
                showAsImage: true,
              };
            }
            return {
              type: 'video' as const,
              url: videoUrl,
              posterUrl: posterFallback,
              showAsImage: false,
            };
          }
          if (mediaOverride.type === 'audio') {
            return {
              type: 'audio' as const,
              url: preserveMediaRef(mediaOverride.url),
              posterUrl: posterFallback,
              showAsImage: false,
            };
          }
          return {
            type: 'image' as const,
            url: preserveMediaRef(mediaOverride.url) || posterFallback,
            posterUrl: posterFallback,
            showAsImage: false,
          };
        })()
      : resolvedFromPost;
  const resolvedFsUrl = useResolvedMediaUrl(fsMedia?.url);
  const resolvedFsPoster = useResolvedMediaUrl(fsMedia?.posterUrl);

  if (isTextPost) {
    return (
      <div
        className={`w-full max-w-2xl h-full max-h-[80vh] flex flex-col items-center justify-center p-12 ${livePost.bg && !livePost.bg.includes('bg-secondary') ? livePost.bg : 'bg-background'} rounded-3xl relative shadow-2xl border border-border/50`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-full flex-1 overflow-y-auto no-scrollbar flex flex-col items-center justify-center py-6">
          <p
            className={`story-user-text editor-adaptive-text ${getFontClass(livePost.font)} ${getAlignClass(livePost.alignment)} ${livePost.size || (livePost.caption.length > 50 ? 'text-3xl' : 'text-6xl')} ${resolveEditorTextColorClass(livePost.color)} font-black break-words w-full`}
          >
            {formatMentionsAndTags(livePost.caption)}
          </p>
        </div>
      </div>
    );
  }

  if (!fsMedia) return null;

  const fsImageSrc =
    fsMedia.type === 'video' || videoError || fsMedia.showAsImage
      ? resolvedFsPoster || fsMedia.posterUrl
      : resolvedFsUrl || fsMedia.url;
  const fsAudioList = post.mediaList || [];
  const fsAudioItem = mediaOverride?.name
    ? { name: mediaOverride.name }
    : fsAudioList[currentMediaIdx];
  const showVideo =
    fsMedia.type === 'video' &&
    !videoError &&
    !fsMedia.showAsImage &&
    !!(resolvedFsUrl || fsMedia.url);
  const playbackPostId = postId ?? livePost.id;

  if (fsMedia.type === 'audio') {
    return (
      <div
        className="flex flex-col items-center justify-center p-8 bg-card border border-border shadow-2xl rounded-2xl w-full max-w-[320px] aspect-square relative z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4 relative overflow-hidden animate-pulse">
          <Music className="w-10 h-10 animate-bounce" />
          <div className="absolute inset-0 border-2 border-dashed border-primary/20 rounded-full animate-spin [animation-duration:10s]" />
        </div>
        <p className="font-bold text-sm text-center mb-1 max-w-[280px] truncate">
          {fsAudioItem?.name || 'Audio Track'}
        </p>
        <p className="text-xs text-muted-foreground mb-4 font-mono">Audio Track</p>
        {fsMedia.url ? (
          <audio
            ref={carouselAudioRef}
            src={resolvedFsUrl || fsMedia.url || undefined}
            controls
            loop={loopCarouselItem}
            onEnded={loopCarouselItem ? undefined : onNextCarouselItem}
            className="w-full scale-95 accent-primary focus:outline-none"
          />
        ) : (
          <p className="text-xs text-muted-foreground">Audio unavailable</p>
        )}
      </div>
    );
  }

  if (showVideo && (resolvedFsUrl || fsMedia.url)) {
    const poster = resolvedFsPoster || fsMedia.posterUrl || undefined;
    return (
      <MediaWithSoundtrack className="inline-flex max-w-full">
        <video
          key={`fs-vid-${currentMediaIdx}`}
          data-playback-scope={PLAYBACK_SCOPE.MANAGED}
          ref={videoRef}
          src={resolvedFsUrl || fsMedia.url || undefined}
          poster={poster}
          data-poster={poster}
          loop={loopCarouselItem}
          playsInline
          controls
          preload="auto"
          muted={soundtrackUrl ? true : globalMuted}
          style={filterStyle}
          className={`${FULLSCREEN_MEDIA_CLASS} z-10 bg-black`}
          onError={handleMediaError}
          onEnded={loopCarouselItem ? undefined : onNextCarouselItem}
          onVolumeChange={(e) => {
            if (!soundtrackUrl && onSetGlobalMuted) {
              onSetGlobalMuted(e.currentTarget.muted);
            }
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            onRequestNativeVideoFullscreen?.();
          }}
          {...nativeVideoControlGuardProps()}
        />
      </MediaWithSoundtrack>
    );
  }

  return (
    <MediaWithSoundtrack className="inline-flex max-w-full">
      <img
        key={`fs-img-${currentMediaIdx}`}
        src={fsImageSrc || undefined}
        alt="Post content"
        style={filterStyle}
        className={`${FULLSCREEN_MEDIA_CLASS} z-10`}
        onError={handleMediaError}
      />
    </MediaWithSoundtrack>
  );
}
