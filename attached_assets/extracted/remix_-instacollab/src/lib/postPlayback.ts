import { boostFeedPlaybackIntent, resetPlaybackMedia } from './playbackAudio';

/** Unified playback ids for a post across feed, modal, and fullscreen surfaces. */
export function postPlaybackId(
  postId: string,
  surface: 'soundtrack' | 'text-audio' | 'video' | 'video-fs' | 'carousel-audio'
): string {
  return `post:${postId}:${surface}`;
}

/** @deprecated Handoffs removed — no-op for compatibility. */
export function snapshotPostPlayback(
  _postId: string,
  _incomingVideoKey: 'modal' | 'modal-fs' | 'post-fs' | 'feed' = 'modal'
) {}

/** Reset feed/modal media when scrolling away — revisiting starts from the beginning. */
export function resetPostPlayback(postId: string) {
  const surfaces = ['soundtrack', 'text-audio', 'video', 'video-fs', 'carousel-audio'] as const;
  for (const surface of surfaces) {
    resetPlaybackMedia(postPlaybackId(postId, surface));
  }
}

/** Call immediately before closing PostModal so feed resumes cleanly. */
export function preparePostPlaybackExit(postId: string) {
  boostFeedPlaybackIntent(postPlaybackId(postId, 'soundtrack'));
  boostFeedPlaybackIntent(postPlaybackId(postId, 'text-audio'));
  boostFeedPlaybackIntent(postPlaybackId(postId, 'video'));
}
