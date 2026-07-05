import React, { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';

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
  /** Keep camera + DeepAR DOM mounted while seated (survives camera toggle). */
  mounted: boolean;
  /** Show preview when camera is on. */
  visible: boolean;
  rawVideoRef: RefObject<HTMLVideoElement | null>;
  deeparPreviewRef: RefObject<HTMLDivElement | null>;
  showDeeparPreview: boolean;
  deeparWarm?: boolean;
  mirrorSelf: boolean;
  /** Tencent WebAR processed output video. */
  beautyVideoRef?: RefObject<HTMLVideoElement | null>;
  showBeautyPreview?: boolean;
  /** CSS fallback when WebAR credentials are missing. */
  beautyFilter?: string | null;
};

function assignRef<T>(ref: RefObject<T | null>, value: T | null) {
  ref.current = value;
}

/**
 * Stable camera + DeepAR DOM (never unmounts on seat change).
 * Raw video stays decoded underneath so DeepAR's external feed won't stall.
 */
export const MultiGuestSelfMediaHost: React.FC<MultiGuestSelfMediaHostProps> = ({
  stageRef,
  anchorRef,
  seatKey,
  mounted,
  visible,
  rawVideoRef,
  deeparPreviewRef,
  showDeeparPreview,
  deeparWarm = false,
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
    assignRef(deeparPreviewRef, node);
  };

  useEffect(() => {
    if (!mounted) {
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
  }, [mounted, anchorRef, seatKey, stageRef]);

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
      className="multi-guest-self-media-host"
      style={{
        ...(bounds
          ? {
              left: bounds.left,
              top: bounds.top,
              width: bounds.width,
              height: bounds.height,
            }
          : { opacity: 0, pointerEvents: 'none' }),
        visibility: visible ? 'visible' : 'hidden',
      }}
      aria-hidden
    >
      <div ref={tileRef} className="multi-guest-video-tile-self-media">
        <video
          ref={rawVideoRef}
          muted
          playsInline
          autoPlay
          className={`multi-guest-video-tile-media ${mirrorSelf && !showDeeparPreview && !showBeautyPreview ? 'multi-guest-video-tile-media--self' : 'multi-guest-video-tile-media--self-ar'}`}
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
            className="multi-guest-video-tile-media multi-guest-video-tile-media--self-ar"
            style={{
              zIndex: 1,
              opacity: showBeautyPreview ? 1 : 0,
              pointerEvents: 'none',
            }}
          />
        ) : null}
        <div
          className={`multi-guest-video-tile-deepar${
            showDeeparPreview
              ? ' multi-guest-video-tile-deepar--live'
              : deeparWarm
                ? ' multi-guest-video-tile-deepar--warm'
                : ''
          }`}
        >
          <div
            ref={mergeProcessRef}
            className={`multi-guest-deepar-process${showDeeparPreview ? ' multi-guest-deepar-process--live' : ''}`}
          />
        </div>
      </div>
    </div>
  );
};
