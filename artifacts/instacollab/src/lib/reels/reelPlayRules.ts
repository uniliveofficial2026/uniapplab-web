/** Pure rules for reel inline preview + tap play/pause — tested outside the browser. */

export type ReelInlinePlayInput = {
  isActive: boolean;
  isPlaying: boolean;
  showVideoSlide: boolean;
  isContentFullscreen: boolean;
  mediaOverlayLocked: boolean;
  hasSoundtrack: boolean;
  isCreatorEditingActive: boolean;
  isCommentsOpen: boolean;
};

/** When true, the active reel video should autoplay (preview). */
export function computeReelInlineWantsPlay(input: ReelInlinePlayInput): boolean {
  return (
    input.isActive &&
    input.isPlaying &&
    input.showVideoSlide &&
    !input.isContentFullscreen &&
    !input.mediaOverlayLocked &&
    !input.hasSoundtrack &&
    !input.isCreatorEditingActive &&
    !input.isCommentsOpen
  );
}

/** Tap-to-toggle play state (native controls own play/pause). */
export function toggleReelPlaying(isPlaying: boolean): boolean {
  return !isPlaying;
}

/** @deprecated Native `<video controls>` handles pause UI — always false. */
export function shouldShowReelPlayOverlay(_input: {
  showVideoSlide: boolean;
  isPlaying: boolean;
  isFullscreenUi: boolean;
}): boolean {
  return false;
}

/**
 * Active = auto; offscreen metadata only when thermal allows prefetch + has FX budget.
 * No visual change — only network/decode work.
 */
export function computeReelVideoPreload(
  isActive: boolean,
  policy: { allowPrefetch: boolean; fxBudget: number },
): 'auto' | 'metadata' | 'none' {
  if (isActive) return 'auto';
  if (!policy.allowPrefetch || policy.fxBudget < 0.55) return 'none';
  return 'metadata';
}
