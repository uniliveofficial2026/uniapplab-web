import { useEffect, useRef, useState } from 'react';
import { sha256 } from 'js-sha256';
import {
  getTencentWebARAppId,
  getTencentWebARLicenseKey,
  getTencentWebARToken,
  isTencentWebARConfigured,
} from './webarConfig';
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
  /** Keep SDK warm while camera stream is live (init once per track). */
  enabled: boolean;
  inputStream: MediaStream | null;
  mirror?: boolean;
  beautify: TencentBeautifyParams;
  effects?: TencentEffectSelection;
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
      instance.setBackground?.({ type: 'image', src: effects.backgroundUrl });
    } else {
      instance.setBackground?.(null);
    }
  } catch {
    /* ignore */
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
 * Tencent WebAR beauty — init once per camera track, apply presets without teardown.
 */
export function useTencentWebAR({
  enabled,
  inputStream,
  mirror = true,
  beautify,
  effects = EMPTY_TENCENT_EFFECT_SELECTION,
}: UseTencentWebAROptions) {
  const configured = isTencentWebARConfigured();
  const instanceRef = useRef<TencentWebARInstance | null>(null);
  const outputVideoRef = useRef<HTMLVideoElement | null>(null);
  const outputStreamRef = useRef<MediaStream | null>(null);
  const catalogsLoadedRef = useRef(false);
  const beautifyApplyTimerRef = useRef(0);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [makeups, setMakeups] = useState<TencentEffectItem[]>([]);
  const [stickers, setStickers] = useState<TencentEffectItem[]>([]);
  const [filters, setFilters] = useState<TencentEffectItem[]>([]);
  const [backgrounds] = useState<string[]>([...TRTC_DEFAULT_BACKGROUNDS]);

  const beautyOn = isBeautifyActive(beautify) || hasEffectSelection(effects);
  const inputVideoTrackId = inputStream?.getVideoTracks()[0]?.id ?? '';
  const keepWarm = enabled && configured && Boolean(inputStream);

  useEffect(() => {
    if (!keepWarm || !inputStream) {
      setReady(false);
      setLoading(false);
      catalogsLoadedRef.current = false;
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
            segmentation: true,
            segmentationLevel: '1' as never,
          },
          auth: {
            authFunc: buildSignature,
            appId: getTencentWebARAppId(),
            licenseKey: getTencentWebARLicenseKey(),
          },
          input: inputStream,
          mirror,
          beautify: BEAUTY_OFF_PARAMS,
          language: 'en',
          loading: { enable: false },
        }) as TencentWebARInstance;

        instanceRef.current = instance;

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

        if (!catalogsLoadedRef.current) {
          try {
            const list = await instance.getEffectList?.({ Type: 'Preset' });
            if (list && !cancelled) {
              const mapped = mapEffectRows(list);
              setMakeups(mapped.filter((item) => (item.label || '').includes('Makeup')));
              setStickers(mapped.filter((item) => (item.label || '').includes('Sticker')));
            }
          } catch {
            /* catalogs optional offline */
          }
          try {
            const list = await instance.getCommonFilter?.();
            if (list && !cancelled) setFilters(mapEffectRows(list));
          } catch {
            /* optional */
          }
          catalogsLoadedRef.current = true;
        }

        instance.setBeautify(beautify);
        applyEffects(instance, effects);

        const output = (await instance.getOutput()) as MediaStream;
        if (cancelled) {
          instance.destroy?.({ stopInputStream: false });
          return;
        }

        outputStreamRef.current = output;
        const outputVideo = outputVideoRef.current;
        if (outputVideo) {
          outputVideo.srcObject = output;
          outputVideo.muted = true;
          outputVideo.playsInline = true;
          void outputVideo.play().catch(() => {});
        }

        setReady(true);
        setError(null);
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
  }, [keepWarm, inputVideoTrackId, mirror]);

  useEffect(() => {
    const instance = instanceRef.current;
    if (!instance || !ready) return undefined;
    window.clearTimeout(beautifyApplyTimerRef.current);
    beautifyApplyTimerRef.current = window.setTimeout(() => {
      try {
        instance.setBeautify(beautify);
        applyEffects(instance, effects);
      } catch {
        /* ignore stale instance */
      }
    }, 80);
    return () => window.clearTimeout(beautifyApplyTimerRef.current);
  }, [beautify, effects, ready]);

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
