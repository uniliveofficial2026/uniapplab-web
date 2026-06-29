import { useEffect, type RefObject } from 'react';
import { useDB } from './useDB';

/**
 * Autoplay/pause inline-scoped videos by visibility (comments, chat bubbles).
 * Does not register with the managed playback coordinator.
 */
export function useInlineVideoVisibility(
  containerRef: RefObject<HTMLElement | null>,
  videoRef: RefObject<HTMLVideoElement | null>,
  enabled = true,
  onBeforePlay?: () => void,
  /** When set (e.g. messages thread scroller), visibility is relative to this element, not the viewport. */
  scrollRoot?: Element | null,
  /** When false, scrolling out of view does not pause (e.g. messages chat). */
  pauseWhenNotVisible = true
) {
  const db = useDB();

  useEffect(() => {
    if (!enabled) return;
    const root = containerRef.current;
    const video = videoRef.current;
    if (!root || !video) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.some(
          (e) => e.isIntersecting && e.intersectionRatio >= 0.35
        );
        if (visible) {
          video.muted = db.globalMuted;
          onBeforePlay?.();
          void video.play().catch(() => {});
        } else if (pauseWhenNotVisible) {
          video.pause();
        }
      },
      {
        root: scrollRoot ?? null,
        threshold: [0, 0.35, 0.55],
      }
    );
    observer.observe(root);
    return () => observer.disconnect();
  }, [containerRef, videoRef, enabled, db.globalMuted, onBeforePlay, scrollRoot, pauseWhenNotVisible]);
}
