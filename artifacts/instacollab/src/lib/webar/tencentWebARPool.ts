/**
 * Process-wide Tencent WebAR singleton — init once, reuse across chat/karaoke/live.
 * Avoids cold-starting the SDK on every overlay mount or beauty apply.
 */
import { sha256 } from 'js-sha256';
import {
  getTencentWebARAppId,
  getTencentWebARLicenseKey,
  getTencentWebARToken,
  isTencentWebARConfigured,
} from './webarConfig';
import { WEBAR_CAMERA_FPS } from './webarCameraConfig';
import type { TencentWebARInstance } from './webarTypes';
import { BEAUTY_OFF_PARAMS } from '../ar/beautyFilters';

type SdkModule = typeof import('tencentcloud-webar');

let modulePromise: Promise<SdkModule> | null = null;
let sharedInstance: TencentWebARInstance | null = null;
let sharedReady = false;
let sharedOutputStream: MediaStream | null = null;
let sharedInputTrackId = '';
let initPromise: Promise<TencentWebARInstance | null> | null = null;
let consumerCount = 0;
let destroyTimer: ReturnType<typeof setTimeout> | null = null;

/** Keep GPU instance warm briefly after last consumer — instant re-open on next call. */
const WARM_TTL_MS = 90_000;

export let sharedCatalogsLoaded = false;

let sharedBeautyCovers: Record<string, string> = {};
let sharedShapeCovers: Record<string, string> = {};
let sharedShapeEffectByPreset: Record<string, string> = {};

export function getSharedTencentWebARCovers(): {
  beautyCovers: Record<string, string>;
  shapeCovers: Record<string, string>;
  shapeEffectByPreset: Record<string, string>;
} {
  return {
    beautyCovers: sharedBeautyCovers,
    shapeCovers: sharedShapeCovers,
    shapeEffectByPreset: sharedShapeEffectByPreset,
  };
}

export function setSharedTencentWebARCovers(
  beautyCovers: Record<string, string>,
  shapeCovers: Record<string, string>,
  shapeEffectByPreset: Record<string, string> = {},
): void {
  sharedBeautyCovers = beautyCovers;
  sharedShapeCovers = shapeCovers;
  sharedShapeEffectByPreset = shapeEffectByPreset;
}

async function buildSignature() {
  const appId = getTencentWebARAppId();
  const token = getTencentWebARToken();
  const timestamp = Math.round(Date.now() / 1000);
  const signature = sha256(`${timestamp}${token}${appId}${timestamp}`).toUpperCase();
  return { signature, timestamp };
}

export function preloadTencentWebARModule(): void {
  if (!isTencentWebARConfigured() || typeof window === 'undefined') return;
  modulePromise ??= import('tencentcloud-webar');
}

/** Preload JS module + AR asset manifest before a video call starts. */
export function warmTencentWebARForVideoCall(): void {
  if (!isTencentWebARConfigured() || typeof window === 'undefined') return;
  preloadTencentWebARModule();
  void import('../ar/ensureArStack').then((m) => m.ensureArStackLoaded());
}

export async function loadTencentWebARModule(): Promise<SdkModule | null> {
  if (!isTencentWebARConfigured()) return null;
  preloadTencentWebARModule();
  try {
    return await modulePromise!;
  } catch {
    return null;
  }
}

export function getSharedTencentWebARInstance(): TencentWebARInstance | null {
  return sharedInstance;
}

export function isSharedTencentWebARReady(): boolean {
  return sharedReady && !!sharedInstance;
}

export function getSharedTencentWebAROutputStream(): MediaStream | null {
  return sharedOutputStream;
}

export function markSharedTencentWebARCatalogsLoaded(): void {
  sharedCatalogsLoaded = true;
}

function cancelWarmDestroy(): void {
  if (destroyTimer) {
    clearTimeout(destroyTimer);
    destroyTimer = null;
  }
}

function scheduleWarmDestroy(): void {
  cancelWarmDestroy();
  if (consumerCount > 0 || !sharedInstance) return;
  destroyTimer = setTimeout(() => {
    destroyTimer = null;
    if (consumerCount > 0 || !sharedInstance) return;
    try {
      sharedInstance.destroy?.({ stopInputStream: false });
    } catch {
      /* ignore shutdown errors */
    }
    sharedInstance = null;
    sharedReady = false;
    sharedOutputStream = null;
    sharedInputTrackId = '';
    initPromise = null;
  }, WARM_TTL_MS);
}

/** Call when a hook mounts and needs the shared SDK. */
export function acquireSharedTencentWebAR(): void {
  consumerCount += 1;
  cancelWarmDestroy();
}

/** Call when a hook unmounts — instance stays warm for WARM_TTL_MS. */
export function releaseSharedTencentWebAR(): void {
  consumerCount = Math.max(0, consumerCount - 1);
  if (consumerCount === 0) {
    scheduleWarmDestroy();
  }
}

type EnsureSharedOptions = {
  inputStream: MediaStream;
  mirror: boolean;
  needsSegmentation: boolean;
  outputFps: number;
};

export async function ensureSharedTencentWebAR(
  options: EnsureSharedOptions,
): Promise<{ instance: TencentWebARInstance | null; output: MediaStream | null }> {
  if (!isTencentWebARConfigured()) return { instance: null, output: null };

  acquireSharedTencentWebAR();

  const inputTrackId = options.inputStream.getVideoTracks()[0]?.id ?? '';
  if (sharedInstance && sharedReady) {
    if (inputTrackId && inputTrackId !== sharedInputTrackId && sharedInstance.updateInputStream) {
      sharedInputTrackId = inputTrackId;
      try {
        await sharedInstance.updateInputStream(options.inputStream, false, false);
      } catch {
        /* instance may be mid-update */
      }
    }
    return { instance: sharedInstance, output: sharedOutputStream };
  }

  if (initPromise) {
    const instance = await initPromise;
    return { instance, output: sharedOutputStream };
  }

  initPromise = (async () => {
    const mod = await loadTencentWebARModule();
    if (!mod) return null;

    const instance = new mod.ArSdk({
      module: {
        beautify: true,
        segmentation: options.needsSegmentation,
        ...(options.needsSegmentation ? { segmentationLevel: 2 as const } : {}),
      },
      auth: {
        authFunc: buildSignature,
        appId: getTencentWebARAppId(),
        licenseKey: getTencentWebARLicenseKey(),
      },
      mirror: options.mirror,
      beautify: BEAUTY_OFF_PARAMS,
      language: 'en',
      loading: { enable: false },
      fps: WEBAR_CAMERA_FPS,
      input: options.inputStream,
    }) as TencentWebARInstance;

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
        instance.off?.('ready', onReady);
        instance.off?.('error', onError);
      };
      instance.on('ready', onReady);
      instance.on('error', onError);
    });

    sharedOutputStream = (await (instance.getOutput as (fps?: number) => Promise<MediaStream>)(
      options.outputFps,
    )) as MediaStream;
    sharedInstance = instance;
    sharedReady = true;
    sharedInputTrackId = inputTrackId;
    return instance;
  })().finally(() => {
    initPromise = null;
  });

  try {
    const instance = await initPromise;
    return { instance, output: sharedOutputStream };
  } catch {
    sharedInstance = null;
    sharedReady = false;
    sharedOutputStream = null;
    sharedInputTrackId = '';
    return { instance: null, output: null };
  }
}
