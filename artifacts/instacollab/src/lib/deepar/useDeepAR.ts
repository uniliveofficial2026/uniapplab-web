import { useCallback, useEffect, useRef, useState } from 'react';
import type { DeepAR } from 'deepar';
import {
  getDeepARRootPath,
  getDeepARLicenseKey,
  getDeepAREffectUrl,
  isDeepARConfigured,
} from './deeparConfig';
import { initializeDeepAR, isCameraPermissionError } from './deeparClient';

export type UseDeepAROptions = {
  previewRef: React.RefObject<HTMLElement | null>;
  /** When set, AR is applied to this existing camera video instead of opening a second camera. */
  videoElementRef?: React.RefObject<HTMLVideoElement | null>;
  enabled: boolean;
  initialEffectId?: string;
  mirror?: boolean;
};

export function useDeepAR({
  previewRef,
  videoElementRef,
  enabled,
  initialEffectId = 'none',
  mirror = true,
}: UseDeepAROptions) {
  const instanceRef = useRef<DeepAR | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [activeEffectId, setActiveEffectId] = useState(initialEffectId);

  useEffect(() => {
    if (!enabled || !isDeepARConfigured()) {
      setReady(false);
      setLoading(false);
      return;
    }

    const preview = previewRef.current;
    if (!preview) return;

    let cancelled = false;

    void (async () => {
      setLoading(true);
      setLoadProgress(0);
      setError(null);
      setPermissionDenied(false);

      try {
        const useExternalVideo = Boolean(videoElementRef);
        const initialEffect =
          initialEffectId !== 'none' ? getDeepAREffectUrl(initialEffectId) ?? undefined : undefined;

        const deepAR = await initializeDeepAR({
          licenseKey: getDeepARLicenseKey(),
          previewElement: preview,
          rootPath: getDeepARRootPath(),
          effect: initialEffect,
          useExternalVideo,
          onProgress: (progress) => {
            if (!cancelled && progress.total > 0) {
              setLoadProgress(Math.round((progress.loaded / progress.total) * 100));
            }
          },
        });

        if (cancelled) {
          deepAR.shutdown();
          return;
        }

        instanceRef.current = deepAR;

        if (useExternalVideo && videoElementRef) {
          const externalVideo = videoElementRef.current;
          if (externalVideo && externalVideo.readyState >= 1) {
            deepAR.setVideoElement(externalVideo, mirror);
          } else if (externalVideo) {
            await new Promise<void>((resolve) => {
              const onReady = () => {
                externalVideo.removeEventListener('loadedmetadata', onReady);
                resolve();
              };
              externalVideo.addEventListener('loadedmetadata', onReady);
            });
            if (!cancelled) deepAR.setVideoElement(externalVideo, mirror);
          }
        }

        if (!cancelled) {
          setActiveEffectId(initialEffectId);
          setReady(true);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          if (isCameraPermissionError(err)) {
            setPermissionDenied(true);
            setError('Camera access is required for AR effects.');
          } else {
            const message =
              err instanceof Error ? err.message : 'DeepAR failed to initialize';
            setError(message);
          }
          setReady(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      const inst = instanceRef.current;
      if (inst) {
        try {
          inst.stopVideo();
          inst.shutdown();
        } catch {
          /* ignore */
        }
        instanceRef.current = null;
      }
      setReady(false);
      setLoading(false);
    };
  }, [enabled, previewRef, videoElementRef, mirror]);

  const switchEffect = useCallback(async (effectId: string) => {
    const inst = instanceRef.current;
    if (!inst) return;
    setActiveEffectId(effectId);
    if (effectId === 'none') {
      inst.clearEffect();
      return;
    }
    const url = getDeepAREffectUrl(effectId);
    if (url) await inst.switchEffect(url);
  }, []);

  const takeScreenshot = useCallback(async (): Promise<string | null> => {
    try {
      return (await instanceRef.current?.takeScreenshot()) ?? null;
    } catch {
      return null;
    }
  }, []);

  const startVideoRecording = useCallback(async (recordAudio = true) => {
    await instanceRef.current?.startVideoRecording({ recordAudio });
  }, []);

  const finishVideoRecording = useCallback(async (): Promise<Blob | null> => {
    try {
      return (await instanceRef.current?.finishVideoRecording()) ?? null;
    } catch {
      return null;
    }
  }, []);

  const getCanvasStream = useCallback((fps = 30): MediaStream | null => {
    const canvas = previewRef.current?.querySelector('canvas');
    if (!canvas) return null;
    return canvas.captureStream(fps);
  }, [previewRef]);

  const getProcessedStream = useCallback(async (fps = 30): Promise<MediaStream | null> => {
    const video = getCanvasStream(fps);
    if (!video) return null;
    try {
      const audio = await navigator.mediaDevices.getUserMedia({ audio: true });
      return new MediaStream([
        ...video.getVideoTracks(),
        ...audio.getAudioTracks(),
      ]);
    } catch {
      return video;
    }
  }, [getCanvasStream]);

  return {
    ready,
    loading,
    loadProgress,
    error,
    permissionDenied,
    activeEffectId,
    switchEffect,
    takeScreenshot,
    startVideoRecording,
    finishVideoRecording,
    getCanvasStream,
    getProcessedStream,
    instanceRef,
  };
}
