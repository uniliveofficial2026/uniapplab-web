/**
 * Single active media in Messages (voice, music, inline video, gallery, fullscreen).
 * Only one registered player may play at a time.
 */

import { pauseAllPlayback } from './playbackAudio';

const players = new Set<() => void>();

/** Bumped on each coordinated play so async `play()` resolves can ignore stale starts. */
let mediaPlayGeneration = 0;

export function registerChatMediaPlayer(pause: () => void): () => void {
  players.add(pause);
  return () => {
    players.delete(pause);
  };
}

export function pauseOtherChatMediaPlayers(exceptPause?: () => void) {
  players.forEach((pause) => {
    if (pause !== exceptPause) pause();
  });
}

export function pauseAllChatMediaPlayers() {
  players.forEach((pause) => pause());
}

/** Pause feed/reel coordinator + every other chat media surface before starting playback. */
export function beginChatMediaPlayback(exceptPause?: () => void): number {
  mediaPlayGeneration += 1;
  pauseAllPlayback();
  pauseOtherChatMediaPlayers(exceptPause);
  return mediaPlayGeneration;
}

export function isChatMediaSessionActive(session: number): boolean {
  return session === mediaPlayGeneration;
}

export function pauseAllInlineChatVideos(refs: Map<string, HTMLVideoElement>) {
  refs.forEach((el) => {
    try {
      el.pause();
    } catch {
      /* ignore */
    }
  });
}

/** Stop all chat media players and every tracked inline video element. */
export function stopAllChatMedia(refs?: Map<string, HTMLVideoElement>) {
  pauseAllChatMediaPlayers();
  if (refs) pauseAllInlineChatVideos(refs);
}
