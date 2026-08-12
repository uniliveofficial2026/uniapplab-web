/** Runtime / build feature flags for UniLive’s asset system. */

export type UniLivesAssetFeatureFlags = {
  /** When true, prefer static reduced-motion fallbacks. */
  forceReducedMotion: boolean;
  /** When true, prefer low-performance static fallbacks. */
  forceLowPerformance: boolean;
  /** Mute gift / interaction animation (still show static). */
  muteAnimations: boolean;
  /** Disable gift / interaction audio. */
  disableSound: boolean;
  /** Reject duplicate IDs hard (dev/CI). */
  rejectDuplicateIds: boolean;
  /** Throw when resolveAsset hits an unknown ID (dev). */
  strictUnknownIds: boolean;
};

const defaults: UniLivesAssetFeatureFlags = {
  forceReducedMotion: false,
  forceLowPerformance: false,
  muteAnimations: false,
  disableSound: false,
  rejectDuplicateIds: true,
  strictUnknownIds: false,
};

let flags: UniLivesAssetFeatureFlags = { ...defaults };

export function getAssetFeatureFlags(): UniLivesAssetFeatureFlags {
  return { ...flags };
}

export function setAssetFeatureFlags(
  patch: Partial<UniLivesAssetFeatureFlags>,
): UniLivesAssetFeatureFlags {
  flags = { ...flags, ...patch };
  return getAssetFeatureFlags();
}

export function resetAssetFeatureFlags(): void {
  flags = { ...defaults };
}

/** Detect prefers-reduced-motion in browser; false on server. */
export function detectPrefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}
