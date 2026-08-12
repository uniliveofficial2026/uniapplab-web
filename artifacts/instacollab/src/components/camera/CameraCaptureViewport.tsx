import type { RefObject } from 'react';
import {
  CallVideoSurface,
  CALL_VIDEO_FULLSCREEN_CLASS,
} from '../messages/CallVideoSurface';

export type CameraCaptureViewportProps = {
  rawStream: MediaStream | null;
  beautyStream?: MediaStream | null;
  showBeautyPreview?: boolean;
  mirrorRaw?: boolean;
  facePreviewRef?: RefObject<HTMLDivElement | null>;
  showFacePreview?: boolean;
  /** TRTC output sink — shown full-bleed when beauty preview is active (same element the SDK paints). */
  beautySinkVideoRef?: RefObject<HTMLVideoElement | null>;
};

/**
 * Edge-to-edge camera stage.
 * Raw camera ALWAYS stays mounted underneath. Beauty overlays with the SAME CSS mirror +
 * object-fit cover so FOV does not jump when effects turn on (SDK mirror stays off).
 */
export function CameraCaptureViewport({
  rawStream,
  beautyStream = null,
  showBeautyPreview = false,
  mirrorRaw = true,
  facePreviewRef,
  showFacePreview = false,
  beautySinkVideoRef,
}: CameraCaptureViewportProps) {
  const showTrtcSink = Boolean(showBeautyPreview && beautySinkVideoRef);
  const showTrtcStreamSurface = Boolean(showBeautyPreview && beautyStream && !beautySinkVideoRef);
  const coverRaw = showTrtcSink || showTrtcStreamSurface || showFacePreview;
  const mirrorClass = mirrorRaw ? ' origin-center [transform:scaleX(-1)_translateZ(0)]' : '';

  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      <CallVideoSurface
        stream={rawStream}
        layout="fullscreen"
        framing="cover"
        mirrored={mirrorRaw}
        label="Camera preview"
        className={coverRaw ? 'opacity-100' : 'opacity-100'}
      />
      {beautySinkVideoRef ? (
        <video
          ref={beautySinkVideoRef}
          autoPlay
          playsInline
          muted
          aria-hidden={!showTrtcSink}
          className={
            showTrtcSink
              ? `absolute inset-0 z-[1] h-full w-full object-cover object-center${mirrorClass}`
              : 'fixed h-px w-px opacity-0 pointer-events-none'
          }
          style={showTrtcSink ? undefined : { left: -9999, top: -9999 }}
        />
      ) : null}
      {showTrtcStreamSurface ? (
        <CallVideoSurface
          stream={beautyStream}
          layout="fullscreen"
          framing="cover"
          mirrored={mirrorRaw}
          label="Beauty preview"
          className={`${CALL_VIDEO_FULLSCREEN_CLASS} z-[1]`}
        />
      ) : null}
      {facePreviewRef ? (
        <div
          ref={facePreviewRef}
          className={`absolute inset-0 z-[2] h-full w-full ${showFacePreview ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          aria-hidden={!showFacePreview}
        />
      ) : null}
    </div>
  );
}

export const CAMERA_CAPTURE_ROOT_CLASS =
  'fixed inset-0 z-[3200] h-vv w-[100dvw] max-h-vv max-w-[100dvw] overflow-hidden bg-black touch-none overscroll-none';

export const CAMERA_CAPTURE_CHROME_CLASS =
  'absolute inset-x-0 bottom-0 z-20 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 pointer-events-none';
