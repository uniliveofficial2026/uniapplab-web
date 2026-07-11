import { useCallback, useEffect, useRef, useState } from 'react';
import { sha256 } from 'js-sha256';
import {
  getTencentWebARAppId,
  getTencentWebARLicenseKey,
  getTencentWebARToken,
  isTencentWebARConfigured,
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
  type TencentWebARApplyState,
} from './tencentWebARStableApply';
import {
  ensureSharedTencentWebAR,
  getSharedTencentWebARCovers,
  getSharedTencentWebAREffectCatalogs,
  markSharedTencentWebARCatalogsLoaded,
  releaseSharedTencentWebAR,
  setSharedTencentWebARCovers,
  setSharedTencentWebAREffectCatalogs,
  sharedCatalogsLoaded,
} from './tencentWebARPool';
import {
  buildBeautyCoverMap,
  buildShapeCoverMap,
  buildShapeEffectMap,
} from './trtcBeautyCatalog';

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

async function preloadEffectIds(
  instance: TencentWebARInstance,
  ids: string[],
  onIdReady?: (id: string) => void,
) {
  if (ids.length === 0 || !instance.preloadEffectByIds) return;
  for (const id of ids) {
    if (!id) continue;
    await new Promise<void>((resolve) => {
      instance.preloadEffectByIds?.(
        [id],
        () => {
          onIdReady?.(id);
          resolve();
        },
        () => resolve(),
      );
    });
  }
}

function isBeautifyActive(params: TencentBeautifyParams): boolean {
  return Object.values(params).some((value) => typeof value === 'number' && value > 0);
}

function mapEffectRows(
  rows: Array<{
    Name?: string;
    EffectId?: string;
    CoverUrl?: string;
    Url?: string;
    Label?: string;
    PresetType?: string;
  }>,
): TencentEffectItem[] {
  return rows
    .map((item) => ({
      id: String(item.EffectId || ''),
      name: String(item.Name || 'Effect'),
      cover: String(item.CoverUrl || ''),
      url: item.Url ? String(item.Url) : undefined,
      label: item.Label ? String(item.Label) : undefined,
      type: item.PresetType ? String(item.PresetType) : undefined,
    }))
    .filter((item) => item.id);
}

function labelMatches(item: TencentEffectItem, label: string): boolean {
  const needle = label.toLowerCase();
  const haystack = [item.label, item.type, item.name].filter(Boolean).join(' ').toLowerCase();
  return haystack.includes(needle);
}

