import { useEffect, useRef, useState } from 'react';
import { WEBAR_CAMERA_FRAME_RATE } from './cameraPipelinePolicy';
import { isCameraPermissionError } from './errors';

export type CameraFacingMode = 'user' | 'environment';

export type UseCameraStreamOptions = {
  enabled: boolean;
  audio?: boolean;
  facingMode?: CameraFacingMode;
  videoIdeal?: { width: number; height: number };
  frameRate?: { ideal?: number; max?: number };
  /** Lock selfie/back — only changes when caller updates facingMode (Flip button). */
  exactFacing?: boolean;
};

async function acquireCameraStream(options: {
  facingMode: CameraFacingMode;
  audio: boolean;
  videoIdeal: { width: number; height: number };
  frameRate: { ideal?: number; max?: number };
  exactFacing: boolean;
}): Promise<MediaStream> {
  const video: MediaTrackConstraints = {
    width: { ideal: options.videoIdeal.width },
    height: { ideal: options.videoIdeal.height },
    frameRate: options.frameRate,
    facingMode: options.exactFacing
      ? { exact: options.facingMode }
      : options.facingMode,
  };

  try {
    return await navigator.mediaDevices.getUserMedia({ video, audio: options.audio });
  } catch (err) {
    if (!options.exactFacing) throw err;
    return navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: options.videoIdeal.width },
        height: { ideal: options.videoIdeal.height },
        frameRate: options.frameRate,
        facingMode: options.facingMode,
      },
      audio: options.audio,
    });
  }
}

export function useCameraStream({
  enabled,
  audio = false,
  facingMode = 'user',
  videoIdeal = { width: 1280, height: 720 },
  frameRate = WEBAR_CAMERA_FRAME_RATE,
  exactFacing = true,
}: UseCameraStreamOptions) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setReady(false);
      setError(null);
      setPermissionDenied(false);
      const stream = streamRef.current;
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      streamRef.current = null;
      setStream(null);
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
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
          if (attempt < 24) {
            await new Promise((resolve) => {
              retryTimer = setTimeout(resolve, 40);
            });
            return tryAttach(attempt + 1);
          }
          stream.getTracks().forEach((track) => track.stop());
          throw new Error('Camera preview failed to mount');
        }

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

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        const previous = streamRef.current;
        streamRef.current = stream;
        setStream(stream);
        if (previous && previous !== stream) {
          previous.getTracks().forEach((track) => track.stop());
        }

        setReady(true);
        setError(null);
        setPermissionDenied(false);
      };

      await tryAttach();
    };

    void acquireCameraStream({
      facingMode,
      audio,
      videoIdeal,
      frameRate,
      exactFacing,
    })
      .then((stream) => attachStream(stream))
      .catch((err) => {
        if (cancelled) return;
        setReady(false);
        if (isCameraPermissionError(err)) {
          setPermissionDenied(true);
          setError('Camera access is required.');
        } else {
          setError(err instanceof Error ? err.message : 'Could not access the camera');
        }
      });

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      const stream = streamRef.current;
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      streamRef.current = null;
      setStream(null);
      setReady(false);
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [enabled, audio, facingMode, videoIdeal.width, videoIdeal.height, frameRate.ideal, frameRate.max, exactFacing]);

  return {
    videoRef,
    streamRef,
    stream,
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
