/**
 * Locked UniLive’s in-app loading video — second approved 9:16 clip.
 * Plays on normal main-app loads and refresh. Do not replace without an approved reference update.
 */

export const PRINCESS_INAPP_LOADING_LOCKED_VIDEO_SRC =
  '/unilives-assets/brand/loading/princess-inapp-loading-locked.mp4';

export const PRINCESS_INAPP_LOADING_LOCKED_POSTER_SRC =
  '/unilives-assets/brand/loading/princess-inapp-loading-locked.jpg';

export const PRINCESS_INAPP_LOADING_BG_EXTEND_SRC =
  '/unilives-assets/brand/loading/princess-loading-refresh-bg-extend.svg';

/** @deprecated alias — use PRINCESS_INAPP_LOADING_* */
export const PRINCESS_LOADING_REFRESH_LOCKED_VIDEO_SRC = PRINCESS_INAPP_LOADING_LOCKED_VIDEO_SRC;
/** @deprecated alias */
export const PRINCESS_LOADING_REFRESH_LOCKED_POSTER_SRC = PRINCESS_INAPP_LOADING_LOCKED_POSTER_SRC;
/** @deprecated alias */
export const PRINCESS_LOADING_REFRESH_BG_EXTEND_SRC = PRINCESS_INAPP_LOADING_BG_EXTEND_SRC;

/** Design frames requested for production readiness. */
export const PRINCESS_LOADING_REFRESH_FRAMES = [
  { w: 375, h: 812, label: 'mobile-375' },
  { w: 430, h: 932, label: 'mobile-430' },
  { w: 768, h: 1024, label: 'tablet-768' },
  { w: 1440, h: 900, label: 'desktop-1440' },
] as const;

export const PRINCESS_LOADING_REFRESH_ART_SIZE = { w: 720, h: 1280 } as const;

export const PRINCESS_LOADING_REFRESH_DURATION_MS = 5042;

export const LOADING_REFRESH_COMPLETE_EVENT = 'unilives:loading-refresh-complete';

let loadingRefreshCompleted = false;

export function hasLoadingRefreshCompleted(): boolean {
  return loadingRefreshCompleted;
}

export function markLoadingRefreshCompleted(): void {
  loadingRefreshCompleted = true;
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(LOADING_REFRESH_COMPLETE_EVENT));
}

export function resetLoadingRefreshCompleted(): void {
  loadingRefreshCompleted = false;
}
