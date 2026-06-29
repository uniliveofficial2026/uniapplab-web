/** How a <video> participates in global play/pause coordination. */
export const PLAYBACK_SCOPE = {
  /** Feed/reel primary video — exclusive playback coordinator. */
  MANAGED: 'managed',
  /** Comment lines, chat attachments — user/tap or visibility autoplay. */
  INLINE: 'inline',
  /** Wallpapers/decorative — never paused by other videos. */
  AMBIENT: 'ambient',
} as const;

export type PlaybackScope =
  (typeof PLAYBACK_SCOPE)[keyof typeof PLAYBACK_SCOPE];

export function getVideoPlaybackScope(video: HTMLVideoElement): PlaybackScope {
  const raw = video.dataset.playbackScope;
  if (raw === PLAYBACK_SCOPE.INLINE) return PLAYBACK_SCOPE.INLINE;
  if (raw === PLAYBACK_SCOPE.AMBIENT) return PLAYBACK_SCOPE.AMBIENT;
  return PLAYBACK_SCOPE.MANAGED;
}

/** Whether `peer` should be paused because `active` started playing. */
export function shouldPausePeerVideo(
  active: HTMLVideoElement,
  peer: HTMLVideoElement
): boolean {
  if (active === peer || peer.paused) return false;
  const activeScope = getVideoPlaybackScope(active);
  const peerScope = getVideoPlaybackScope(peer);
  if (
    activeScope === PLAYBACK_SCOPE.AMBIENT ||
    peerScope === PLAYBACK_SCOPE.AMBIENT
  ) {
    return false;
  }
  if (activeScope === PLAYBACK_SCOPE.MANAGED) {
    return false;
  }
  return activeScope === peerScope;
}

/** Pause same-scope peers when an inline video starts (managed uses playbackAudio). */
export function pausePeerVideos(active: HTMLVideoElement): void {
  const activeScope = getVideoPlaybackScope(active);
  if (activeScope !== PLAYBACK_SCOPE.INLINE) return;
  document.querySelectorAll('video').forEach((video) => {
    if (shouldPausePeerVideo(active, video)) {
      video.pause();
    }
  });
}
