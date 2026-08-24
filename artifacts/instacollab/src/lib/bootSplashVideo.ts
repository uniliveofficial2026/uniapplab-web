/**
 * Boot splash (first video) — HTML `#boot-shell`.
 *
 * Rule: if the shell is in the document at start, play the FULL ~5s online.
 * Nothing may remove the shell while that play is active (prevents skip).
 */

import { isAdminStudioEmbed } from './adminStudioEmbed';
import {
  resetFixedPlay,
  isFixedPlayActive,
  isFixedPlayDone,
  LOCKED_VIDEO_PLAY_MS,
  whenFixedPlayComplete,
} from './fixedPlay';
import { markSplashSeenThisSession } from './splashSession';

export const BOOT_SPLASH_VIDEO_ID = 'unilives-splash-video';
export const BOOT_SHELL_ID = 'boot-shell';
export const BOOT_SPLASH_MS = LOCKED_VIDEO_PLAY_MS;
export const BOOT_SPLASH_PLAY_KEY = 'boot-splash';

export function getBootSplashVideo(): HTMLVideoElement | null {
  if (typeof document === 'undefined') return null;
  return document.getElementById(BOOT_SPLASH_VIDEO_ID) as HTMLVideoElement | null;
}

export function getBootShell(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  return document.getElementById(BOOT_SHELL_ID);
}

export function isBrowserOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine !== false;
}

export function ensureBootSplashPlaying(options?: { loop?: boolean }): HTMLVideoElement | null {
  const video = getBootSplashVideo();
  if (!video) return null;
  video.muted = true;
  video.playsInline = true;
  video.controls = false;
  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', '');
  video.loop = Boolean(options?.loop);
  video.dataset.playing = '1';
  void video.play().catch(() => undefined);
  return video;
}

function stripBootShellDom(): void {
  const video = getBootSplashVideo();
  if (video) {
    try {
      video.pause();
      video.loop = false;
      video.removeAttribute('data-playing');
    } catch {
      /* ignore */
    }
  }
  getBootShell()?.remove();
}

/**
 * Safe remove — NEVER kills an in-progress ~5s play (that was the skip bug).
 * While playing, no-op; the play's onComplete strips the shell.
 */
export function removeBootShell(): void {
  if (isFixedPlayActive(BOOT_SPLASH_PLAY_KEY)) return;
  stripBootShellDom();
}

/** Same as removeBootShell — mid-play is protected, except studio embeds must never stay black. */
export function forceRemoveBootShell(): void {
  if (isAdminStudioEmbed()) {
    stripBootShellDom();
    return;
  }
  removeBootShell();
}

/** Hard strip after play completed (SplashScreen advance). */
export function dismissBootShellNow(): void {
  stripBootShellDom();
}

/**
 * Start the first video if `#boot-shell` is present.
 * Online → full ~5s then onComplete. Offline → loop until ready then onComplete.
 */
export function startBootSplashPlay(options?: {
  isReady?: () => boolean;
  isOnline?: () => boolean;
  onComplete?: () => void;
}): void {
  const shell = getBootShell();
  if (!shell) {
    options?.onComplete?.();
    return;
  }

  const isOnline = options?.isOnline ?? isBrowserOnline;
  const isReady = options?.isReady ?? (() => true);
  const online = isOnline();

  ensureBootSplashPlaying({ loop: !online });

  const finish = () => {
    stripBootShellDom();
    markSplashSeenThisSession();
    options?.onComplete?.();
  };

  if (online) {
    whenFixedPlayComplete(BOOT_SPLASH_PLAY_KEY, BOOT_SPLASH_MS, finish, () => {
      ensureBootSplashPlaying({ loop: false });
    });
    return;
  }

  // Offline: loop until ready, then finish.
  const video = getBootSplashVideo();
  if (video) video.loop = true;

  const poll = window.setInterval(() => {
    if (isOnline()) {
      window.clearInterval(poll);
      if (video) video.loop = false;
      whenFixedPlayComplete(BOOT_SPLASH_PLAY_KEY, BOOT_SPLASH_MS, finish);
      return;
    }
    if (isReady()) {
      window.clearInterval(poll);
      finish();
    }
  }, 250);
}

export function waitBootSplashUntilReady(
  onComplete: () => void,
  options: {
    isReady?: () => boolean;
    isOnline?: () => boolean;
    playMs?: number;
  } = {},
): () => void {
  if (!getBootShell() && isFixedPlayDone(BOOT_SPLASH_PLAY_KEY)) {
    onComplete();
    return () => undefined;
  }

  if (!getBootShell() && !isFixedPlayActive(BOOT_SPLASH_PLAY_KEY)) {
    // Shell already gone — complete.
    onComplete();
    return () => undefined;
  }

  startBootSplashPlay({
    isReady: options.isReady,
    isOnline: options.isOnline,
    onComplete,
  });

  return () => undefined;
}

export function resetBootSplashWaitState(): void {
  resetFixedPlay(BOOT_SPLASH_PLAY_KEY);
}

export function isBootSplashPlayActive(): boolean {
  return isFixedPlayActive(BOOT_SPLASH_PLAY_KEY);
}
