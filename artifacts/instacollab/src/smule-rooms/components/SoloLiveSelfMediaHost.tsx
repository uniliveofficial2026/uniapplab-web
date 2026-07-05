import React, { useLayoutEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { LIVE_VIDEO_HEIGHT, LIVE_VIDEO_WIDTH } from '../hooks/liveVideoConstants';

type SoloLiveSelfMediaHostProps = {
  /** Keep camera + DeepAR DOM mounted while user is the solo host (survives chat re-renders). */
  mounted: boolean;
  /** Camera stream active — hide preview when off without unmounting. */
  visible: boolean;
  rawVideoRef: RefObject<HTMLVideoElement | null>;
  deeparPreviewRef: RefObject<HTMLDivElement | null>;
  showDeeparPreview: boolean;
  mirrorSelf: boolean;
  /** Tencent WebAR processed output video. */
  beautyVideoRef?: RefObject<HTMLVideoElement | null>;
  showBeautyPreview?: boolean;
  /** CSS fallback when WebAR credentials are missing. */
  beautyFilter?: string | null;
};

function coverScale(containerWidth: number, containerHeight: number): number {
  if (containerWidth < 1 || containerHeight < 1) return 1;
  return Math.max(containerWidth / LIVE_VIDEO_WIDTH, containerHeight / LIVE_VIDEO_HEIGHT);
}

function assignRef<T>(ref: RefObject<T | null>, value: T | null) {
  ref.current = value;
}

/**
 * Stable full-screen camera + DeepAR for Solo Live.
 * Raw video stays decoded underneath (never opacity-hidden) so DeepAR's external feed won't stall.
 */
export const SoloLiveSelfMediaHost = React.memo(function SoloLiveSelfMediaHost({
  mounted,
  visible,
  rawVideoRef,
  deeparPreviewRef,
  showDeeparPreview,
  mirrorSelf,
  beautyVideoRef,
  showBeautyPreview = false,
  beautyFilter = null,
}: SoloLiveSelfMediaHostProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const processRef = useRef<HTMLDivElement>(null);

  const mergeProcessRef = (node: HTMLDivElement | null) => {
    processRef.current = node;
    assignRef(deeparPreviewRef, node);
  };

  useLayoutEffect(() => {
    if (!mounted) return undefined;
    const stage = stageRef.current;
    const process = processRef.current;
    if (!stage || !process) return undefined;

    const syncScale = () => {
      const { width, height } = stage.getBoundingClientRect();
      const scale = coverScale(width, height);
      process.style.transform = `translate(-50%, -50%) scale(${scale})`;
    };

    syncScale();
    const observer = new ResizeObserver(syncScale);
    observer.observe(stage);
    window.addEventListener('resize', syncScale);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', syncScale);
    };
  }, [mounted]);

  /** Browsers may pause off-screen or covered video — keep the DeepAR source playing. */
  useLayoutEffect(() => {
    if (!mounted || !visible) return undefined;
    const video = rawVideoRef.current;
    if (!video) return undefined;

    const keepPlaying = () => {
      if (video.srcObject && video.paused) {
        void video.play().catch(() => {});
      }
    };

    keepPlaying();
    const id = window.setInterval(keepPlaying, 2000);
    video.addEventListener('pause', keepPlaying);
    return () => {
      window.clearInterval(id);
      video.removeEventListener('pause', keepPlaying);
    };
  }, [mounted, rawVideoRef, visible]);

  if (!mounted) return null;

  return (
    <div
      ref={stageRef}
      className="solo-live-self-media-host"
      style={{ visibility: visible ? 'visible' : 'hidden' }}
      aria-hidden
    >
      <video
        ref={rawVideoRef}
        muted
        playsInline
        autoPlay
        className={`solo-live-video${mirrorSelf && !showDeeparPreview && !showBeautyPreview ? ' solo-live-video--mirror' : ''}`}
        style={{
          zIndex: 0,
          ...(beautyFilter && !showDeeparPreview && !showBeautyPreview
            ? { filter: beautyFilter }
            : undefined),
        }}
      />
      {beautyVideoRef ? (
        <video
          ref={beautyVideoRef}
          muted
          playsInline
          autoPlay
          className="solo-live-video"
          style={{
            zIndex: 1,
            opacity: showBeautyPreview ? 1 : 0,
            pointerEvents: 'none',
          }}
        />
      ) : null}
      <div
        className={`solo-live-deepar-viewport${showDeeparPreview ? ' solo-live-deepar-viewport--live' : ''}`}
      >
        <div
          ref={mergeProcessRef}
          className={`solo-live-deepar-process${showDeeparPreview ? ' solo-live-deepar-process--live' : ''}`}
          style={{
            width: LIVE_VIDEO_WIDTH,
            height: LIVE_VIDEO_HEIGHT,
          }}
        />
      </div>
    </div>
  );
});
