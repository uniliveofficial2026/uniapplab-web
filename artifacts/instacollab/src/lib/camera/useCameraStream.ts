import { useEffect, useRef, useState } from 'react';
import { isCameraPermissionError } from './errors';

export type CameraFacingMode = 'user' | 'environment';

export type UseCameraStreamOptions = {
  enabled: boolean;
  audio?: boolean;
  facingMode?: CameraFacingMode;
  /** Lower resolution for live AR pipelines (defaults 1280×720). */
  videoIdeal?: { width?: number; height?: number };
  /** Cap capture frame rate for live publishing (defaults uncapped). */
  frameRate?: { ideal?: number; max?: number };
};

export function useCameraStream({
  enabled,
  audio = false,
  facingMode = 'user',
  videoIdeal,
  frameRate,
}: UseCameraStreamOptions) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setReady(false);
      setError(null);
      setPermissionDenied(false);
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera is not supported in this browser.');
      return;
    }

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const attachStream = async (stream: MediaStream) => {
      const tryAttach = async (attempt = 0): Promise<void> => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        const videoEl = videoRef.current;
        if (!videoEl) {
          if (attempt < 20) {
            await new Promise((resolve) => {
              retryTimer = setTimeout(resolve, 50);
            });
            return tryAttach(attempt + 1);
          }
          stream.getTracks().forEach((track) => track.stop());
          throw new Error('Camera preview failed to mount');
        }

        streamRef.current = stream;
        stream.getVideoTracks().forEach((track) => {
          track.contentHint = 'motion';
        });
        videoEl.srcObject = stream;

        await new Promise<void>((resolve, reject) => {
          const cleanup = () => {
            videoEl.removeEventListener('loadedmetadata', onMetadata);
            videoEl.removeEventListener('playing', onPlaying);
            videoEl.removeEventListener('error', onError);
          };
          const onMetadata = () => {
            void videoEl.play().catch(reject);
          };
          const onPlaying = () => {
            cleanup();
            resolve();
          };
          const onError = () => {
            cleanup();
            reject(new Error('Camera preview failed to start'));
          };
          videoEl.addEventListener('loadedmetadata', onMetadata);
          videoEl.addEventListener('playing', onPlaying);
          videoEl.addEventListener('error', onError);
          if (videoEl.readyState >= 1) {
            void videoEl.play().catch(reject);
          }
        });

        if (!cancelled) {
          setReady(true);
          setError(null);
          setPermissionDenied(false);
        }
      };

      await tryAttach();
    };

    void navigator.mediaDevices
      .getUserMedia({
        video: {
          facingMode,
          width: { ideal: videoIdeal?.width ?? 1280 },
          height: { ideal: videoIdeal?.height ?? 720 },
          ...(frameRate ? { frameRate: { ideal: frameRate.ideal ?? 30, max: frameRate.max ?? 30 } } : {}),
        },
        audio,
      })
      .then((stream) => attachStream(stream))
      .catch((err) => {
        if (cancelled) return;
        setReady(false);
        if (isCameraPermissionError(err)) {
          setPermissionDenied(true);
          setError('Camera access is required for AR effects.');
        } else {
          setError(err instanceof Error ? err.message : 'Could not access the camera');
        }
      });

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      setReady(false);
      const stream = streamRef.current;
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      streamRef.current = null;
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [enabled, audio, facingMode, frameRate?.ideal, frameRate?.max, videoIdeal?.height, videoIdeal?.width]);

  /** Re-attach when the preview <video> mounts after the stream is ready. */
  useEffect(() => {
    if (!enabled || !ready) return undefined;
    let attempts = 0;
    let rafId = 0;

    const tryAttach = () => {
      const stream = streamRef.current;
      const videoEl = videoRef.current;
      if (stream && videoEl) {
        if (videoEl.srcObject !== stream) {
          videoEl.srcObject = stream;
        }
        if (videoEl.paused) {
          void videoEl.play().catch(() => {});
        }
        return;
      }
      if (attempts < 40) {
        attempts += 1;
        rafId = requestAnimationFrame(tryAttach);
      }
    };

    tryAttach();
    const keepAlive = window.setInterval(() => {
      const videoEl = videoRef.current;
      const stream = streamRef.current;
      if (!videoEl || !stream) return;
      if (videoEl.srcObject !== stream) {
        videoEl.srcObject = stream;
      }
      if (videoEl.paused) {
        void videoEl.play().catch(() => {});
      }
    }, 2000);

    return () => {
      cancelAnimationFrame(rafId);
      window.clearInterval(keepAlive);
    };
  }, [enabled, ready]);

  return {
    videoRef,
    streamRef,
    ready,
    error,
    permissionDenied,
    facingMode,
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
