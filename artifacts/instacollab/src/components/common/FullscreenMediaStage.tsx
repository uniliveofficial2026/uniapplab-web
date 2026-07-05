import React from 'react';
import { createBackdropCloseHandler } from '../../lib/mediaOverlayLock';

/**
 * True viewport overlay for photo/video fullscreen on phone, tablet, and desktop.
 * Uses dynamic viewport units so mobile browser chrome does not clip media.
 */
export const FULLSCREEN_MEDIA_OVERLAY_CLASS =
  'fixed inset-0 z-[320] flex h-[100dvh] max-h-[100dvh] w-full max-w-[100vw] flex-col overflow-hidden bg-black pointer-events-auto animate-in fade-in duration-200 select-none overscroll-none';

export const FULLSCREEN_MEDIA_CLOSE_CLASS =
  'absolute z-[330] text-white p-2.5 rounded-full bg-black/45 hover:bg-black/65 border border-white/10 transition-colors active:scale-95 shadow-md top-[max(0.75rem,env(safe-area-inset-top,0px))] right-[max(0.75rem,env(safe-area-inset-right,0px))]';

export const FULLSCREEN_MEDIA_NAV_CLASS =
  'absolute top-1/2 z-[330] -translate-y-1/2 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-black/55 hover:bg-black/75 hidden lg:flex items-center justify-center text-white transition-all hover:scale-105 active:scale-95 shadow-md';

export const FULLSCREEN_MEDIA_DOTS_CLASS =
  'absolute left-1/2 -translate-x-1/2 z-[330] flex items-center gap-1.5 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full bottom-[max(1rem,env(safe-area-inset-bottom,0px))]';

/** Fit media to the full dynamic viewport; preserve aspect ratio, no wasted padding. */
export const FULLSCREEN_MEDIA_CLASS =
  'block h-auto w-auto max-h-[100dvh] max-w-[100vw] object-contain select-none';

/** Scrollable viewport stage — media keeps native aspect ratio, fills available screen. */
export function FullscreenMediaStage({
  children,
  className = '',
  onBackdropClick,
  shouldIgnoreBackdropClose,
}: {
  children: React.ReactNode;
  className?: string;
  onBackdropClick?: () => void;
  shouldIgnoreBackdropClose?: () => boolean;
}) {
  const onBackdropPointerUp = onBackdropClick
    ? createBackdropCloseHandler(
        onBackdropClick,
        shouldIgnoreBackdropClose ?? (() => false)
      )
    : undefined;

  return (
    <div
      className={`flex min-h-0 min-w-0 flex-1 w-full h-full items-center justify-center overflow-hidden overscroll-none ${className}`}
      onPointerUp={onBackdropPointerUp}
      onClick={onBackdropPointerUp}
    >
      <div
        className="flex h-full w-full min-h-0 min-w-0 max-h-full max-w-full items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
