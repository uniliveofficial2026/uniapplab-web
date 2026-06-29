import React from 'react';
import { createBackdropCloseHandler } from '../../lib/mediaOverlayLock';

/** Scrollable viewport stage — media keeps native aspect ratio, no clipping. */
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
      className={`size-full min-h-0 min-w-0 flex items-center justify-center p-4 overflow-auto overscroll-contain ${className}`}
      onPointerUp={onBackdropPointerUp}
      onClick={onBackdropPointerUp}
    >
      <div
        className="inline-flex min-h-0 min-w-0 max-w-full items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

/** Fit inside viewport; tall/wide posts scale down instead of clipping. */
export const FULLSCREEN_MEDIA_CLASS =
  'block h-auto w-auto max-h-[calc(100dvh-6rem)] max-w-[calc(100dvw-2rem)] object-contain select-none';
