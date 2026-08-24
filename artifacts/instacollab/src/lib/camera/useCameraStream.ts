import { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  acquireAppCamera,
  forceResetAppCamera,
  getAppCameraFacing,
  releaseAppCamera,
  subscribeAppCamera,
  type CameraFacingMode,
} from './appCameraOwner';
import { WEBAR_CAMERA_FRAME_RATE } from './cameraPipelinePolicy';
import { isCameraPermissionError, formatCameraError } from './errors';

export type { CameraFacingMode };

export type UseCameraStreamOptions = {
  enabled: boolean;
  audio?: boolean;
  facingMode?: CameraFacingMode;
  videoIdeal?: { width: number; height: number };
  frameRate?: { ideal?: number; max?: number };
  /** Lock selfie/back — only changes when caller updates facingMode (Flip button). */
  exactFacing?: boolean;
};

function isLiveVideoStream(stream: MediaStream | null): stream is MediaStream {
  return Boolean(stream?.getVideoTracks().some((track) => track.readyState === 'live'));
}

export function useCameraStream({
  enabled,
  audio = false,
  facingMode = 'user',
  videoIdeal = { width: 640, height: 480 },
  frameRate = WEBAR_CAMERA_FRAME_RATE,
  exactFacing = false,
}: UseCameraStreamOptions) {
  const reactId = useId();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const leaseEpochRef = useRef(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [activeFacing, setActiveFacing] = useState<CameraFacingMode>(facingMode);
  /** Bumped by retry() so getUserMedia runs from a user gesture (required on iOS). */
  const [retryTick, setRetryTick] = useState(0);

  const retry = useCallback(() => {
    setError(null);
    setPermissionDenied(false);
    setReady(false);
    streamRef.current = null;
    setStream(null);
    void forceResetAppCamera().finally(() => {
      setRetryTick((n) => n + 1);
    });
  }, []);

  useEffect(() => {
    if (!enabled) {
      setReady(false);
      setError(null);
      setPermissionDenied(false);
      streamRef.current = null;
      setStream(null);
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('Camera is not supported in this browser.');
      return;
    }

    const epoch = ++leaseEpochRef.current;
    const leaseId = `ui-camera:${reactId}:${epoch}`;
    let cancelled = false;
    let unsub: (() => void) | null = null;

    const markStreamReady = (next: MediaStream) => {
      if (cancelled || epoch !== leaseEpochRef.current || !isLiveVideoStream(next)) return;
      streamRef.current = next;
      setStream(next);
      setActiveFacing(getAppCameraFacing());
      setReady(true);
      setError(null);
      setPermissionDenied(false);
    };

    void acquireAppCamera(leaseId, {
      facingMode,
      audio,
      videoIdeal,
      frameRate,
      exactFacing,
    })
      .then((acquired) => {
        if (cancelled || epoch !== leaseEpochRef.current) {
          releaseAppCamera(leaseId);
          return;
        }
        markStreamReady(acquired);
        unsub = subscribeAppCamera((shared) => {
          if (cancelled || epoch !== leaseEpochRef.current || !shared) return;
          markStreamReady(shared);
        }, false);
      })
      .catch((err) => {
        if (cancelled || epoch !== leaseEpochRef.current) return;
        setReady(false);
        if (isCameraPermissionError(err)) {
          setPermissionDenied(true);
          setError(
            'Camera is blocked for this site. Allow camera in the address-bar icon, then tap Retry.',
          );
        } else {
          setError(formatCameraError(err));
        }
      });

    return () => {
      cancelled = true;
      unsub?.();
      releaseAppCamera(leaseId);
      // Facing / retry remounts must keep the last valid preview until the next
      // stream is attached. Only clear the element when the camera is disabled.
      if (!enabled) {
        streamRef.current = null;
        setStream(null);
        setReady(false);
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
      }
    };
  }, [
    enabled,
    audio,
    facingMode,
    videoIdeal.width,
    videoIdeal.height,
    frameRate.ideal,
    frameRate.max,
    exactFacing,
    reactId,
    retryTick,
  ]);

  /**
   * Self-healing preview bind — reads refs live each tick so the raw <video>
   * gets the stream no matter when it mounts / remounts. Fixes blank preview
   * when the element mounts after the initial acquire.
   */
  useEffect(() => {
    if (!enabled) return undefined;

    const bind = () => {
      const el = videoRef.current;
      const current = streamRef.current;
      if (!el || !isLiveVideoStream(current)) return;
      if (el.srcObject !== current) {
        el.muted = true;
        el.playsInline = true;
        el.setAttribute('playsinline', 'true');
        el.setAttribute('webkit-playsinline', 'true');
        el.srcObject = current;
      }
      if (el.paused) {
        void el.play().catch(() => undefined);
      }
    };

    bind();
    const id = window.setInterval(bind, 2000);
    return () => window.clearInterval(id);
  }, [enabled, stream]);

  return {
    videoRef,
    streamRef,
    stream,
    ready,
    error,
    permissionDenied,
    facingMode: activeFacing,
    retry,
  };
}

export async function captureVideoFrame(
  video: HTMLVideoElement,
  mirror = true,
): Promise<string | null> {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (!width || !height) return null;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  if (mirror) {
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, 0, 0, width, height);
  return canvas.toDataURL('image/png');
}
