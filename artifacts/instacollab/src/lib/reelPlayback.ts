import { useEffect, type RefObject } from 'react';
import { requestPlaybackReconcile, resetPlaybackMedia } from './playbackAudio';

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

/**
 * Kick the coordinator once the active reel video has media data.
 * Never calls video.load() — that races React's src and kills playback.
 */
export function useActiveReelVideoPlayback(
  videoRef: RefObject<HTMLVideoElement | null>,
  active: boolean,
  showVideo: boolean,
  mediaUrl: string | undefined,
): void {
  useEffect(() => {
    if (!active || !showVideo || !mediaUrl) return;
    let cancelled = false;

    const kick = () => {
      if (!cancelled) requestPlaybackReconcile();
    };

    const arm = () => {
      const v = videoRef.current;
      if (!v || cancelled) return;
      if (v.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        kick();
        return;
      }
      v.addEventListener('loadeddata', kick, { once: true });
      v.addEventListener('canplay', kick, { once: true });
    };

    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(arm);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      const v = videoRef.current;
      if (!v) return;
      v.removeEventListener('loadeddata', kick);
      v.removeEventListener('canplay', kick);
    };
  }, [active, showVideo, mediaUrl, videoRef]);
}

/** @deprecated Handoffs removed — no-op for compatibility. */
export function prepareReelPlaybackExit(_reelId: string) {}
