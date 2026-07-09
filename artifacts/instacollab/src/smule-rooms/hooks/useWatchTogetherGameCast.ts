import { useCallback, useEffect, useRef, useState } from 'react';

type UseWatchTogetherGameCastOptions = {
  /** Room owner / media manager can start device screen cast. */
  canCast: boolean;
};

export function useWatchTogetherGameCast({ canCast }: UseWatchTogetherGameCastOptions) {
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [castError, setCastError] = useState<string | null>(null);
  const [casting, setCasting] = useState(false);
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const cameraVideoRef = useRef<HTMLVideoElement>(null);

  const stopCast = useCallback(() => {
    screenStream?.getTracks().forEach((track) => track.stop());
    cameraStream?.getTracks().forEach((track) => track.stop());
    setScreenStream(null);
    setCameraStream(null);
    setCasting(false);
    setCastError(null);
  }, [cameraStream, screenStream]);

  const startCast = useCallback(async () => {
    if (!canCast || casting) return;
    setCastError(null);
    try {
      const screen = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: true,
      });
      const camera = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 480, height: 360 },
        audio: false,
      });
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
