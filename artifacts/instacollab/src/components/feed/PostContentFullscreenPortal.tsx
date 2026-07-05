import React from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Post as PostType } from '../../types';
import { buildMediaFilterStyle } from '../../lib/mediaFilters';
import { resolveEditorSoundtrackUrl } from '../../lib/audioMedia';
import { resolvePostDisplayMedia } from '../../lib/safe';
import { openNativeVideoFullscreen } from '../../lib/useNativeVideoFullscreen';
import { PLAYBACK_PRIORITY } from '../../lib/playbackAudio';
import { FullscreenPostMediaContent } from '../common/FullscreenPostMediaContent';
import {
  FULLSCREEN_MEDIA_CLOSE_CLASS,
  FULLSCREEN_MEDIA_DOTS_CLASS,
  FULLSCREEN_MEDIA_NAV_CLASS,
  FULLSCREEN_MEDIA_OVERLAY_CLASS,
  FullscreenMediaStage,
} from '../common/FullscreenMediaStage';

type ResolvedPost = ReturnType<typeof import('../../lib/entityResolve').resolvePost>;

export type PostContentFullscreenPortalProps = {
  isOpen: boolean;
  post: PostType;
  livePost: ResolvedPost;
  currentMediaIdx: number;
  isTextPost: boolean;
  loopCarouselItem: boolean;
  videoError: boolean;
  carouselAudioRef: React.RefObject<HTMLAudioElement | null>;
  fsVideoRef: React.Ref<HTMLVideoElement | null>;
  globalMuted: boolean;
  onSetGlobalMuted: (muted: boolean) => void;
  postAudioIntentKey: string;
  postAudioPriority: (typeof PLAYBACK_PRIORITY)[keyof typeof PLAYBACK_PRIORITY];
  /** Wrapper post id for playback coordinator alignment (e.g. repost modal). */
  playbackPostId?: string;
  onClose: () => void;
  shouldIgnoreBackdropClose?: () => boolean;
  onRequestNativeVideoFullscreen?: () => void;
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: () => void;
  onPrevCarouselItem: () => void;
  onNextCarouselItem: () => void;
};

export function PostContentFullscreenPortal({
  isOpen,
  post,
  livePost,
  currentMediaIdx,
  isTextPost,
  loopCarouselItem,
  videoError,
  carouselAudioRef,
  fsVideoRef,
  globalMuted,
  onSetGlobalMuted,
  postAudioIntentKey,
  postAudioPriority,
  playbackPostId,
  onClose,
  shouldIgnoreBackdropClose,
  onRequestNativeVideoFullscreen,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onPrevCarouselItem,
  onNextCarouselItem,
}: PostContentFullscreenPortalProps) {
  if (!isOpen || typeof document === 'undefined') return null;

  const fsFilterStyle = buildMediaFilterStyle(post?.filter, {
    brightness: post?.brightness,
    contrast: post?.contrast,
  });
  const displayMedia = isTextPost ? null : resolvePostDisplayMedia(post, currentMediaIdx);
  const soundtrackUrl = displayMedia
    ? resolveEditorSoundtrackUrl(livePost.audioUrl, displayMedia.type)
    : undefined;

  return createPortal(
    <div
      id="media-full-screen-modal"
      data-media-fullscreen="true"
      className={FULLSCREEN_MEDIA_OVERLAY_CLASS}
      onWheel={(e) => e.stopPropagation()}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <button
        type="button"
        onClick={onClose}
        className={FULLSCREEN_MEDIA_CLOSE_CLASS}
        title="Close Full Screen"
      >
        <X className="w-7 h-7 sm:w-8 sm:h-8" />
      </button>

      {(post.mediaList || []).length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPrevCarouselItem();
            }}
            className={`${FULLSCREEN_MEDIA_NAV_CLASS} left-[max(0.75rem,env(safe-area-inset-left,0px))]`}
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onNextCarouselItem();
            }}
            className={`${FULLSCREEN_MEDIA_NAV_CLASS} right-[max(0.75rem,env(safe-area-inset-right,0px))]`}
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}

      <FullscreenMediaStage
        onBackdropClick={onClose}
        shouldIgnoreBackdropClose={shouldIgnoreBackdropClose}
      >
        <FullscreenPostMediaContent
          post={post}
          livePost={livePost}
          currentMediaIdx={currentMediaIdx}
          isTextPost={isTextPost}
          loopCarouselItem={loopCarouselItem}
          videoError={videoError}
          filterStyle={fsFilterStyle}
          carouselAudioRef={carouselAudioRef}
          videoRef={fsVideoRef}
          globalMuted={globalMuted}
          onSetGlobalMuted={onSetGlobalMuted}
          soundtrackUrl={soundtrackUrl}
          postId={playbackPostId ?? livePost.id}
          postAudioIntentKey={postAudioIntentKey}
          postAudioPriority={postAudioPriority}
          onNextCarouselItem={onNextCarouselItem}
          onRequestNativeVideoFullscreen={
            onRequestNativeVideoFullscreen ??
            (() =>
              openNativeVideoFullscreen(
                typeof fsVideoRef !== 'function' ? fsVideoRef?.current ?? null : null
              ))
          }
        />
      </FullscreenMediaStage>

      {post.mediaList && post.mediaList.length > 1 && (
        <div className={FULLSCREEN_MEDIA_DOTS_CLASS}>
          {post.mediaList.map((_, i) => (
            <div
              key={`fs-dot-${i}`}
              className={`w-2 h-2 rounded-full transition-all ${i === currentMediaIdx ? 'bg-white scale-110' : 'bg-white/40'}`}
            />
          ))}
        </div>
      )}
    </div>,
    document.body
  );
}
