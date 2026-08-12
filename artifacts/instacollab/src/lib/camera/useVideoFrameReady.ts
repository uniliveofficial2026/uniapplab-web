import { useEffect, useRef, useState, type RefObject } from 'react';

/**
 * Reactive gate — ref.current alone does not re-render when video gets frames.
 *
 * Also detects a STALLED stream: if the video stops advancing frames while still
 * enabled (WebAR output froze / GPU stalled), we flip ready→false so callers can
 * fall back to the raw camera instead of showing a frozen black overlay.
 */
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
      // Longer grace — brief enabled flicker must not blank the beauty overlay.
      offTimerRef.current = setTimeout(() => setReady(false), 400);
      return () => {
        if (offTimerRef.current) clearTimeout(offTimerRef.current);
      };
    }

    const hasFrames = () => {
      const video = videoRef.current;
      if (!video) return false;
      return (
        video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0
      );
    };

    if (hasFrames()) setReady(true);

    const video = videoRef.current;
    const onFrames = () => {
      if (hasFrames()) setReady(true);
    };
    if (video) {
      video.addEventListener('loadeddata', onFrames);
      video.addEventListener('playing', onFrames);
      video.addEventListener('resize', onFrames);
    }

    // Watchdog: track currentTime advancement. If it stops progressing while the
    // element still claims to have data, treat the stream as stalled (frozen black).
    let lastTime = video?.currentTime ?? 0;
    let stalledTicks = 0;

    const pollId = window.setInterval(() => {
      const v = videoRef.current;
      if (!v) return;

      const frames = hasFrames();
      if (frames) setReady(true);

      const t = v.currentTime;
      const advanced = t > lastTime + 0.001;
      lastTime = t;

      const trackLive = (() => {
        const stream = v.srcObject;
        if (stream instanceof MediaStream) {
          return stream.getVideoTracks().some((tr) => tr.readyState === 'live');
        }
        return true;
      })();

      // Frozen: has data + not paused but time isn't advancing, or track ended.
      const frozen = (!advanced && !v.paused && frames) || !trackLive;
      if (frozen) {
        stalledTicks += 1;
        // ~3 consecutive stalled polls (~450ms) → drop overlay to raw camera.
        if (stalledTicks >= 3) setReady(false);
      } else {
        stalledTicks = 0;
      }
    }, 150);

    return () => {
      window.clearInterval(pollId);
      if (video) {
        video.removeEventListener('loadeddata', onFrames);
        video.removeEventListener('playing', onFrames);
        video.removeEventListener('resize', onFrames);
      }
    };
  }, [enabled, videoRef]);

  return ready;
}
