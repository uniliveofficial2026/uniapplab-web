import { useEffect, useRef, useState } from 'react';
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

function isBeautifyActive(params: TencentBeautifyParams): boolean {
  return Object.values(params).some((value) => typeof value === 'number' && value > 0);
}

function hasEffectSelection(effects?: TencentEffectSelection): boolean {
  if (!effects) return false;
  return Boolean(
    effects.makeupId || effects.stickerId || effects.filterId || effects.backgroundUrl,
  );
}

function applyEffects(instance: TencentWebARInstance, effects: TencentEffectSelection) {
  void applyEffectsAsync(instance, effects);
}

async function preloadEffectIds(instance: TencentWebARInstance, ids: string[]) {
  if (ids.length === 0 || !instance.preloadEffectByIds) return;
  await new Promise<void>((resolve) => {
    instance.preloadEffectByIds?.(
      ids,
      () => resolve(),
      () => resolve(),
    );
  });
}

async function applyEffectsAsync(instance: TencentWebARInstance, effects: TencentEffectSelection) {
  const preloadIds: string[] = [];
  if (effects.makeupId) preloadIds.push(effects.makeupId);
  if (effects.stickerId) preloadIds.push(effects.stickerId);
  await preloadEffectIds(instance, preloadIds);

  const stack: Array<string | { id: string; intensity?: number; filterIntensity?: number }> = [];
  if (effects.makeupId) {
    stack.push({ id: effects.makeupId, intensity: 1, filterIntensity: 0 });
  }
  if (effects.stickerId) {
    stack.push(effects.stickerId);
  }
  try {
    instance.setEffect?.(stack.length > 0 ? stack : null);
  } catch {
    /* ignore */
  }
  try {
    if (effects.filterId) instance.setFilter?.(effects.filterId, 1);
    else instance.setFilter?.(null);
  } catch {
    /* ignore */
  }
  try {
    if (effects.backgroundUrl) {
      await instance.setBackground?.({ type: 'image', src: effects.backgroundUrl });
    } else {
      await instance.setBackground?.(null);
    }
  } catch {
    /* ignore */
  }
}

function labelMatches(item: TencentEffectItem, label: string): boolean {
  const needle = label.toLowerCase();
  const haystack = [item.label, item.type, item.name].filter(Boolean).join(' ').toLowerCase();
  return haystack.includes(needle);
}

