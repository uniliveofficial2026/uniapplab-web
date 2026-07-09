import type { RefObject } from 'react';
import {
  CALL_VIDEO_FULLSCREEN_CLASS,
  CallVideoSurface,
} from './CallVideoSurface';

type ChatCallLocalCameraStageProps = {
  rawStream: MediaStream | null;
  /** Hidden SDK sink — must stay mounted for TRTC getOutput(). */
  beautySinkVideoRef?: RefObject<HTMLVideoElement | null>;
  /** Processed TRTC output for visible preview (clone of SDK stream). */
  beautyDisplayStream?: MediaStream | null;
  deeparPreviewHostRef?: RefObject<HTMLDivElement | null>;
  showBeautyPreview?: boolean;
  showDeeparPreview?: boolean;
  showProcessedPreview?: boolean;
  layout?: 'fullscreen' | 'fill';
  mirrored?: boolean;
  /** When TRTC is configured, hide raw preview until SDK output is ready (avoids mirror flip). */
  trtcConfigured?: boolean;
  trtcLoading?: boolean;
};

/**
 * Local camera for chat video calls.
 * - Raw camera decoded underneath (never removed — keeps TRTC input alive)
 * - Hidden sink video owns the SDK output ref
 * - Visible processed preview uses output MediaStream on CallVideoSurface
 */
export function ChatCallLocalCameraStage({
  rawStream,
  beautySinkVideoRef,
  beautyDisplayStream = null,
  deeparPreviewHostRef,
  showBeautyPreview = false,
  showDeeparPreview = false,
  showProcessedPreview = false,
  layout = 'fullscreen',
  mirrored = true,
  trtcConfigured = false,
  trtcLoading = false,
}: ChatCallLocalCameraStageProps) {
  const videoClass =
    layout === 'fullscreen'
      ? CALL_VIDEO_FULLSCREEN_CLASS
      : 'absolute inset-0 block h-full w-full object-cover object-center';

  const hideRawPreview =
    showProcessedPreview || (trtcConfigured && (trtcLoading || showBeautyPreview));

  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      <CallVideoSurface
        stream={rawStream}
        layout={layout}
        framing="cover"
        mirrored={mirrored && !hideRawPreview}
        label="Your camera"
        className={hideRawPreview ? 'pointer-events-none opacity-0' : 'opacity-100'}
      />
      {beautySinkVideoRef ? (
        <video
          ref={beautySinkVideoRef}
          autoPlay
          playsInline
          muted
          aria-hidden
          className="fixed h-px w-px opacity-0 pointer-events-none"
          style={{ left: -9999, top: -9999 }}
        />
      ) : null}
      {showBeautyPreview && beautyDisplayStream ? (
        <CallVideoSurface
          stream={beautyDisplayStream}
          layout={layout}
          framing="cover"
          mirrored={false}
          label="Your camera"
          className={videoClass}
        />
      ) : null}
      {deeparPreviewHostRef ? (
        <div
          ref={deeparPreviewHostRef}
          className="absolute inset-0 h-full w-full"
          style={{
            opacity: showDeeparPreview ? 1 : 0,
            pointerEvents: 'none',
            zIndex: 2,
          }}
          aria-hidden={!showDeeparPreview}
        />
      ) : null}
    </div>
  );
}
