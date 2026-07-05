import { useEffect, useState, type RefObject } from 'react';

/** Reactive gate — ref.current alone does not re-render when video gets frames. */
export function useVideoFrameReady(
  videoRef: RefObject<HTMLVideoElement | null>,
  enabled: boolean,
): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setReady(false);
      return undefined;
    }

    const video = videoRef.current;
    if (!video) {
      setReady(false);
      return undefined;
    }

    const check = () => {
      setReady(
        video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0,
      );
    };

    check();
    video.addEventListener('loadeddata', check);
    video.addEventListener('playing', check);
    video.addEventListener('resize', check);

    return () => {
      video.removeEventListener('loadeddata', check);
      video.removeEventListener('playing', check);
      video.removeEventListener('resize', check);
    };
  }, [enabled, videoRef]);

  return ready;
}