async function fetchEffectCatalog(
  instance: TencentWebARInstance,
  label: string,
): Promise<TencentEffectItem[]> {
  try {
    const labeled = await instance.getEffectList?.({ Type: 'Preset', Label: label });
    if (labeled?.length) return mapEffectRows(labeled);
  } catch {
    /* try fallback */
  }
  try {
    const all = await instance.getEffectList?.({ Type: 'Preset', PageSize: 200 });
    if (!all?.length) return [];
    return mapEffectRows(all).filter((item) => labelMatches(item, label));
  } catch {
    return [];
  }
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
  outputFps = WEBAR_OUTPUT_FPS,
}: UseTencentWebAROptions) {
  const configured = isTencentWebARConfigured();
  const instanceRef = useRef<TencentWebARInstance | null>(null);
  const outputVideoRef = useRef<HTMLVideoElement | null>(null);
  const outputStreamRef = useRef<MediaStream | null>(null);
  const catalogsLoadedRef = useRef(false);
  const inputTrackIdRef = useRef('');
  const segmentationOnRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [makeups, setMakeups] = useState<TencentEffectItem[]>([]);
  const [stickers, setStickers] = useState<TencentEffectItem[]>([]);
  const [filters, setFilters] = useState<TencentEffectItem[]>([]);
  const [backgrounds] = useState<string[]>([...TRTC_DEFAULT_BACKGROUNDS]);

  const beautyOn = isBeautifyActive(beautify) || hasEffectSelection(effects);
  const needsSegmentation = Boolean(effects.backgroundUrl);
  const inputVideoTrackId = inputStream?.getVideoTracks()[0]?.id ?? '';
  const streamMode = !useBuiltinCamera;
  const keepWarm =
    enabled &&
    configured &&
    (useBuiltinCamera || Boolean(inputStream));

  const loadCatalogsAsync = async (
    instance: TencentWebARInstance,
    cancelled: () => boolean,
  ) => {
    if (catalogsLoadedRef.current || cancelled()) return;
    try {
      const [makeupRows, stickerRows] = await Promise.all([
        fetchEffectCatalog(instance, 'Makeup'),
        fetchEffectCatalog(instance, 'Sticker'),
      ]);
      if (!cancelled()) {
        setMakeups(makeupRows);
        setStickers(stickerRows);
      }
    } catch {
      /* catalogs optional offline */
    }
    try {
      const list = await instance.getCommonFilter?.();
      if (list && !cancelled()) setFilters(mapEffectRows(list));
    } catch {
      /* optional */
    }
    catalogsLoadedRef.current = true;
  };

  const attachOutput = async (instance: TencentWebARInstance) => {
    const output = (await instance.getOutput(outputFps)) as MediaStream;
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

  // Init SDK once — custom stream or built-in camera per Tencent docs.
  useEffect(() => {
    if (!keepWarm) {
      setReady(false);
      setLoading(false);
      catalogsLoadedRef.current = false;
      inputTrackIdRef.current = '';
      segmentationOnRef.current = false;
      return undefined;
    }

    if (streamMode && !inputStream) {
      return undefined;
    }

    let cancelled = false;
    let instance: TencentWebARInstance | null = null;

    void (async () => {
      setLoading(true);
      setError(null);

      try {
        const { ArSdk: WebArSdk } = await import('tencentcloud-webar');
        if (cancelled) return;

        instance = new WebArSdk({
          module: {
            beautify: true,
            segmentation: needsSegmentation,
            ...(needsSegmentation ? { segmentationLevel: 1 as const } : {}),
          },
          auth: {
            authFunc: buildSignature,
            appId: getTencentWebARAppId(),
            licenseKey: getTencentWebARLicenseKey(),
          },
          mirror,
          beautify: BEAUTY_OFF_PARAMS,
          language: 'en',
          loading: { enable: false },
          fps: WEBAR_CAMERA_FPS,
          ...(useBuiltinCamera
            ? { camera: { ...WEBAR_BUILTIN_CAMERA, mirror } }
            : inputStream
              ? { input: inputStream }
              : {}),
        }) as TencentWebARInstance;
        instanceRef.current = instance;
        segmentationOnRef.current = needsSegmentation;
        if (streamMode && inputStream) {
          inputTrackIdRef.current = inputVideoTrackId;
        }

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

        instance.setBeautify(beautify);
        await applyEffectsAsync(instance, effects);
        await attachOutput(instance);

        if (cancelled) {
          instance.destroy?.({ stopInputStream: false });
          return;
        }

        setReady(true);
        setError(null);

        if (loadCatalogs) {
          void loadCatalogsAsync(instance, () => cancelled);
        }
      } catch (err) {
        if (!cancelled) {
          setReady(false);
          setError(err instanceof Error ? err.message : 'Tencent WebAR failed');
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
      if (outputVideoRef.current) {
        outputVideoRef.current.srcObject = null;
      }
      try {
        instance?.destroy?.({ stopInputStream: false });
      } catch {
        /* ignore shutdown errors */
      }
      if (instanceRef.current === instance) {
        instanceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keepWarm, useBuiltinCamera, mirror]);

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
      .catch(() => {
        /* instance may be tearing down */
      });
    return undefined;
  }, [streamMode, ready, inputStream, inputVideoTrackId]);

  // Enable segmentation module dynamically when virtual background is selected.
  useEffect(() => {
    const instance = instanceRef.current;
    if (!instance || !ready) return undefined;
    if (needsSegmentation === segmentationOnRef.current) return undefined;

    segmentationOnRef.current = needsSegmentation;
    try {
      instance.setDetectModuleConfig?.({
        segmentation: needsSegmentation,
        ...(needsSegmentation ? { segmentationLevel: 1 as const } : {}),
      });
      if (needsSegmentation) {
        void instance.setSegmentationLevel?.(1);
      }
    } catch {
      /* ignore */
    }
    applyEffects(instance, effects);
    return undefined;
  }, [needsSegmentation, ready, effects]);

  useEffect(() => {
    const instance = instanceRef.current;
    if (!instance || !ready || !loadCatalogs || catalogsLoadedRef.current) return undefined;
    void loadCatalogsAsync(instance, () => false);
    return undefined;
  }, [loadCatalogs, ready]);

  useEffect(() => {
    const instance = instanceRef.current;
    if (!instance || !ready) return undefined;
    try {
      instance.setBeautify(beautify);
      void applyEffectsAsync(instance, effects).then(() => {
        if (beautyOn) instance.enable?.();
        else instance.disable?.();
      });
    } catch {
      /* ignore stale instance */
    }
    return undefined;
  }, [beautify, effects, ready, beautyOn]);

  useEffect(() => {
    if (!ready) return undefined;
    const output = outputStreamRef.current;
    const outputVideo = outputVideoRef.current;
    if (!output || !outputVideo) return undefined;
    if (outputVideo.srcObject !== output) {
      outputVideo.srcObject = output;
    }
    if (outputVideo.paused) {
      void outputVideo.play().catch(() => {});
    }
    return undefined;
  }, [ready]);

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
    },
  };
}
