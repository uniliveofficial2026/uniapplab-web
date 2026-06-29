import React from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { FullscreenMediaStage } from '../common/FullscreenMediaStage';

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
      ref={fullscreenSwipeRef}
      className="fixed inset-0 z-[320] flex items-center justify-center bg-background pointer-events-auto animate-in fade-in duration-200 select-none"
      onWheel={(e) => e.stopPropagation()}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 z-[260] text-foreground p-2.5 bg-background border border-border hover:bg-secondary rounded-full transition-all active:scale-95 shadow-md"
        title="Close fullscreen"
      >
        <X className="w-8 h-8" />
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
            className="absolute left-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/50 hover:bg-black/75 max-lg:hidden flex items-center justify-center text-white transition-all z-50 shadow-md active:scale-95"
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
            className="absolute right-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/50 hover:bg-black/75 max-lg:hidden flex items-center justify-center text-white transition-all z-50 shadow-md active:scale-95"
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
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-50 bg-black/30 backdrop-blur-[2px] px-3 py-1.5 rounded-full pointer-events-none">
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
