import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { requestPlaybackReconcile } from './playbackAudio';
import {
  isVideoElementNativeFullscreen,
  tryEnterVideoFullscreen,
} from './safe';

export type CarouselNativeVideoAdvanceOptions = {
  /**
   * When true (default), exclusive playback calls play() — this hook only seeks
   * and re-enters native FS to avoid play/pause races.
   */
  coordinatorOwnsPlay?: boolean;
};

/**
 * Keeps inline <video> playing (and re-enters native fullscreen) when the carousel
 * index changes — avoids iOS stopping playback when src changes or FS exits on "next".
 */
export function useCarouselNativeVideoAdvance(
  videoRef: RefObject<HTMLVideoElement | null>,
  currentMediaIdx: number,
  mediaUrl: string | undefined,
  showVideo: boolean,
  options?: CarouselNativeVideoAdvanceOptions
) {
  const coordinatorOwnsPlay = options?.coordinatorOwnsPlay !== false;
  const pendingNativeReenterRef = useRef(false);
  const isVideoSlideTransitionRef = useRef(false);
  const prevMediaIdxRef = useRef(currentMediaIdx);
  const prevMediaUrlRef = useRef(mediaUrl);
  const hasObservedMediaRef = useRef(false);

  const markNativeAdvance = useCallback(() => {
    if (isVideoElementNativeFullscreen(videoRef.current)) {
      pendingNativeReenterRef.current = true;
    }
    if (showVideo) {
      isVideoSlideTransitionRef.current = true;
    }
  }, [videoRef, showVideo]);

  const wrapCarouselAdvance = useCallback(
    (advance: () => void) => {
      markNativeAdvance();
      advance();
    },
    [markNativeAdvance]
  );

  useEffect(() => {
    if (!showVideo || !mediaUrl) {
      isVideoSlideTransitionRef.current = false;
      return;
    }
    const v = videoRef.current;
    if (!v) return;

    const idxChanged =
      hasObservedMediaRef.current && prevMediaIdxRef.current !== currentMediaIdx;
    const urlChanged =
      hasObservedMediaRef.current && prevMediaUrlRef.current !== mediaUrl;
    prevMediaIdxRef.current = currentMediaIdx;
    prevMediaUrlRef.current = mediaUrl;
    hasObservedMediaRef.current = true;

    const shouldReenterFs = pendingNativeReenterRef.current;
    pendingNativeReenterRef.current = false;

    const shouldRunTransition =
      shouldReenterFs || idxChanged || urlChanged;
    if (!shouldRunTransition) return;

    let cancelled = false;

    const reenterNativeFsIfNeeded = () => {
      if (cancelled || !shouldReenterFs) return;
      if (isVideoElementNativeFullscreen(v)) return;
      requestAnimationFrame(() => {
        if (cancelled) return;
        tryEnterVideoFullscreen(v);
      });
    };

    const finishTransition = () => {
      requestAnimationFrame(() => {
        isVideoSlideTransitionRef.current = false;
      });
    };

    const prepareAfterSrcChange = () => {
      if (cancelled) return;
      try {
        v.currentTime = 0;
      } catch {
        /* not seekable yet */
      }
      if (coordinatorOwnsPlay) {
        requestPlaybackReconcile();
        reenterNativeFsIfNeeded();
        finishTransition();
        return;
      }
      void v
        .play()
        .then(() => {
          if (cancelled) return;
          reenterNativeFsIfNeeded();
          finishTransition();
        })
        .catch(() => {
          finishTransition();
        });
    };

    const onMediaReady = () => {
      if (cancelled) return;
      prepareAfterSrcChange();
    };

    const runAfterLayout = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (cancelled) return;
          if (v.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
            prepareAfterSrcChange();
          } else {
            v.addEventListener('loadeddata', onMediaReady, { once: true });
            v.addEventListener('canplay', onMediaReady, { once: true });
          }
        });
      });
    };

    runAfterLayout();

    return () => {
      cancelled = true;
      v.removeEventListener('loadeddata', onMediaReady);
      v.removeEventListener('canplay', onMediaReady);
    };
  }, [currentMediaIdx, mediaUrl, showVideo, videoRef, coordinatorOwnsPlay]);

  return {
    wrapCarouselAdvance,
    markNativeAdvance,
    isVideoSlideTransitionRef,
  };
}
