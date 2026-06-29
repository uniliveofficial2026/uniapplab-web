import { useEffect, useLayoutEffect, type RefObject } from 'react';
import { PLAYBACK_SCOPE } from './playbackScope';
import {
  clearPlaybackIntent,
  registerPlaybackElement,
  requestPlaybackReconcile,
  setPlaybackIntent,
} from './playbackAudio';

function bindPlaybackElement(
  playbackId: string,
  intentKey: string,
  el: HTMLMediaElement | null
) {
  if (el instanceof HTMLVideoElement) {
    el.dataset.playbackScope = PLAYBACK_SCOPE.MANAGED;
  }
  registerPlaybackElement(playbackId, intentKey, el);
}

/** Register a media element and exclusive play intent (video or audio). */
export function useExclusivePlayback(
  playbackId: string,
  priority: number,
  wantsPlay: boolean,
  mediaRef: RefObject<HTMLMediaElement | null>,
  intentKey = 'video'
) {
  useLayoutEffect(() => {
    bindPlaybackElement(playbackId, intentKey, mediaRef.current);
    return () => registerPlaybackElement(playbackId, intentKey, null);
  }, [playbackId, intentKey, wantsPlay, mediaRef]);

  // Fullscreen portals mount the <video> after the parent layout effect; re-bind on next frame.
  useEffect(() => {
    if (!wantsPlay) return;
    let cancelled = false;
    const run = () => {
      if (cancelled) return;
      const el = mediaRef.current;
      if (!el) return;
      bindPlaybackElement(playbackId, intentKey, el);
      requestPlaybackReconcile();
    };
    run();
    const raf = requestAnimationFrame(run);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [playbackId, intentKey, wantsPlay, mediaRef]);

  useEffect(() => {
    setPlaybackIntent(playbackId, intentKey, priority, wantsPlay);
    return () => clearPlaybackIntent(playbackId, intentKey);
  }, [playbackId, intentKey, priority, wantsPlay]);
}
