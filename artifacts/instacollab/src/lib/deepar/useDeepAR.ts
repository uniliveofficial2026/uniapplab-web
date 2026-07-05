import { useCallback, useEffect, useRef, useState } from 'react';
import type { DeepAR } from 'deepar';
import * as Beauty from '@deepar/beauty';
import {
  getDeepARRootPath,
  getDeepARBeautyRootPath,
  getDeepARLicenseKey,
  getDeepAREffectUrl,
  getDeepARBeautyPresetUrl,
  isDeepARBeautyPreset,
  isDeepARConfigured,
} from './deeparConfig';
import { initializeDeepAR, isCameraPermissionError } from './deeparClient';
import {
  deeparSelectionActive,
  resolveDeepARPrimaryEffectId,
  type DeepAREffectSelection,
} from './deeparEffectSelection';
import {
  applyBodyShapeToDeepAR,
  EMPTY_BODY_SHAPE,
  isBodyShapeActive,
  type BodyShapeParams,
} from '../ar/bodyShape';

type DeepARBeautyApi = Awaited<ReturnType<typeof Beauty.initializeBeauty>>;

async function waitForVideoElement(
  videoElementRef: React.RefObject<HTMLVideoElement | null>,
  isCancelled: () => boolean,
  timeoutMs = 15_000,
): Promise<HTMLVideoElement> {
  const deadline = Date.now() + timeoutMs;

  while (!isCancelled()) {
    const video = videoElementRef.current;
    if (video?.srcObject) {
      if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.paused) {
        await new Promise<void>((resolve, reject) => {
          const cleanup = () => {
            video.removeEventListener('playing', onPlaying);
            video.removeEventListener('error', onError);
            window.clearTimeout(timeoutId);
          };
          const onPlaying = () => {
            cleanup();
            resolve();
          };
          const onError = () => {
            cleanup();
            reject(new Error('Camera video failed to load'));
          };
          const timeoutId = window.setTimeout(() => {
            cleanup();
            reject(new Error('Camera video failed to start playing'));
          }, timeoutMs);
          video.addEventListener('playing', onPlaying);
          video.addEventListener('error', onError);
          void video.play().catch(onError);
        });
      }
      if (!isCancelled()) return video;
    }

    if (Date.now() > deadline) {
      throw new Error('Camera did not become ready in time');
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  throw new Error('DeepAR initialization cancelled');
}

async function waitForPreviewElement(
  previewRef: React.RefObject<HTMLElement | null>,
  isCancelled: () => boolean,
  timeoutMs = 5_000,
): Promise<HTMLElement> {
  const deadline = Date.now() + timeoutMs;

  while (!isCancelled()) {
    const preview = previewRef.current;
    if (preview && preview.clientWidth > 0 && preview.clientHeight > 0) {
      return preview;
    }
    if (Date.now() > deadline) {
      throw new Error('AR preview area is not ready');
    }
    await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
  }

  throw new Error('DeepAR initialization cancelled');
}

export type UseDeepAROptions = {
  previewRef: React.RefObject<HTMLElement | null>;
  /** When set, AR is applied to this existing camera video instead of opening a second camera. */
  videoElementRef?: React.RefObject<HTMLVideoElement | null>;
  enabled: boolean;
  /** When false the engine stays warm but paused (no effect processing). */
  processingActive?: boolean;
  initialEffectId?: string;
  /** Multi-slot selection — one effect per category. */
  effectSelection?: DeepAREffectSelection;
  mirror?: boolean;
  /** Face / body sculpt sliders (DeepAR Beauty face morphing). */
  bodyShape?: BodyShapeParams;
};

export function useDeepAR({
  previewRef,
  videoElementRef,
  enabled,
  processingActive = true,
  initialEffectId = 'none',
  effectSelection,
  mirror = true,
  bodyShape = EMPTY_BODY_SHAPE,
}: UseDeepAROptions) {
  const instanceRef = useRef<DeepAR | null>(null);
  const beautyRef = useRef<DeepARBeautyApi | null>(null);
  const beautyReadyRef = useRef(false);
  const beautyInitPromiseRef = useRef<Promise<DeepARBeautyApi | null> | null>(null);
  const applyTokenRef = useRef(0);
  const activeModeRef = useRef<'none' | 'beauty' | 'effect'>('none');
  const canvasStreamRef = useRef<{ canvas: HTMLCanvasElement; fps: number; stream: MediaStream } | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [activeEffectId, setActiveEffectId] = useState(initialEffectId);
  const [previewReady, setPreviewReady] = useState(false);

  // Wait until the preview host is mounted with real dimensions (panel may open after enable).
  useEffect(() => {
    if (!enabled) {
      setPreviewReady(false);
      return undefined;
    }

    let cancelled = false;
    let observer: ResizeObserver | null = null;
    let observed: Element | null = null;

    const measure = () => {
      if (cancelled) return;
      const preview = previewRef.current;
      setPreviewReady(Boolean(preview && preview.clientWidth > 0 && preview.clientHeight > 0));
    };

    const attachObserver = () => {
      const preview = previewRef.current;
      if (!preview || preview === observed) return;
      observer?.disconnect();
      observer = new ResizeObserver(measure);
      observer.observe(preview);
      observed = preview;
    };

    measure();
    attachObserver();

    const pollId = window.setInterval(() => {
      if (cancelled) return;
      attachObserver();
      measure();
    }, 120);

    return () => {
      cancelled = true;
      window.clearInterval(pollId);
      observer?.disconnect();
      setPreviewReady(false);
    };
  }, [enabled, previewRef]);

  useEffect(() => {
    if (!enabled || !isDeepARConfigured()) {
      setReady(false);
      setLoading(false);
      return;
    }
    if (!previewReady) {
      setReady(false);
      setLoading(true);
      return;
    }

    let cancelled = false;
    const useExternalVideo = Boolean(videoElementRef);

    void (async () => {
      setLoading(true);
      setLoadProgress(0);
      setError(null);
      setPermissionDenied(false);

      try {
        const preview = await waitForPreviewElement(previewRef, () => cancelled);
        // Only pass .deepar paths at init — Beauty looks are applied after Beauty plugin boots.
        const initialEffect =
          initialEffectId !== 'none' && !isDeepARBeautyPreset(initialEffectId)
            ? getDeepAREffectUrl(initialEffectId) ?? undefined
            : undefined;

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
          const externalVideo = await waitForVideoElement(videoElementRef, () => cancelled);
          if (cancelled) {
            deepAR.shutdown();
            return;
          }
          deepAR.setVideoElement(externalVideo, mirror);
        } else {
          await deepAR.startCamera({ mirror });
        }

        // Mark DeepAR ready immediately — Beauty boots in the background.
        deepAR.setPaused(!processingActive);
        if (!cancelled) {
          setActiveEffectId(processingActive ? initialEffectId : 'none');
          setReady(true);
          setError(null);
          setLoading(false);
        }

        beautyInitPromiseRef.current = (async () => {
          try {
            const beauty = await Beauty.initializeBeauty(deepAR, getDeepARBeautyRootPath());
            if (cancelled) {
              try {
                beauty.disable(true);
              } catch {
                /* ignore */
              }
              return null;
            }
            beauty.disable(true);
            beautyRef.current = beauty;
            beautyReadyRef.current = true;
            return beauty;
          } catch (beautyErr) {
            console.warn('[deepar] Beauty plugin failed to initialize', beautyErr);
            beautyRef.current = null;
            beautyReadyRef.current = false;
            return null;
          }
        })();
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
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      applyTokenRef.current += 1;
      beautyInitPromiseRef.current = null;
      beautyReadyRef.current = false;
      activeModeRef.current = 'none';
      const beauty = beautyRef.current;
      if (beauty) {
        try {
          beauty.reset();
          beauty.disable(true);
        } catch {
          /* ignore */
        }
        beautyRef.current = null;
      }
      const inst = instanceRef.current;
      if (inst) {
        try {
          // stopVideo() can pause an external <video> feed; shutdown is enough.
          if (!useExternalVideo) {
            inst.stopVideo();
          }
          inst.shutdown();
        } catch {
          /* ignore */
        }
        instanceRef.current = null;
      }
      canvasStreamRef.current = null;
      setReady(false);
      setLoading(false);
    };
  }, [enabled, initialEffectId, mirror, previewReady, previewRef, processingActive, videoElementRef]);

  const ensureBeauty = useCallback(async (): Promise<DeepARBeautyApi | null> => {
    if (beautyRef.current) return beautyRef.current;
    if (beautyInitPromiseRef.current) return beautyInitPromiseRef.current;
    return null;
  }, []);

  const switchEffect = useCallback(async (effectId: string, stackWithBeauty = false) => {
    const inst = instanceRef.current;
    if (!inst) return;
    const token = ++applyTokenRef.current;
    setActiveEffectId(effectId);

    if (effectId === 'none') {
      try {
        beautyRef.current?.reset();
        beautyRef.current?.disable(true);
      } catch {
        /* ignore */
      }
      try {
        inst.clearEffect();
      } catch {
        /* ignore */
      }
      activeModeRef.current = 'none';
      return;
    }

    // Beauty plugin looks / body-shaping presets (makeup + face morphing).
    if (isDeepARBeautyPreset(effectId)) {
      const presetUrl = getDeepARBeautyPresetUrl(effectId);
      const beauty = await ensureBeauty();
      if (token !== applyTokenRef.current) return;
      if (!beauty || !presetUrl) {
        setError('DeepAR Beauty plugin is not available.');
        return;
      }
      try {
        // Only tear down a free-pack effect when leaving that mode.
        if (activeModeRef.current === 'effect') {
          inst.clearEffect();
        }
        beauty.disable(false);
        await beauty.importPreset(presetUrl);
        if (token !== applyTokenRef.current) return;
        activeModeRef.current = 'beauty';
        setError(null);
      } catch (err) {
        if (token !== applyTokenRef.current) return;
        setError(err instanceof Error ? err.message : 'Failed to apply beauty preset');
      }
      return;
    }

    // Free-pack / SDK .deepar effects (masks, glasses, backgrounds, animations).
    try {
      if (activeModeRef.current === 'beauty' && !stackWithBeauty) {
        beautyRef.current?.reset();
        beautyRef.current?.disable(true);
      }
    } catch {
      /* ignore */
    }
    const url = getDeepAREffectUrl(effectId);
    if (url) {
      await inst.switchEffect(url);
      if (token !== applyTokenRef.current) return;
      activeModeRef.current = 'effect';
      setError(null);
    }
  }, [ensureBeauty]);

  const applySelection = useCallback(async (selection: DeepAREffectSelection) => {
    const inst = instanceRef.current;
    if (!inst) return;
    const token = ++applyTokenRef.current;

    if (!deeparSelectionActive(selection)) {
      setActiveEffectId('none');
      try {
        beautyRef.current?.reset();
        beautyRef.current?.disable(true);
      } catch {
        /* ignore */
      }
      try {
        inst.clearEffect();
      } catch {
        /* ignore */
      }
      activeModeRef.current = 'none';
      return;
    }

    const beautyPresetId =
      [selection.lookId, selection.beautyId].find(
        (id) => id && isDeepARBeautyPreset(id),
      ) ?? null;

    const overlayId =
      selection.maskId ||
      selection.glassesId ||
      selection.backgroundId ||
      [selection.lookId, selection.beautyId].find(
        (id) => id && !isDeepARBeautyPreset(id),
      ) ||
      null;

    if (beautyPresetId) {
      const presetUrl = getDeepARBeautyPresetUrl(beautyPresetId);
      const beauty = await ensureBeauty();
      if (token !== applyTokenRef.current) return;
      if (!beauty || !presetUrl) {
        setError('DeepAR Beauty plugin is not available.');
        return;
      }
      try {
        if (activeModeRef.current === 'effect' && !overlayId) {
          inst.clearEffect();
        }
        beauty.disable(false);
        await beauty.importPreset(presetUrl);
        if (token !== applyTokenRef.current) return;
        activeModeRef.current = 'beauty';
        setError(null);
      } catch (err) {
        if (token !== applyTokenRef.current) return;
        setError(err instanceof Error ? err.message : 'Failed to apply beauty preset');
      }
    } else {
      try {
        beautyRef.current?.reset();
        beautyRef.current?.disable(true);
      } catch {
        /* ignore */
      }
      activeModeRef.current = 'none';
    }

    if (overlayId) {
      const url = getDeepAREffectUrl(overlayId);
      if (url) {
        await inst.switchEffect(url);
        if (token !== applyTokenRef.current) return;
        activeModeRef.current = beautyPresetId ? 'beauty' : 'effect';
        setError(null);
      }
    } else if (!beautyPresetId) {
      try {
        inst.clearEffect();
      } catch {
        /* ignore */
      }
    }

    if (token === applyTokenRef.current) {
      setActiveEffectId(resolveDeepARPrimaryEffectId(selection));
    }
  }, [ensureBeauty]);

  const lastAppliedEffectRef = useRef<string | null>(null);
  const lastAppliedSelectionRef = useRef<string>('');

  const selectionSignature = effectSelection
    ? JSON.stringify(effectSelection)
    : initialEffectId;

  useEffect(() => {
    const inst = instanceRef.current;
    if (!ready || !inst) return;

    if (!processingActive) {
      // Pause only — keep loaded effect/plugin warm for fast re-apply.
      inst.setPaused(true);
      return;
    }

    inst.setPaused(false);
    if (effectSelection) {
      if (lastAppliedSelectionRef.current === selectionSignature) return;
      lastAppliedSelectionRef.current = selectionSignature;
      void applySelection(effectSelection);
      return;
    }
    if (lastAppliedEffectRef.current === initialEffectId) return;
    lastAppliedEffectRef.current = initialEffectId;
    void switchEffect(initialEffectId);
  }, [applySelection, effectSelection, initialEffectId, processingActive, ready, selectionSignature, switchEffect]);

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
    const captureFps = fps <= 0 ? 0 : fps;
    if (
      canvasStreamRef.current?.canvas === canvas &&
      canvasStreamRef.current.fps === captureFps
    ) {
      return canvasStreamRef.current.stream;
    }
    const stream = canvas.captureStream(captureFps);
    canvasStreamRef.current = { canvas, fps: captureFps, stream };
    return stream;
  }, [previewRef]);

  const reconnectExternalVideo = useCallback(() => {
    const inst = instanceRef.current;
    const video = videoElementRef?.current;
    if (!inst || !video?.srcObject || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
    try {
      inst.setVideoElement(video, mirror);
      inst.setPaused(!processingActive);
    } catch {
      /* ignore stale reconnect */
    }
  }, [mirror, processingActive, videoElementRef]);

  useEffect(() => {
    if (!ready) return;
    reconnectExternalVideo();
  }, [mirror, ready, reconnectExternalVideo]);

  useEffect(() => {
    if (!enabled || !ready || !videoElementRef) return undefined;
    const video = videoElementRef.current;
    if (!video) return undefined;

    let reconnectTimer = 0;
    const scheduleReconnect = () => {
      window.clearTimeout(reconnectTimer);
      reconnectTimer = window.setTimeout(() => {
        reconnectExternalVideo();
      }, 80);
    };

    video.addEventListener('loadedmetadata', scheduleReconnect);
    if (video.srcObject && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      scheduleReconnect();
    }

    return () => {
      window.clearTimeout(reconnectTimer);
      video.removeEventListener('loadedmetadata', scheduleReconnect);
    };
  }, [enabled, ready, reconnectExternalVideo, videoElementRef]);

  const bodyShapeSignature = JSON.stringify(bodyShape);
  const bodyShapeApplyTimerRef = useRef(0);

  useEffect(() => {
    if (!ready) return undefined;
    window.clearTimeout(bodyShapeApplyTimerRef.current);
    bodyShapeApplyTimerRef.current = window.setTimeout(() => {
      void (async () => {
        const beauty = await ensureBeauty();
        if (!beauty) return;
        if (!processingActive) {
          if (!isBodyShapeActive(bodyShape)) {
            try {
              await beauty.faceMorphing.disable(true);
            } catch {
              /* ignore */
            }
          }
          return;
        }
        try {
          await applyBodyShapeToDeepAR(beauty, bodyShape);
        } catch (err) {
          console.warn('[deepar] body shape apply failed', err);
        }
      })();
    }, 100);
    return () => window.clearTimeout(bodyShapeApplyTimerRef.current);
  }, [bodyShape, bodyShapeSignature, ensureBeauty, processingActive, ready]);

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
    applySelection,
    takeScreenshot,
    startVideoRecording,
    finishVideoRecording,
    getCanvasStream,
    getProcessedStream,
    reconnectExternalVideo,
    instanceRef,
  };
}
