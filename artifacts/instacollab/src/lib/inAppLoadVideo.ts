/**
 * In-app loading video (second locked clip).
 * Online → always full ~5s (cannot skip).
 * Offline → loop until ready.
 */

import {
  armFixedPlay,
  resetFixedPlay,
  LOCKED_VIDEO_PLAY_MS,
  whenFixedPlayComplete,
} from './fixedPlay';

export const IN_APP_LOAD_PLAY_MS = LOCKED_VIDEO_PLAY_MS;
export const IN_APP_LOAD_PLAY_KEY = 'inapp-loading';

export type InAppLoadVideoOptions = {
  isReady: () => boolean;
  isOnline: () => boolean;
  onShouldPlay: () => void;
  onComplete: () => void;
  playMs?: number;
  /** Unique generation so each main-entry gets a fresh 5s play. */
  generation?: string;
};

export function scheduleInAppLoadVideo(options: InAppLoadVideoOptions): () => void {
  const playMs = options.playMs ?? IN_APP_LOAD_PLAY_MS;
  const key = options.generation
    ? `${IN_APP_LOAD_PLAY_KEY}:${options.generation}`
    : IN_APP_LOAD_PLAY_KEY;
  const onlineAtStart = options.isOnline();

  options.onShouldPlay();

  if (onlineAtStart) {
    whenFixedPlayComplete(key, playMs, options.onComplete);
    return () => undefined;
  }

  let cancelled = false;
  let pollId = 0;

  const finish = () => {
    if (cancelled) return;
    cancelled = true;
    if (pollId) window.clearInterval(pollId);
    options.onComplete();
  };

  pollId = window.setInterval(() => {
    if (cancelled) return;
    if (options.isOnline()) {
      window.clearInterval(pollId);
      pollId = 0;
      whenFixedPlayComplete(key, playMs, finish);
      return;
    }
    if (options.isReady()) finish();
  }, 200);

  return () => {
    if (!options.isOnline()) {
      cancelled = true;
      if (pollId) window.clearInterval(pollId);
    }
  };
}

export function resetInAppLoadPlay(generation?: string): void {
  if (generation) {
    resetFixedPlay(`${IN_APP_LOAD_PLAY_KEY}:${generation}`);
    return;
  }
  resetFixedPlay(IN_APP_LOAD_PLAY_KEY);
}
