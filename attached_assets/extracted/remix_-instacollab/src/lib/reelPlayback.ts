import { resetPlaybackMedia } from './playbackAudio';

export function reelPlaybackId(
  reelId: string,
  surface: 'video' | 'video-fs' | 'soundtrack' | 'carousel-audio' = 'video'
): string {
  return `reel:${reelId}:${surface}`;
}

/** @deprecated Handoffs removed — no-op for compatibility. */
export function snapshotReelPlayback(
  _reelId: string,
  _incomingVideoKey: 'reel-fs' | 'reel-inline' = 'reel-fs'
) {}

export function resetReelPlayback(reelId: string) {
  resetPlaybackMedia(reelPlaybackId(reelId, 'video'));
  resetPlaybackMedia(reelPlaybackId(reelId, 'video-fs'));
  resetPlaybackMedia(reelPlaybackId(reelId, 'soundtrack'));
  resetPlaybackMedia(reelPlaybackId(reelId, 'carousel-audio'));
}

/** @deprecated Handoffs removed — no-op for compatibility. */
export function prepareReelPlaybackExit(_reelId: string) {}
