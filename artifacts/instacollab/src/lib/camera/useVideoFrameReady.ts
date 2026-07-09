import { useEffect, useRef, useState, type RefObject } from 'react';

/** Reactive gate — ref.current alone does not re-render when video gets frames. */
export function useVideoFrameReady(
  videoRef: RefObject<HTMLVideoElement | null>,
  enabled: boolean,
): boolean {
  const [ready, setReady] = useState(false);
  const offTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (offTimerRef.current) {
      clearTimeout(offTimerRef.current);
      offTimerRef.current = null;
    }

    if (!enabled) {
      offTimerRef.current = setTimeout(() => setReady(false), 350);
      return () => {
        if (offTimerRef.current) clearTimeout(offTimerRef.current);
      };
    }

    const check = () => {
      const video = videoRef.current;
      if (!video) return false;
      const hasFrames =
        video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0;
      if (hasFrames) setReady(true);
      return hasFrames;
    };

    if (check()) return undefined;

    const video = videoRef.current;
    if (video) {
      video.addEventListener('loadeddata', check);
      video.addEventListener('playing', check);
      video.addEventListener('resize', check);
    }

    const pollId = window.setInterval(() => {
      if (check()) {
        window.clearInterval(pollId);
      }
    }, 120);

    return () => {
      window.clearInterval(pollId);
      if (video) {
        video.removeEventListener('loadeddata', check);
        video.removeEventListener('playing', check);
        video.removeEventListener('resize', check);
      }
    };
  }, [enabled, videoRef]);

  return ready;
}
