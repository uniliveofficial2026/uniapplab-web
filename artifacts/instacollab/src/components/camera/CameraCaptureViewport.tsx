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
  /** Hidden TRTC sink — keeps SDK output alive. */
  beautySinkVideoRef?: RefObject<HTMLVideoElement | null>;
};

/** Edge-to-edge fullscreen camera stage (calls / capture / messages). */
export function CameraCaptureViewport({
  rawStream,
  beautyStream = null,
  showBeautyPreview = false,
  mirrorRaw = true,
  facePreviewRef,
  showFacePreview = false,
  beautySinkVideoRef,
}: CameraCaptureViewportProps) {
  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      <CallVideoSurface
        stream={rawStream}
        layout="fullscreen"
        framing="cover"
        mirrored={mirrorRaw && !showBeautyPreview && !showFacePreview}
        label="Camera preview"
        className={
          showBeautyPreview || showFacePreview ? 'pointer-events-none opacity-0' : 'opacity-100'
        }
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
      {showBeautyPreview && beautyStream ? (
        <CallVideoSurface
          stream={beautyStream}
          layout="fullscreen"
          framing="cover"
          mirrored={false}
          label="Beauty preview"
          className={CALL_VIDEO_FULLSCREEN_CLASS}
        />
      ) : null}
      {facePreviewRef ? (
        <div
          ref={facePreviewRef}
          className={`absolute inset-0 h-full w-full ${showFacePreview ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          aria-hidden={!showFacePreview}
        />
      ) : null}
    </div>
  );
}

export const CAMERA_CAPTURE_ROOT_CLASS =
  'fixed inset-0 z-[3200] h-[100dvh] w-[100dvw] max-h-[100dvh] max-w-[100dvw] overflow-hidden bg-black touch-none overscroll-none';

export const CAMERA_CAPTURE_CHROME_CLASS =
  'absolute inset-x-0 bottom-0 z-20 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 pointer-events-none';
