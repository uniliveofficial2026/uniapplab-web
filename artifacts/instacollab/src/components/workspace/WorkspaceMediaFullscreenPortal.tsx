import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { handleMediaError } from '../../lib/utils';
import { touchClientX } from '../../lib/safe';

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
      className="fixed inset-0 z-[250] flex items-center justify-center bg-background pointer-events-auto animate-in fade-in duration-200"
      onTouchStart={handleFsTouchStart}
      onTouchMove={handleFsTouchMove}
      onTouchEnd={handleFsTouchEnd}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-[260] text-white p-2 hover:bg-white/10 rounded-full transition-colors cursor-pointer"
      >
        <X className="w-8 h-8 drop-shadow-md" />
      </button>
      <div className="w-full h-full flex items-center justify-center p-4 select-none">
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
                className="max-w-full max-h-full object-contain"
                controls
                playsInline
                preload="auto"
              />
            );
          }
          return (
            <img
              key={`ws-fs-img-${fullscreenMedia.mediaIndex}`}
              src={item.url}
              className="max-w-full max-h-full object-contain pointer-events-none"
              alt="Fullscreen media"
              onError={handleMediaError}
            />
          );
        })()}
      </div>

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
            className="absolute left-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/60 hover:bg-black/80 hidden lg:flex items-center justify-center text-white transition-all z-[260] hover:scale-105 active:scale-95"
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
            className="absolute right-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/60 hover:bg-black/80 hidden lg:flex items-center justify-center text-white transition-all z-[260] hover:scale-105 active:scale-95"
          >
            <ChevronRight className="w-6 h-6" />
          </button>

          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-[260] bg-zinc-900 border border-border px-3 py-1.5 rounded-full shadow-lg">
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
