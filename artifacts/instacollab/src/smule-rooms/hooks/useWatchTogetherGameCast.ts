import { useCallback, useEffect, useRef, useState } from 'react';
import {
  acquireAppCamera,
  getAppCameraStream,
  releaseAppCamera,
} from '../../lib/camera/appCameraOwner';

type UseWatchTogetherGameCastOptions = {
  /** Room owner / media manager can start device screen cast. */
  canCast: boolean;
};

const CAST_LEASE = 'watch-together-cast';

export function useWatchTogetherGameCast({ canCast }: UseWatchTogetherGameCastOptions) {
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [castError, setCastError] = useState<string | null>(null);
  const [casting, setCasting] = useState(false);
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const cameraVideoRef = useRef<HTMLVideoElement>(null);

  const stopCast = useCallback(() => {
    screenStream?.getTracks().forEach((track) => track.stop());
    releaseAppCamera(CAST_LEASE);
    setScreenStream(null);
    setCameraStream(null);
    setCasting(false);
    setCastError(null);
  }, [screenStream]);

  const startCast = useCallback(async () => {
    if (!canCast || casting) return;
    setCastError(null);
    try {
      const screen = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: true,
      });
      const shared = getAppCameraStream();
      const camera =
        shared ??
        (await acquireAppCamera(CAST_LEASE, {
          audio: false,
          facingMode: 'user',
          exactFacing: false,
          videoIdeal: { width: 480, height: 360 },
          frameRate: { ideal: 24, max: 30 },
        }));
      screen.getVideoTracks()[0]?.addEventListener('ended', () => {
        stopCast();
      });
      setScreenStream(screen);
      setCameraStream(camera);
      setCasting(true);
    } catch (error) {
      const message =
        error instanceof Error && error.name === 'NotAllowedError'
          ? 'Screen share permission denied'
          : error instanceof Error
            ? error.message
            : 'Could not start screen cast';
      setCastError(message);
      stopCast();
    }
  }, [canCast, casting, stopCast]);

  useEffect(() => {
    const screenEl = screenVideoRef.current;
    if (screenEl && screenStream) {
      screenEl.srcObject = screenStream;
      void screenEl.play().catch(() => {});
    }
  }, [screenStream]);

  useEffect(() => {
    const cameraEl = cameraVideoRef.current;
    if (cameraEl && cameraStream) {
      cameraEl.srcObject = cameraStream;
      void cameraEl.play().catch(() => {});
    }
  }, [cameraStream]);

  useEffect(() => () => stopCast(), [stopCast]);

  return {
    casting,
    castError,
    screenStream,
    cameraStream,
    screenVideoRef,
    cameraVideoRef,
    startCast,
    stopCast,
  };
}
