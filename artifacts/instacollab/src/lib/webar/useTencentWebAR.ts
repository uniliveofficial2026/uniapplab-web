import { useCallback, useEffect, useRef, useState } from 'react';
import { sha256 } from 'js-sha256';
import {
  getTencentWebARAppId,
  getTencentWebARLicenseKey,
  getTencentWebARToken,
  isTencentWebARConfigured,
  explainTencentWebARAuthError,
  ensureTencentWebARAllowedHostname,
} from './webarConfig';
import {
  WEBAR_BUILTIN_CAMERA,
  WEBAR_CAMERA_FPS,
  WEBAR_OUTPUT_FPS,
} from './webarCameraConfig';
import type {
  TencentBeautifyParams,
  TencentEffectItem,
  TencentEffectSelection,
  TencentWebARInstance,
} from './webarTypes';
import {
  EMPTY_TENCENT_EFFECT_SELECTION,
  TRTC_DEFAULT_BACKGROUNDS,
} from './webarTypes';
import { BEAUTY_OFF_PARAMS } from '../ar/beautyFilters';
import {
  applyTencentWebARState,
  buildTencentWebARApplyKey,
  type TencentWebARApplyState,
} from './tencentWebARStableApply';
import {
  ensureSharedTencentWebAR,
  getLastTencentWebARInitError,
  getSharedTencentWebARCovers,
  getSharedTencentWebAREffectCatalogs,
  getSharedTencentWebARInputTrackId,
  hydrateTencentWebARCatalogsFromStorage,
  isSharedTencentWebARReady,
  releaseSharedTencentWebAR,
  sharedCatalogsLoaded,
  syncSharedTencentWebARInput,
} from './tencentWebARPool';
import { refreshSharedEffectCatalogs } from './tencentWebARCatalogs';
import { enqueueTencentWebAREffect } from './tencentWebAREffectQueue';

type UseTencentWebAROptions = {
  /** Init SDK when true — keep off for raw camera-only paths. */
  enabled: boolean;
  /** Custom MediaStream from getUserMedia (Tencent custom-stream mode). */
  inputStream?: MediaStream | null;
  /** When true, SDK opens its own 1280×720 camera (Tencent built-in camera mode). */
  useBuiltinCamera?: boolean;
  mirror?: boolean;
  beautify: TencentBeautifyParams;
  effects?: TencentEffectSelection;
  /** Fetch effect catalogs (defer until beauty panel opens). */
  loadCatalogs?: boolean;
  /** Keep SDK processing enabled even when sliders are neutral (live/call warm path). */
  persistent?: boolean;
  /** Output frame rate for getOutput(fps) — default 30 per Tencent live docs. */
  outputFps?: number;
};

async function buildSignature() {
  const appId = getTencentWebARAppId();
  const token = getTencentWebARToken();
  const timestamp = Math.round(Date.now() / 1000);
  const signature = sha256(`${timestamp}${token}${appId}${timestamp}`).toUpperCase();
  return { signature, timestamp };
}

function hasEffectSelection(effects?: TencentEffectSelection): boolean {
  if (!effects) return false;
  return Boolean(
    effects.makeupId ||
      effects.stickerId ||
      effects.filterId ||
      effects.backgroundUrl ||
      effects.shapeEffectId,
  );
}

function isBeautifyActive(params: TencentBeautifyParams): boolean {
  return Object.values(params).some((value) => typeof value === 'number' && value > 0);
}

/**
 * Tencent Beauty AR Web SDK hook.
 *
 * Supports both official integration modes:
 * - Custom stream: pass `inputStream` from getUserMedia at 1280×720
 * - Built-in camera: set `useBuiltinCamera` — SDK owns the device camera
 *
 * @see https://www.tencentcloud.com/document/product/1143/50102
 */
