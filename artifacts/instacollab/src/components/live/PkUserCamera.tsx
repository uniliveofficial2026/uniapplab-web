import { memo, useEffect, useRef, type ReactNode } from 'react';

/** Minimal LiveKit-compatible attach surface — keeps adaptiveStream/dynacast working. */
export type PkAttachableVideoTrack = {
  attach: (element: HTMLMediaElement) => HTMLMediaElement;
  detach: (element?: HTMLMediaElement) => HTMLMediaElement[];
  mediaStreamTrack?: MediaStreamTrack;
};

export type PkUserCameraProps = {
  userId: string;
  mediaStream?: MediaStream | null;
  /** Prefer attachable LiveKit RemoteVideoTrack over raw MediaStreamTrack. */
  liveKitTrack?: PkAttachableVideoTrack | null;
  videoTrack?: MediaStreamTrack | null;
  muted?: boolean;
  mirror?: boolean;
};

/**
 * Stable LiveKit/local camera mount keyed by canonical user_id.
 * Scores, comments, timer, and viewer counts must not remount this node.
 * Prefer `liveKitTrack.attach` so SFU adaptive subscriptions remain active.
 */
export const PkUserCamera = memo(function PkUserCamera({
  userId,
  mediaStream,
  liveKitTrack,
  videoTrack,
  muted = true,
  mirror = false,
}: PkUserCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    if (mediaStream) {
      el.srcObject = mediaStream;
      void el.play().catch(() => undefined);
      return () => {
        if (el.srcObject === mediaStream) el.srcObject = null;
      };
    }

    if (liveKitTrack && typeof liveKitTrack.attach === 'function') {
      liveKitTrack.attach(el);
      void el.play().catch(() => undefined);
      return () => {
        try {
          liveKitTrack.detach(el);
        } catch {
          /* ignore */
        }
      };
    }

    if (videoTrack && videoTrack.readyState === 'live') {
      const stream = new MediaStream([videoTrack]);
      el.srcObject = stream;
      void el.play().catch(() => undefined);
      return () => {
        if (el.srcObject === stream) el.srcObject = null;
      };
    }

    el.srcObject = null;
    return undefined;
  }, [mediaStream, liveKitTrack, videoTrack]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={muted}
      data-pk-user-id={userId}
      style={mirror ? { transform: 'scaleX(-1)' } : undefined }
    />
  );
}, (prev, next) => (
  prev.userId === next.userId
  && prev.mediaStream === next.mediaStream
  && prev.liveKitTrack === next.liveKitTrack
  && prev.videoTrack === next.videoTrack
  && prev.muted === next.muted
  && prev.mirror === next.mirror
));

export function emptyPkCameraPlaceholder(label: string): ReactNode {
  return (
    <div className="u1pk-camera-empty" data-pk-camera-empty="true">
      {label}
    </div>
  );
}
