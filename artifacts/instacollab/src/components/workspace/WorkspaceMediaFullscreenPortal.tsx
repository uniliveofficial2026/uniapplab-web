import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { handleMediaError } from '../../lib/utils';
import { touchClientX } from '../../lib/safe';
import { nativeVideoControlGuardProps } from '../../lib/nativeVideoControls';
import {
  FULLSCREEN_MEDIA_CLASS,
  FULLSCREEN_MEDIA_CLOSE_CLASS,
  FULLSCREEN_MEDIA_DOTS_CLASS,
  FULLSCREEN_MEDIA_NAV_CLASS,
  FULLSCREEN_MEDIA_OVERLAY_CLASS,
  FullscreenMediaStage,
} from '../common/FullscreenMediaStage';

export type WorkspaceFullscreenMedia = {
  items: Array<{ url: string; isVideo?: boolean }>;
  mediaIndex: number;
};

type WorkspaceMediaFullscreenPortalProps = {
  fullscreenMedia: WorkspaceFullscreenMedia;
  onClose: () => void;
  onMediaIndexChange: (mediaIndex: number) => void;
  taskVideoRefs: React.MutableRefObject<Map<number, HTMLVideoElement>>;
};

export function WorkspaceMediaFullscreenPortal({
  fullscreenMedia,
  onClose,
  onMediaIndexChange,
  taskVideoRefs,
}: WorkspaceMediaFullscreenPortalProps) {
  const [fsTouchStart, setFsTouchStart] = useState<number | null>(null);
  const [fsTouchEnd, setFsTouchEnd] = useState<number | null>(null);
  const minSwipeDistance = 50;

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
    if (!isLeftSwipe && !isRightSwipe) return;
    if (fullscreenMedia.items.length <= 1) return;
    if (isLeftSwipe) {
      onMediaIndexChange(
        fullscreenMedia.mediaIndex === fullscreenMedia.items.length - 1
          ? 0
          : fullscreenMedia.mediaIndex + 1
      );
    } else {
      onMediaIndexChange(
        fullscreenMedia.mediaIndex === 0
          ? fullscreenMedia.items.length - 1
          : fullscreenMedia.mediaIndex - 1
      );
    }
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      id="workspace-fs-modal"
      data-media-fullscreen="true"
      className={FULLSCREEN_MEDIA_OVERLAY_CLASS}
      onTouchStart={handleFsTouchStart}
      onTouchMove={handleFsTouchMove}
      onTouchEnd={handleFsTouchEnd}
    >
      <button
        onClick={onClose}
        className={FULLSCREEN_MEDIA_CLOSE_CLASS}
      >
        <X className="w-7 h-7 sm:w-8 sm:h-8 drop-shadow-md" />
      </button>

      <FullscreenMediaStage onBackdropClick={onClose}>
        {(() => {
          const item = fullscreenMedia.items[fullscreenMedia.mediaIndex];
          if (!item) return null;
          if (item.isVideo) {
            return (
              <video
                key={`ws-fs-vid-${fullscreenMedia.mediaIndex}`}
                ref={(el) => {
                  if (el) taskVideoRefs.current.set(fullscreenMedia.mediaIndex, el);
                }}
                src={item.url}
                className={`${FULLSCREEN_MEDIA_CLASS} bg-black`}
                controls
                playsInline
                preload="auto"
                {...nativeVideoControlGuardProps()}
              />
            );
          }
          return (
            <img
              key={`ws-fs-img-${fullscreenMedia.mediaIndex}`}
              src={item.url}
              className={`${FULLSCREEN_MEDIA_CLASS} pointer-events-none`}
              alt="Fullscreen media"
              onError={handleMediaError}
            />
          );
        })()}
      </FullscreenMediaStage>

      {fullscreenMedia.items.length > 1 && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMediaIndexChange(
                fullscreenMedia.mediaIndex === 0
                  ? fullscreenMedia.items.length - 1
                  : fullscreenMedia.mediaIndex - 1
              );
            }}
            className={`${FULLSCREEN_MEDIA_NAV_CLASS} left-[max(0.75rem,env(safe-area-inset-left,0px))]`}
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMediaIndexChange(
                fullscreenMedia.mediaIndex === fullscreenMedia.items.length - 1
                  ? 0
                  : fullscreenMedia.mediaIndex + 1
              );
            }}
            className={`${FULLSCREEN_MEDIA_NAV_CLASS} right-[max(0.75rem,env(safe-area-inset-right,0px))]`}
          >
            <ChevronRight className="w-6 h-6" />
          </button>

          <div className={FULLSCREEN_MEDIA_DOTS_CLASS}>
            {fullscreenMedia.items.map((_, i) => (
              <div
                key={`ws-fs-dot-${i}`}
                className={`w-1.5 h-1.5 rounded-full transition-all ${i === fullscreenMedia.mediaIndex ? 'bg-white scale-125' : 'bg-white/30'}`}
              />
            ))}
          </div>
        </>
      )}
    </div>,
    document.body
  );
}
