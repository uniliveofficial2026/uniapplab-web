import { useEffect, type RefObject } from 'react';
import { applyMobileInlineVideoAttrs } from '../nativeVideoPlatform';
import { PLAYBACK_SCOPE } from '../playbackScope';

type Options = {
  videoRef: RefObject<HTMLVideoElement | null>;
  wantsPlay: boolean;
  mediaUrl: string | undefined;
  muted: boolean;
};

/** Active reel inline video — direct play/pause; respects native control pause/play. */
export function useReelDirectVideoPlayback({
  videoRef,
  wantsPlay,
  mediaUrl,
  muted,
}: Options): void {
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    applyMobileInlineVideoAttrs(video);
    video.dataset.playbackScope = PLAYBACK_SCOPE.MANAGED;

    if (!wantsPlay || !mediaUrl) {
      if (!video.paused) {
        try {
          video.pause();
        } catch {
          /* ignore */
        }
      }
      return;
    }

    if (video.muted !== muted) {
      video.muted = muted;
    }

    let cancelled = false;

    const playNow = async () => {
      if (cancelled) return;
      const v = videoRef.current;
      if (!v || !wantsPlay) return;
      if (!v.paused) return;

      try {
        await v.play();
      } catch (err) {
        if (cancelled) return;
        const blocked =
          err instanceof DOMException &&
          (err.name === 'NotAllowedError' || err.name === 'NotSupportedError');
        if (blocked && !v.muted) {
          v.muted = true;
          try {
            await v.play();
            window.dispatchEvent(new CustomEvent('playback-autoplay-muted'));
          } catch {
            /* autoplay policy */
          }
        }
      }
    };

    const onReady = () => {
      void playNow();
    };

    const arm = () => {
      if (cancelled) return;
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        void playNow();
        return;
      }
      video.addEventListener('loadeddata', onReady, { once: true });
      video.addEventListener('canplay', onReady, { once: true });
    };

    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(arm);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      video.removeEventListener('loadeddata', onReady);
      video.removeEventListener('canplay', onReady);
    };
  }, [wantsPlay, mediaUrl, muted, videoRef]);
}