async function fetchEffectCatalog(
  instance: TencentWebARInstance,
  label: string | string[],
): Promise<TencentEffectItem[]> {
  const labels = Array.isArray(label) ? label : [label];
  for (const lb of labels) {
    try {
      const labeled = await instance.getEffectList?.({ Type: 'Preset', Label: lb });
      if (labeled?.length) return mapEffectRows(labeled);
    } catch {
      /* try fallback */
    }
  }
  try {
    const all = await instance.getEffectList?.({ Type: 'Preset', PageSize: 200 });
    if (!all?.length) return [];
    for (const lb of labels) {
      const filtered = mapEffectRows(all).filter((item) => labelMatches(item, lb));
      if (filtered.length > 0) return filtered;
    }
  } catch {
    return [];
  }
  return [];
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
  mirror = true,
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
  const catalogsLoadedRef = useRef(sharedCatalogsLoaded && getSharedTencentWebAREffectCatalogs().makeups.length > 0);
  const inputTrackIdRef = useRef('');
  const segmentationOnRef = useRef(false);
  const lastApplyKeyRef = useRef('');
  const applyStateRef = useRef<TencentWebARApplyState | null>(null);
  const mirrorRef = useRef(mirror);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [makeups, setMakeups] = useState<TencentEffectItem[]>(() =>
    sharedCatalogsLoaded ? getSharedTencentWebAREffectCatalogs().makeups : [],
  );
  const [stickers, setStickers] = useState<TencentEffectItem[]>(() =>
    sharedCatalogsLoaded ? getSharedTencentWebAREffectCatalogs().stickers : [],
  );
  const [filters, setFilters] = useState<TencentEffectItem[]>(() =>
    sharedCatalogsLoaded ? getSharedTencentWebAREffectCatalogs().filters : [],
  );
  const [backgrounds] = useState<string[]>([...TRTC_DEFAULT_BACKGROUNDS]);
  const [readyEffectIds, setReadyEffectIds] = useState<string[]>([]);
  const [beautyCovers, setBeautyCovers] = useState<Record<string, string>>(() =>
    sharedCatalogsLoaded ? getSharedTencentWebARCovers().beautyCovers : {},
  );
  const [shapeCovers, setShapeCovers] = useState<Record<string, string>>(() =>
    sharedCatalogsLoaded ? getSharedTencentWebARCovers().shapeCovers : {},
  );
  const [shapeEffectByPreset, setShapeEffectByPreset] = useState<Record<string, string>>(() =>
    sharedCatalogsLoaded ? getSharedTencentWebARCovers().shapeEffectByPreset : {},
  );
  const [bodyShapes, setBodyShapes] = useState<TencentEffectItem[]>(() =>
    sharedCatalogsLoaded ? getSharedTencentWebAREffectCatalogs().bodyShapes : [],
  );

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
        force,
      });
    },
    [],
  );

  const loadCatalogsAsync = async (
    instance: TencentWebARInstance,
    cancelled: () => boolean,
  ) => {
    if (catalogsLoadedRef.current || cancelled()) return;
    try {
      const [makeupRows, stickerRows, beautifyRows, bodyRows] = await Promise.all([
        fetchEffectCatalog(instance, 'Makeup'),
        fetchEffectCatalog(instance, 'Sticker'),
        fetchEffectCatalog(instance, ['美颜', 'Beauty', 'beauty']),
        fetchEffectCatalog(instance, ['美体', 'Body', 'body']),
      ]);
      let filterRows: TencentEffectItem[] = [];
      try {
        const list = await instance.getCommonFilter?.();
        if (list) filterRows = mapEffectRows(list);
      } catch {
        /* optional */
      }
      if (!cancelled()) {
        setMakeups(makeupRows);
        setStickers(stickerRows);
        setBodyShapes(bodyRows);
        setFilters(filterRows);
        setSharedTencentWebAREffectCatalogs({
          makeups: makeupRows,
          stickers: stickerRows,
          filters: filterRows,
          bodyShapes: bodyRows,
        });
      }
      if (!cancelled()) {
        const coverSources = [...beautifyRows, ...filterRows, ...bodyRows];
        const nextBeautyCovers = buildBeautyCoverMap(coverSources);
        const nextShapeCovers = buildShapeCoverMap(
          bodyRows.length > 0 ? bodyRows : coverSources,
        );
        const nextShapeEffects = buildShapeEffectMap(bodyRows);
        setBeautyCovers(nextBeautyCovers as Record<string, string>);
        setShapeCovers(nextShapeCovers as Record<string, string>);
        setShapeEffectByPreset(nextShapeEffects as Record<string, string>);
        setSharedTencentWebARCovers(
          nextBeautyCovers as Record<string, string>,
          nextShapeCovers as Record<string, string>,
          nextShapeEffects as Record<string, string>,
        );

        const preloadIds = [
          ...makeupRows.map((row) => row.id),
          ...stickerRows.map((row) => row.id),
          ...bodyRows.map((row) => row.id),
        ].filter(Boolean);
        void preloadEffectIds(instance, preloadIds, (id) => {
          if (cancelled()) return;
          setReadyEffectIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
        });
      }
    } catch {
      /* catalogs optional offline */
    }
    if (!cancelled()) {
      markSharedTencentWebARCatalogsLoaded();
    }
    catalogsLoadedRef.current = true;
  };

  const attachOutput = async (instance: TencentWebARInstance) => {
    const output = (await (instance.getOutput as (fps?: number) => Promise<MediaStream>)(
      outputFps,
    )) as MediaStream;
    outputStreamRef.current = output;
    const outputVideo = outputVideoRef.current;
    if (outputVideo) {
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
      setReady(false);
      setLoading(false);
      return undefined;
    }

    if (streamMode && !inputStream) {
      return undefined;
    }

    let cancelled = false;
    let instance: TencentWebARInstance | null = null;
    let ownedInstance = false;

    void (async () => {
      setLoading(true);
      setError(null);

      try {
        const initMirror = mirrorRef.current;

        if (streamMode && inputStream) {
          usingSharedRef.current = true;
          const shared = await ensureSharedTencentWebAR({
            inputStream,
            mirror: initMirror,
            needsSegmentation,
            outputFps,
          });
          if (cancelled) {
            releaseSharedTencentWebAR();
            usingSharedRef.current = false;
            return;
          }
          instance = shared.instance;
          if (!instance) {
            throw new Error('Tencent WebAR failed to initialize');
          }
          instanceRef.current = instance;
          segmentationOnRef.current = needsSegmentation;
          lastApplyKeyRef.current = '';
          inputTrackIdRef.current = inputVideoTrackId;
          outputStreamRef.current = shared.output;
          await pushApplyState(instance, true);
          await attachOutput(instance);
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
          segmentationOnRef.current = needsSegmentation;
          lastApplyKeyRef.current = '';

          await new Promise<void>((resolve, reject) => {
            const onReady = () => {
              cleanup();
              resolve();
            };
            const onError = (payload?: unknown) => {
              cleanup();
              const message =
                payload && typeof payload === 'object' && 'message' in payload
                  ? String((payload as { message?: unknown }).message)
                  : 'Tencent WebAR failed to initialize';
              reject(new Error(message));
            };
            const cleanup = () => {
              instance?.off?.('ready', onReady);
              instance?.off?.('error', onError);
            };
            instance?.on('ready', onReady);
            instance?.on('error', onError);
          });

          if (cancelled) {
            instance.destroy?.({ stopInputStream: false });
            return;
          }

          await pushApplyState(instance, true);
          await attachOutput(instance);
        }

        if (cancelled) {
          if (ownedInstance) {
            instance?.destroy?.({ stopInputStream: false });
          } else {
            releaseSharedTencentWebAR();
            usingSharedRef.current = false;
          }
          return;
        }

        setReady(true);
        setError(null);

        if (loadCatalogs || !catalogsLoadedRef.current) {
          void loadCatalogsAsync(instance, () => cancelled);
        }
      } catch (err) {
        if (!cancelled) {
          setReady(false);
          setError(err instanceof Error ? err.message : 'Tencent WebAR failed');
        }
        if (usingSharedRef.current) {
          releaseSharedTencentWebAR();
          usingSharedRef.current = false;
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      setReady(false);
      setLoading(false);
      outputStreamRef.current = null;
      inputTrackIdRef.current = '';
      segmentationOnRef.current = false;
      lastApplyKeyRef.current = '';
      if (outputVideoRef.current) {
        outputVideoRef.current.srcObject = null;
      }
      if (usingSharedRef.current) {
        releaseSharedTencentWebAR();
        usingSharedRef.current = false;
      } else {
        try {
          instance?.destroy?.({ stopInputStream: false });
        } catch {
          /* ignore shutdown errors */
        }
      }
      if (instanceRef.current === instance) {
        instanceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keepWarm, useBuiltinCamera, hasInputStream]);

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
  useEffect(() => {
    if (!streamMode || !ready || !inputStream) return undefined;
    if (inputVideoTrackId === inputTrackIdRef.current) return undefined;

    const instance = instanceRef.current;
    if (!instance?.updateInputStream) {
      inputTrackIdRef.current = inputVideoTrackId;
      return undefined;
    }

    inputTrackIdRef.current = inputVideoTrackId;
    void instance
      .updateInputStream(inputStream, false, false)
      .then(() => {
        lastApplyKeyRef.current = '';
        return pushApplyState(instance, true);
      })
      .catch(() => {
        /* instance may be tearing down */
      });
    return undefined;
  }, [streamMode, ready, inputStream, inputVideoTrackId, pushApplyState]);

  useEffect(() => {
    const instance = instanceRef.current;
    if (!instance || !ready || !loadCatalogs || catalogsLoadedRef.current) return undefined;
    void loadCatalogsAsync(instance, () => false);
    return undefined;
  }, [loadCatalogs, ready]);

  useEffect(() => {
    const instance = instanceRef.current;
    if (!instance || !ready) return undefined;
    void pushApplyState(instance);
    return undefined;
  }, [beautify, effects, ready, beautyOn, needsSegmentation, pushApplyState]);

  useEffect(() => {
    if (!ready) return undefined;
    const bind = () => {
      const output = outputStreamRef.current;
      const outputVideo = outputVideoRef.current;
      if (!output || !outputVideo) return;
      if (outputVideo.srcObject !== output) {
        outputVideo.srcObject = output;
      }
      if (outputVideo.paused) {
        void outputVideo.play().catch(() => {});
      }
    };
    bind();
    const id = window.setInterval(bind, 250);
    return () => window.clearInterval(id);
  }, [ready, beautify, effects, beautyOn]);

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

export { isTencentWebARConfigured } from './webarConfig';
export { preloadTencentWebARModule, warmTencentWebARForVideoCall } from './tencentWebARPool';
