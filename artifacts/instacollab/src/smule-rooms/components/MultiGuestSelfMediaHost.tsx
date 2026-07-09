import React, { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { LIVE_VIDEO_HEIGHT, LIVE_VIDEO_WIDTH } from '../hooks/liveVideoConstants';

type SelfMediaBounds = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type MultiGuestSelfMediaHostProps = {
  stageRef: RefObject<HTMLElement | null>;
  anchorRef: RefObject<HTMLElement | null>;
  seatKey: string | null;
  active: boolean;
  rawVideoRef: RefObject<HTMLVideoElement | null>;
  deeparPreviewRef: RefObject<HTMLDivElement | null>;
  showDeeparPreview: boolean;
  mirrorSelf: boolean;
  beautyVideoRef?: RefObject<HTMLVideoElement | null>;
  showBeautyPreview?: boolean;
  beautyFilter?: string | null;
};

function coverScale(containerWidth: number, containerHeight: number): number {
  if (containerWidth < 1 || containerHeight < 1) return 1;
  return Math.max(containerWidth / LIVE_VIDEO_WIDTH, containerHeight / LIVE_VIDEO_HEIGHT);
}

function setRef<T>(ref: RefObject<T | null> | ((instance: T | null) => void), value: T | null) {
  if (typeof ref === 'function') {
    ref(value);
  } else {
    ref.current = value;
  }
}

/**
 * Stable camera + DeepAR DOM (never unmounts on seat change).
 * Raw video stays decoded underneath so DeepAR's external feed won't stall.
 */
export const MultiGuestSelfMediaHost: React.FC<MultiGuestSelfMediaHostProps> = ({
  stageRef,
  anchorRef,
  seatKey,
  active,
  rawVideoRef,
  deeparPreviewRef,
  showDeeparPreview,
  mirrorSelf,
  beautyVideoRef,
  showBeautyPreview = false,
  beautyFilter = null,
}) => {
  const [bounds, setBounds] = useState<SelfMediaBounds | null>(null);
  const tileRef = useRef<HTMLDivElement>(null);
  const processRef = useRef<HTMLDivElement>(null);

  const mergeProcessRef = (node: HTMLDivElement | null) => {
    processRef.current = node;
    setRef(deeparPreviewRef, node);
  };

  useEffect(() => {
    if (!active) {
      setBounds(null);
      return undefined;
    }

    let cancelled = false;
    let rafId = 0;
    let observer: ResizeObserver | null = null;

    const measure = () => {
      const stage = stageRef.current;
      const anchor = anchorRef.current;
      if (!stage || !anchor) {
        setBounds(null);
        return;
      }
      const stageRect = stage.getBoundingClientRect();
      const anchorRect = anchor.getBoundingClientRect();
      if (anchorRect.width < 1 || anchorRect.height < 1) {
        setBounds(null);
        return;
      }
      setBounds({
        left: anchorRect.left - stageRect.left,
        top: anchorRect.top - stageRect.top,
        width: anchorRect.width,
        height: anchorRect.height,
      });
    };

    const attach = () => {
      if (cancelled) return;
      const stage = stageRef.current;
      const anchor = anchorRef.current;
      if (!stage || !anchor) {
        rafId = requestAnimationFrame(attach);
        return;
      }
      measure();
      observer = new ResizeObserver(measure);
      observer.observe(stage);
      observer.observe(anchor);
      window.addEventListener('resize', measure);
    };

    attach();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [active, anchorRef, seatKey, stageRef]);

  useLayoutEffect(() => {
    if (!active) return undefined;
    const tile = tileRef.current;
    const process = processRef.current;
    if (!tile || !process) return undefined;

    const syncScale = () => {
      const { width, height } = tile.getBoundingClientRect();
      const scale = coverScale(width, height);
      process.style.transform = `translate(-50%, -50%) scale(${scale})`;
    };

    syncScale();
    const observer = new ResizeObserver(syncScale);
    observer.observe(tile);
    window.addEventListener('resize', syncScale);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', syncScale);
    };
  }, [active, bounds?.width, bounds?.height]);

  useLayoutEffect(() => {
    if (!active) return undefined;
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
  }, [active, rawVideoRef]);

  if (!active) return null;

  return (
    <div
      className="multi-guest-self-media-host"
      style={
        bounds
          ? {
              left: bounds.left,
              top: bounds.top,
              width: bounds.width,
              height: bounds.height,
            }
          : { opacity: 0, pointerEvents: 'none' }
      }
      aria-hidden
    >
      <div ref={tileRef} className="multi-guest-video-tile-self-media">
        <video
          ref={rawVideoRef}
          muted
          playsInline
          autoPlay
          className={`multi-guest-video-tile-media ${
            mirrorSelf && !showDeeparPreview && !showBeautyPreview
              ? 'multi-guest-video-tile-media--self'
              : 'multi-guest-video-tile-media--self-ar'
          }`}
          style={
            beautyFilter && !showDeeparPreview && !showBeautyPreview
              ? { filter: beautyFilter }
              : undefined
          }
        />
        {beautyVideoRef ? (
          <video
            ref={beautyVideoRef}
            muted
            playsInline
            autoPlay
            className="multi-guest-video-tile-media multi-guest-video-tile-media--self-ar"
            style={{
              opacity: showBeautyPreview ? 1 : 0,
              pointerEvents: 'none',
            }}
          />
        ) : null}
        <div
          className={`multi-guest-video-tile-deepar${showDeeparPreview ? ' multi-guest-video-tile-deepar--live' : ''}`}
        >
          <div
            ref={mergeProcessRef}
            className="multi-guest-deepar-process"
            style={{
              width: LIVE_VIDEO_WIDTH,
              height: LIVE_VIDEO_HEIGHT,
            }}
          />
        </div>
      </div>
    </div>
  );
};