export function useTencentWebAR({
  enabled,
  inputStream = null,
  useBuiltinCamera = false,
  mirror = false,
  beautify,
  effects = EMPTY_TENCENT_EFFECT_SELECTION,
  loadCatalogs = false,
  persistent = false,
  outputFps = WEBAR_OUTPUT_FPS,
}: UseTencentWebAROptions) {
  const configured = isTencentWebARConfigured();
  const instanceRef = useRef<TencentWebARInstance | null>(null);
  const outputVideoRef = useRef<HTMLVideoElement | null>(null);
  const outputStreamRef = useRef<MediaStream | null>(null);
  const usingSharedRef = useRef(false);
  // Instant trays: memory cache or last-session localStorage — never wait on TRTC for the grid.
  const bootCatalogs = (() => {
    hydrateTencentWebARCatalogsFromStorage();
    return getSharedTencentWebAREffectCatalogs();
  })();
  const bootCovers = getSharedTencentWebARCovers();
  const catalogsLoadedRef = useRef(
    sharedCatalogsLoaded &&
      (bootCatalogs.makeups.length > 0 ||
        bootCatalogs.stickers.length > 0 ||
        bootCatalogs.filters.length > 0),
  );
  const inputTrackIdRef = useRef('');
  const segmentationOnRef = useRef(false);
  const lastApplyKeyRef = useRef('');
  const lastBeautifyKeyRef = useRef('');
  const lastAssetsKeyRef = useRef('');
  const applyStateRef = useRef<TencentWebARApplyState | null>(null);
  const mirrorRef = useRef(mirror);
  const [ready, setReady] = useState(() => isSharedTencentWebARReady());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [makeups, setMakeups] = useState<TencentEffectItem[]>(() => bootCatalogs.makeups);
  const [stickers, setStickers] = useState<TencentEffectItem[]>(() => bootCatalogs.stickers);
  const [filters, setFilters] = useState<TencentEffectItem[]>(() => bootCatalogs.filters);
  const [backgrounds] = useState<string[]>([...TRTC_DEFAULT_BACKGROUNDS]);
  const [readyEffectIds, setReadyEffectIds] = useState<string[]>([]);
  const [beautyCovers, setBeautyCovers] = useState<Record<string, string>>(() => bootCovers.beautyCovers);
  const [shapeCovers, setShapeCovers] = useState<Record<string, string>>(() => bootCovers.shapeCovers);
  const [shapeEffectByPreset, setShapeEffectByPreset] = useState<Record<string, string>>(
    () => bootCovers.shapeEffectByPreset,
  );
  const [bodyShapes, setBodyShapes] = useState<TencentEffectItem[]>(() => bootCatalogs.bodyShapes);

  const beautyOn = persistent || isBeautifyActive(beautify) || hasEffectSelection(effects);
  const needsSegmentation = Boolean(effects.backgroundUrl);
  const inputVideoTrackId = inputStream?.getVideoTracks()[0]?.id ?? '';
  const streamMode = !useBuiltinCamera;
  const keepWarm =
    enabled &&
    configured &&
    (useBuiltinCamera || Boolean(inputStream));

  mirrorRef.current = mirror;
  applyStateRef.current = {
    beautify,
    effects,
    beautyOn,
    needsSegmentation,
    mirror,
  };

  const pushApplyState = useCallback(
    (instance: TencentWebARInstance, force = false) => {
      const state = applyStateRef.current;
      if (!state) return Promise.resolve();
      return applyTencentWebARState(instance, state, {
        segmentationOnRef,
        lastKeyRef: lastApplyKeyRef,
        lastBeautifyKeyRef,
        lastAssetsKeyRef,
        force,
      });
    },
    [],
  );

  const syncCatalogStateFromShared = () => {
    const catalogs = getSharedTencentWebAREffectCatalogs();
    const covers = getSharedTencentWebARCovers();
    const hasAny =
      catalogs.makeups.length > 0 ||
      catalogs.stickers.length > 0 ||
      catalogs.filters.length > 0;
    if (!hasAny) return false;
    setMakeups(catalogs.makeups);
    setStickers(catalogs.stickers);
    setBodyShapes(catalogs.bodyShapes);
    setFilters(catalogs.filters);
    setBeautyCovers(covers.beautyCovers);
    setShapeCovers(covers.shapeCovers);
    setShapeEffectByPreset(covers.shapeEffectByPreset);
    catalogsLoadedRef.current = true;
    return true;
  };

  const loadCatalogsAsync = async (
    instance: TencentWebARInstance,
    cancelled: () => boolean,
  ) => {
    if (cancelled()) return;
    syncCatalogStateFromShared();

    await refreshSharedEffectCatalogs(instance, 5);
    if (cancelled()) return;
    syncCatalogStateFromShared();
    // No head-preload — selected effects preload on demand in applyTencentWebARState.
  };

  const attachOutput = async (instance: TencentWebARInstance) => {
    const output = (await (instance.getOutput as (fps?: number) => Promise<MediaStream>)(
      outputFps,
    )) as MediaStream;
    outputStreamRef.current = output;
    const outputVideo = outputVideoRef.current;
    if (outputVideo) {
      outputVideo.dataset.webarOutput = '1';
      outputVideo.dataset.appCamera = '1';
      outputVideo.srcObject = output;
      outputVideo.muted = true;
      outputVideo.playsInline = true;
      void outputVideo.play().catch(() => {});
    }
    return output;
  };

  // Init SDK once — shared pool for custom stream; dedicated instance for built-in camera.
  // Re-run when an input stream becomes available so Create Room / call preview never stalls.
  const hasInputStream = Boolean(inputStream);
  useEffect(() => {
    if (!keepWarm) {
      // Do not flip ready→false while a shared warm instance still has output —
      // that blanks the camera UI during parent remounts / panel toggles.
      if (!isSharedTencentWebARReady() || !outputStreamRef.current) {
        setReady(false);
      }
      setLoading(false);
      return undefined;
    }

    if (streamMode && !inputStream) {
      return undefined;
    }

    let cancelled = false;
    let instance: TencentWebARInstance | null = null;
    let ownedInstance = false;
    let sharedReleased = false;
    let ownedDestroyed = false;

    const releaseSharedOnce = () => {
      if (!usingSharedRef.current || sharedReleased) return;
      sharedReleased = true;
      usingSharedRef.current = false;
      releaseSharedTencentWebAR();
    };

    const destroyOwnedOnce = () => {
      if (!ownedInstance || ownedDestroyed) return;
      ownedDestroyed = true;
      try {
        instance?.destroy?.({ stopInputStream: false });
      } catch {
        /* ignore */
      }
    };

    void (async () => {
      if (ensureTencentWebARAllowedHostname()) {
        setLoading(false);
        return;
      }

      const alreadyWarm = streamMode && isSharedTencentWebARReady();
      setLoading(!alreadyWarm);
      setError(null);

      try {
        const initMirror = mirrorRef.current;

        if (streamMode && inputStream) {
          const inputTrack = inputStream.getVideoTracks()[0];
          if (!inputTrack || inputTrack.readyState !== 'live') {
            usingSharedRef.current = false;
            sharedReleased = true;
            throw new Error('Tencent WebAR input camera track is not live');
          }
          usingSharedRef.current = true;
          const shared = await ensureSharedTencentWebAR({
            inputStream,
            mirror: initMirror,
            needsSegmentation,
            outputFps,
          });
          if (cancelled) {
            // ensureShared acquired — release exactly once.
            if (shared.instance) releaseSharedOnce();
            else {
              usingSharedRef.current = false;
              sharedReleased = true;
            }
            return;
          }
          instance = shared.instance;
          if (!instance) {
            usingSharedRef.current = false;
            sharedReleased = true;
            throw new Error(
              getLastTencentWebARInitError() || 'Tencent WebAR failed to initialize',
            );
          }
          instanceRef.current = instance;
          segmentationOnRef.current = false;
          lastApplyKeyRef.current = '';
          lastBeautifyKeyRef.current = '';
          lastAssetsKeyRef.current = '';
          inputTrackIdRef.current = getSharedTencentWebARInputTrackId();
          outputStreamRef.current = shared.output;
          if (inputStream && inputVideoTrackId !== inputTrackIdRef.current) {
            const rebound = await syncSharedTencentWebARInput(inputStream, outputFps);
            if (rebound) outputStreamRef.current = rebound;
            inputTrackIdRef.current = getSharedTencentWebARInputTrackId();
          }
          if (cancelled) {
            releaseSharedOnce();
            return;
          }
          await pushApplyState(instance, true);
          await attachOutput(instance);
          if (cancelled) {
            releaseSharedOnce();
            return;
          }
          setReady(true);
          setError(null);
          setLoading(false);
          // Catalogs load via dedicated effect when loadCatalogs flips — avoid double fetch.
          return;
        } else {
          usingSharedRef.current = false;
          const { ArSdk: WebArSdk } = await import('tencentcloud-webar');
          if (cancelled) return;

          const initConfig: Record<string, unknown> = {
            module: {
              beautify: true,
              segmentation: needsSegmentation,
              ...(needsSegmentation ? { segmentationLevel: 2 as const } : {}),
            },
            auth: {
              authFunc: buildSignature,
              appId: getTencentWebARAppId(),
              licenseKey: getTencentWebARLicenseKey(),
            },
            mirror: initMirror,
            beautify: BEAUTY_OFF_PARAMS,
            language: 'en',
            loading: { enable: false },
            fps: WEBAR_CAMERA_FPS,
            camera: {
              ...WEBAR_BUILTIN_CAMERA,
              mirror: initMirror,
            },
          };

          instance = new WebArSdk(
            initConfig as unknown as ConstructorParameters<typeof WebArSdk>[0],
          ) as TencentWebARInstance;
          ownedInstance = true;
          instanceRef.current = instance;
          segmentationOnRef.current = false;
          lastApplyKeyRef.current = '';
          lastBeautifyKeyRef.current = '';
          lastAssetsKeyRef.current = '';

          await new Promise<void>((resolve, reject) => {
            const onReady = () => {
              cleanup();
              resolve();
            };
            const onError = (payload?: unknown) => {
              cleanup();
              reject(new Error(explainTencentWebARAuthError(payload)));
            };
            const cleanup = () => {
              instance?.off?.('ready', onReady);
              instance?.off?.('error', onError);
            };
            instance?.on('ready', onReady);
            instance?.on('error', onError);
          });

          if (cancelled) {
            destroyOwnedOnce();
            return;
          }

          await pushApplyState(instance, true);
          await attachOutput(instance);
          if (cancelled) {
            destroyOwnedOnce();
            return;
          }
          setReady(true);
          setError(null);
          setLoading(false);
          // Catalogs load via dedicated effect when loadCatalogs flips — avoid double fetch.
          return;
        }
      } catch (err) {
        if (!cancelled) {
          setReady(false);
          setError(err instanceof Error ? err.message : 'Tencent WebAR failed');
        }
        releaseSharedOnce();
        destroyOwnedOnce();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      // Keep ready=true until a replacement init succeeds — cleanup setReady(false)
      // blanked the preview on every HMR / stream id flicker.
      setLoading(false);
      // Keep outputStreamRef so UI can keep painting the last frame until rebound.
      inputTrackIdRef.current = '';
      segmentationOnRef.current = false;
      lastApplyKeyRef.current = '';
      lastBeautifyKeyRef.current = '';
      lastAssetsKeyRef.current = '';
      releaseSharedOnce();
      destroyOwnedOnce();
      if (instanceRef.current === instance) {
        instanceRef.current = null;
      }
    };
    // Re-run when the input track identity changes so Strict Mode / clone swaps
    // never leave us stuck on a failed init against a dead MediaStreamTrack.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keepWarm, useBuiltinCamera, hasInputStream, inputVideoTrackId]);

  // Mirror updates without tearing down the SDK (keeps face/effect tracking warm).
  useEffect(() => {
    const instance = instanceRef.current;
    if (!instance || !ready) return undefined;
    try {
      instance.setCommonConfig?.({ mirror });
    } catch {
      /* ignore */
    }
    return undefined;
  }, [mirror, ready]);

  // Custom stream: swap camera via updateInputStream (no SDK re-init) — Tencent Step 5.
  // Also recover after a failed init once a live replacement track arrives.
  useEffect(() => {
    if (!streamMode || !inputStream) return undefined;
    if (inputVideoTrackId === inputTrackIdRef.current) return undefined;

    const inputTrack = inputStream.getVideoTracks()[0];
    if (!inputTrack || inputTrack.readyState !== 'live') return undefined;

    // Not ready yet — init effect (keyed on inputVideoTrackId) owns first bind.
    if (!ready) return undefined;

    const instance = instanceRef.current;
    if (!instance) {
      inputTrackIdRef.current = inputVideoTrackId;
      return undefined;
    }

    void syncSharedTencentWebARInput(inputStream, outputFps)
      .then(async (output) => {
        inputTrackIdRef.current = getSharedTencentWebARInputTrackId();
        if (output) outputStreamRef.current = output;
        lastApplyKeyRef.current = '';
        lastBeautifyKeyRef.current = '';
        lastAssetsKeyRef.current = '';
        await pushApplyState(instance, true);
        await attachOutput(instance);
      })
      .catch(() => {
        /* instance may be tearing down */
      });
    return undefined;
  }, [streamMode, ready, inputStream, inputVideoTrackId, outputFps, pushApplyState]);

  useEffect(() => {
    const instance = instanceRef.current;
    if (!instance || !ready || !loadCatalogs) return undefined;
    let cancelled = false;
    void loadCatalogsAsync(instance, () => cancelled);
    return () => {
      cancelled = true;
    };
  }, [loadCatalogs, ready]);

  // Pull catalogs from the warm pipeline / other mounts as soon as they land.
  useEffect(() => {
    if (!loadCatalogs) return undefined;
    syncCatalogStateFromShared();
    const id = window.setInterval(() => {
      if (syncCatalogStateFromShared()) {
        window.clearInterval(id);
      }
    }, 1500);
    return () => window.clearInterval(id);
  }, [loadCatalogs]);

  useEffect(() => {
    const instance = instanceRef.current;
    if (!instance || !ready) return undefined;
    const state = applyStateRef.current;
    if (!state) return undefined;
    const applyKey = buildTencentWebARApplyKey(state);
    if (lastApplyKeyRef.current === applyKey) return undefined;
    // Coalesce rapid slider taps — prevent WebGL thrash / blank.
    const timer = window.setTimeout(() => {
      void pushApplyState(instance);
    }, 80);
    return () => window.clearTimeout(timer);
  }, [beautify, effects, ready, beautyOn, needsSegmentation, mirror, pushApplyState]);

  // One-time shader pre-warm — compile the beauty WebGL program while the panel is
  // open (before any preset tap), so taps only push cheap uniform updates and never
  // freeze the main thread with a first-frame compile (~500ms).
  const warmedRef = useRef(false);
  useEffect(() => {
    if (!ready || warmedRef.current) return undefined;
    const instance = instanceRef.current;
    if (!instance) return undefined;
    warmedRef.current = true;

    const rafWait = () =>
      new Promise<void>((resolve) => {
        if (typeof requestAnimationFrame === 'function') {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        } else {
          setTimeout(resolve, 0);
        }
      });

    void enqueueTencentWebAREffect(async () => {
      try {
        instance.enable?.();
      } catch {
        /* ignore */
      }
      try {
        // Non-zero params force the beauty shader to compile now.
        instance.setBeautify({
          whiten: 0.2,
          dermabrasion: 0.2,
          lift: 0,
          shave: 0,
          eye: 0,
          chin: 0,
        });
      } catch {
        /* ignore */
      }
      // Let a couple of frames run the freshly compiled program.
      await rafWait();
      await rafWait();
      // Restore to the app's real desired state (usually beauty OFF until a tap).
      void pushApplyState(instance, true);
    });
    return undefined;
  }, [ready, pushApplyState]);

  useEffect(() => {
    if (!ready) return undefined;
    const bind = () => {
      const output = outputStreamRef.current;
      const outputVideo = outputVideoRef.current;
      if (!output || !outputVideo) return;
      outputVideo.dataset.webarOutput = '1';
      outputVideo.dataset.appCamera = '1';
      if (outputVideo.srcObject !== output) {
        outputVideo.srcObject = output;
      }
      if (outputVideo.paused) {
        void outputVideo.play().catch(() => {});
      }
    };
    bind();
    // Keep beauty preview alive even if auto-heal / tab code paused the sink.
    const id = window.setInterval(bind, 1200);
    return () => window.clearInterval(id);
  }, [ready, beautyOn]);

  return {
    configured,
    ready,
    loading,
    error,
    outputVideoRef,
    outputStreamRef,
    beautyActive: ready && beautyOn,
    catalogs: {
      makeups,
      stickers,
      filters,
      backgrounds,
      beautyCovers,
      shapeCovers,
      bodyShapes,
      shapeEffectByPreset,
    },
    readyEffectIds,
  };
}

export { isTencentWebARConfigured, isTencentWebARRunnable } from './webarConfig';
export {
  hydrateTencentWebARCatalogsFromStorage,
  preloadTencentWebARModule,
  warmTencentWebARForVideoCall,
} from './tencentWebARPool';
export {
  ensureTencentWebARPipelineWarm,
  warmTencentWebARPipelineNow,
} from './tencentWebARWarm';
