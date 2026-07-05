import React from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import {
  FULLSCREEN_MEDIA_CLOSE_CLASS,
  FULLSCREEN_MEDIA_DOTS_CLASS,
  FULLSCREEN_MEDIA_NAV_CLASS,
  FULLSCREEN_MEDIA_OVERLAY_CLASS,
  FullscreenMediaStage,
} from '../common/FullscreenMediaStage';

export type ReelContentFullscreenPortalProps = {
  isOpen: boolean;
  fullscreenSwipeRef: React.RefObject<HTMLDivElement | null>;
  hasCarousel: boolean;
  currentMediaIdx: number;
  carouselLength: number;
  onClose: () => void;
  shouldIgnoreBackdropClose?: () => boolean;
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: () => void;
  onPrevCarouselItem: () => void;
  onNextCarouselItem: () => void;
  children: React.ReactNode;
};

export function ReelContentFullscreenPortal({
  isOpen,
  fullscreenSwipeRef,
  hasCarousel,
  currentMediaIdx,
  carouselLength,
  onClose,
  shouldIgnoreBackdropClose,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onPrevCarouselItem,
  onNextCarouselItem,
  children,
}: ReelContentFullscreenPortalProps) {
  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div
      id="reel-full-screen-modal"
      data-media-fullscreen="true"
      ref={fullscreenSwipeRef}
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
        title="Close fullscreen"
      >
        <X className="w-7 h-7 sm:w-8 sm:h-8" />
      </button>

      {hasCarousel && (
        <>
          <button
            type="button"
            aria-label="Previous slide"
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
            aria-label="Next slide"
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
        {children}
      </FullscreenMediaStage>

      {hasCarousel && (
        <div className={`${FULLSCREEN_MEDIA_DOTS_CLASS} pointer-events-none`}>
          {Array.from({ length: carouselLength }, (_, i) => (
            <div
              key={`reel-fs-dot-${i}`}
              className={`w-2 h-2 rounded-full transition-all ${i === currentMediaIdx ? 'bg-white scale-110' : 'bg-white/40'}`}
            />
          ))}
        </div>
      )}
    </div>,
    document.body
  );
}
