import React, { useLayoutEffect, useRef } from 'react';
import type { RefObject } from 'react';

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
  const processRef = useRef<HTMLDivElement>(null);

  const mergeProcessRef = (node: HTMLDivElement | null) => {
    processRef.current = node;
    assignRef(deeparPreviewRef, node);
  };

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
      className="solo-live-self-media-host"
      style={{ visibility: visible ? 'visible' : 'hidden' }}
      aria-hidden
    >
      <video
        ref={rawVideoRef}
        muted
        playsInline
        autoPlay
        className={`solo-live-video${mirrorSelf ? ' solo-live-video--mirror' : ''}`}
        style={{
          zIndex: 0,
          ...(beautyFilter && !showDeeparPreview ? { filter: beautyFilter } : undefined),
        }}
      />
      {beautyVideoRef ? (
        <video
          ref={beautyVideoRef}
          muted
          playsInline
          autoPlay
          className={`solo-live-video${mirrorSelf ? ' solo-live-video--mirror' : ''}`}
          style={{
            zIndex: 1,
            opacity: showBeautyPreview ? 1 : 0,
            pointerEvents: 'none',
          }}
        />
      ) : null}
      <div
        className={`solo-live-deepar-viewport${showDeeparPreview ? ' solo-live-deepar-viewport--live' : ''}${
          mirrorSelf ? ' solo-live-video--mirror' : ''
        }`}
      >
        <div
          ref={mergeProcessRef}
          className={`solo-live-deepar-process${showDeeparPreview ? ' solo-live-deepar-process--live' : ''}`}
        />
      </div>
    </div>
  );
});
