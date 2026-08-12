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
  isTencentWebARRunnable,
  explainTencentWebARAuthError,
  ensureTencentWebARAllowedHostname,
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
/** Last ensureShared failure — surfaced when instance comes back null. */
let lastInitError: string | null = null;

/**
 * Keep GPU instance warm briefly after last consumer so quick reopen is instant,
 * but release fast so a finished beauty session never hogs GPU/CPU app-wide.
 */
const WARM_TTL_MS = 60_000;

function isLiveVideoStream(stream: MediaStream): boolean {
  const track = stream.getVideoTracks()[0];
  return Boolean(track && track.readyState === 'live');
}

export function getLastTencentWebARInitError(): string | null {
  return lastInitError;
}

const CATALOG_STORAGE_KEY = 'tencentWebAREffectCatalogs.v1';

export let sharedCatalogsLoaded = false;

let sharedBeautyCovers: Record<string, string> = {};
let sharedShapeCovers: Record<string, string> = {};
let sharedShapeEffectByPreset: Record<string, string> = {};

type SharedEffectCatalogs = {
  makeups: import('./webarTypes').TencentEffectItem[];
  stickers: import('./webarTypes').TencentEffectItem[];
  filters: import('./webarTypes').TencentEffectItem[];
  bodyShapes: import('./webarTypes').TencentEffectItem[];
};

let sharedEffectCatalogs: SharedEffectCatalogs = {
  makeups: [],
  stickers: [],
  filters: [],
  bodyShapes: [],
};

function persistSharedCatalogsToStorage(): void {
  if (typeof window === 'undefined') return;
  if (
    sharedEffectCatalogs.makeups.length === 0 &&
    sharedEffectCatalogs.stickers.length === 0 &&
    sharedEffectCatalogs.filters.length === 0
  ) {
    return;
  }
  try {
    localStorage.setItem(
      CATALOG_STORAGE_KEY,
      JSON.stringify({
        catalogs: sharedEffectCatalogs,
        beautyCovers: sharedBeautyCovers,
        shapeCovers: sharedShapeCovers,
        shapeEffectByPreset: sharedShapeEffectByPreset,
        savedAt: Date.now(),
      }),
    );
  } catch {
    /* quota / private mode */
  }
}

/** Hydrate makeup/sticker/filter trays from last session — no TRTC wait. */
export function hydrateTencentWebARCatalogsFromStorage(): boolean {
  if (typeof window === 'undefined') return false;
  if (
    sharedEffectCatalogs.makeups.length > 0 ||
    sharedEffectCatalogs.stickers.length > 0 ||
    sharedEffectCatalogs.filters.length > 0
  ) {
    sharedCatalogsLoaded = true;
    return true;
  }
  try {
    const raw = localStorage.getItem(CATALOG_STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as {
      catalogs?: Partial<SharedEffectCatalogs>;
      beautyCovers?: Record<string, string>;
      shapeCovers?: Record<string, string>;
      shapeEffectByPreset?: Record<string, string>;
    };
    const catalogs = parsed.catalogs ?? {};
    sharedEffectCatalogs = {
      makeups: Array.isArray(catalogs.makeups) ? catalogs.makeups : [],
      stickers: Array.isArray(catalogs.stickers) ? catalogs.stickers : [],
      filters: Array.isArray(catalogs.filters) ? catalogs.filters : [],
      bodyShapes: Array.isArray(catalogs.bodyShapes) ? catalogs.bodyShapes : [],
    };
    sharedBeautyCovers = parsed.beautyCovers ?? {};
    sharedShapeCovers = parsed.shapeCovers ?? {};
    sharedShapeEffectByPreset = parsed.shapeEffectByPreset ?? {};
    const hasRows =
      sharedEffectCatalogs.makeups.length > 0 ||
      sharedEffectCatalogs.stickers.length > 0 ||
      sharedEffectCatalogs.filters.length > 0;
    if (hasRows) sharedCatalogsLoaded = true;
    return hasRows;
  } catch {
    return false;
  }
}

hydrateTencentWebARCatalogsFromStorage();

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

export function getSharedTencentWebAREffectCatalogs(): SharedEffectCatalogs {
  return {
    makeups: sharedEffectCatalogs.makeups,
    stickers: sharedEffectCatalogs.stickers,
    filters: sharedEffectCatalogs.filters,
    bodyShapes: sharedEffectCatalogs.bodyShapes,
  };
}

export function setSharedTencentWebAREffectCatalogs(next: SharedEffectCatalogs): void {
  sharedEffectCatalogs = {
    makeups: next.makeups,
    stickers: next.stickers,
    filters: next.filters,
    bodyShapes: next.bodyShapes,
  };
  sharedCatalogsLoaded = true;
  persistSharedCatalogsToStorage();
}

export function setSharedTencentWebARCovers(
  beautyCovers: Record<string, string>,
  shapeCovers: Record<string, string>,
  shapeEffectByPreset: Record<string, string> = {},
): void {
  sharedBeautyCovers = beautyCovers;
  sharedShapeCovers = shapeCovers;
  sharedShapeEffectByPreset = shapeEffectByPreset;
  persistSharedCatalogsToStorage();
}

async function buildSignature() {
  const appId = getTencentWebARAppId();
  const token = getTencentWebARToken();
  const timestamp = Math.round(Date.now() / 1000);
  const signature = sha256(`${timestamp}${token}${appId}${timestamp}`).toUpperCase();
  return { signature, timestamp };
}

export function preloadTencentWebARModule(): void {
  if (!isTencentWebARRunnable() || typeof window === 'undefined') return;
  modulePromise ??= import('tencentcloud-webar');
}

/** Preload JS module + AR asset manifest before a video call starts. */
export function warmTencentWebARForVideoCall(): void {
  if (!isTencentWebARRunnable() || typeof window === 'undefined') return;
  hydrateTencentWebARCatalogsFromStorage();
  preloadTencentWebARModule();
  void import('../ar/ensureArStack').then((m) => m.ensureArStackLoaded());
}

export async function loadTencentWebARModule(): Promise<SdkModule | null> {
  if (!isTencentWebARRunnable()) return null;
  preloadTencentWebARModule();
  try {
    return await modulePromise!;
  } catch (err) {
    // Allow a later call to retry the dynamic import (chunk flake / first-load race).
    modulePromise = null;
    lastInitError =
      err instanceof Error ? err.message : 'Failed to load Tencent WebAR module';
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

export function getSharedTencentWebARInputTrackId(): string {
  return sharedInputTrackId;
}

export function isSharedTencentWebARInitInProgress(): boolean {
  return Boolean(initPromise);
}

export function markSharedTencentWebARCatalogsLoaded(): void {
  sharedCatalogsLoaded = true;
}

/**
 * Bind the shared SDK to this camera stream. Always call from UI surfaces so warm
 * pipeline / prior sessions cannot leave effects running on a dead or foreign track.
 */
export async function syncSharedTencentWebARInput(
  inputStream: MediaStream,
  outputFps = WEBAR_CAMERA_FPS,
): Promise<MediaStream | null> {
  if (!sharedInstance || !sharedReady) return sharedOutputStream;
  const track = inputStream.getVideoTracks()[0];
  const inputTrackId = track?.id ?? '';
  if (!inputTrackId || track.readyState !== 'live') return sharedOutputStream;

  if (inputTrackId !== sharedInputTrackId) {
    if (!sharedInstance.updateInputStream) {
      // Cannot rebind — leave track id unchanged so callers keep retrying / stay on raw preview.
      return null;
    }
    try {
      await sharedInstance.updateInputStream(inputStream, false, false);
      sharedInputTrackId = inputTrackId;
      void import('./tencentWebARWarm').then((m) => {
        m.onSharedInputReplaced(inputStream);
      });
    } catch {
      return null;
    }
  }

  try {
    sharedOutputStream = (await (sharedInstance.getOutput as (fps?: number) => Promise<MediaStream>)(
      outputFps,
    )) as MediaStream;
  } catch {
    /* keep previous output */
  }
  return sharedOutputStream;
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
    void import('./tencentWebAREffectQueue').then((m) => {
      m.resetTencentWebAREffectQueue();
    });
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
  // License allowlists localhost only — bounce loopback IPs before auth.
  if (ensureTencentWebARAllowedHostname()) {
    lastInitError = 'Redirecting to localhost for Tencent WebAR license…';
    return { instance: null, output: null };
  }

  if (!isTencentWebARRunnable()) {
    lastInitError = isTencentWebARConfigured()
      ? 'Tencent WebAR needs HTTPS and WebGL on this device'
      : 'Tencent WebAR credentials are not configured';
    return { instance: null, output: null };
  }

  if (!isLiveVideoStream(options.inputStream)) {
    lastInitError = 'Tencent WebAR input camera track is not live';
    return { instance: null, output: null };
  }

  acquireSharedTencentWebAR();

  const fail = (message?: string): { instance: null; output: null } => {
    if (message) lastInitError = message;
    releaseSharedTencentWebAR();
    return { instance: null, output: null };
  };

  const bindCallerInput = async () => {
    if (!sharedInstance || !sharedReady) {
      return fail(lastInitError ?? 'Tencent WebAR failed to initialize');
    }
    try {
      sharedInstance.setCommonConfig?.({ mirror: options.mirror });
    } catch {
      /* ignore */
    }
    const output = await syncSharedTencentWebARInput(options.inputStream, options.outputFps);
    // Rebind failed (no updateInputStream / track dead) — still return instance; caller may retry.
    return { instance: sharedInstance, output: output ?? sharedOutputStream };
  };

  const startInit = async (): Promise<TencentWebARInstance | null> => {
    if (initPromise) return initPromise;

    const inputTrackId = options.inputStream.getVideoTracks()[0]?.id ?? '';
    if (!isLiveVideoStream(options.inputStream)) {
      lastInitError = 'Tencent WebAR input camera track is not live';
      return null;
    }

    initPromise = (async () => {
      const mod = await loadTencentWebARModule();
      if (!mod?.ArSdk) {
        lastInitError = lastInitError ?? 'Failed to load Tencent WebAR module';
        return null;
      }

      if (typeof mod.isWebGLSupported === 'function' && !mod.isWebGLSupported()) {
        lastInitError = 'WebGL is required for Tencent WebAR';
        return null;
      }

      if (!isLiveVideoStream(options.inputStream)) {
        lastInitError = 'Tencent WebAR input camera track ended before init';
        return null;
      }

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

      try {
        const kickCatalogs = () => {
          void import('./tencentWebARCatalogs').then((m) => {
            void m.refreshSharedEffectCatalogs(instance, 5);
          });
        };
        instance.on?.('created', kickCatalogs);

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
            instance.off?.('ready', onReady);
            instance.off?.('error', onError);
          };
          instance.on('ready', onReady);
          instance.on('error', onError);
        });

        kickCatalogs();

        sharedOutputStream = (await (instance.getOutput as (fps?: number) => Promise<MediaStream>)(
          options.outputFps,
        )) as MediaStream;
        sharedInstance = instance;
        sharedReady = true;
        sharedInputTrackId = inputTrackId;
        lastInitError = null;
        return instance;
      } catch (err) {
        try {
          instance.destroy?.({ stopInputStream: false });
        } catch {
          /* ignore */
        }
        throw err;
      }
    })()
      .catch((err) => {
        lastInitError = explainTencentWebARAuthError(
          err instanceof Error ? err.message : err,
        );
        sharedInstance = null;
        sharedReady = false;
        sharedOutputStream = null;
        sharedInputTrackId = '';
        void import('./tencentWebAREffectQueue').then((m) => {
          m.resetTencentWebAREffectQueue();
        });
        return null;
      })
      .finally(() => {
        initPromise = null;
      });

    return initPromise;
  };

  try {
    if (sharedInstance && sharedReady) {
      return await bindCallerInput();
    }

    // Wait for in-flight init, but do not inherit a failure forever — retry with this stream.
    if (initPromise) {
      const instance = await initPromise;
      if (instance && sharedReady) {
        return await bindCallerInput();
      }
    }

    if (sharedInstance && sharedReady) {
      return await bindCallerInput();
    }

    const instance = await startInit();
    if (!instance) {
      return fail(lastInitError ?? 'Tencent WebAR failed to initialize');
    }
    return await bindCallerInput();
  } catch (err) {
    sharedInstance = null;
    sharedReady = false;
    sharedOutputStream = null;
    sharedInputTrackId = '';
    void import('./tencentWebAREffectQueue').then((m) => {
      m.resetTencentWebAREffectQueue();
    });
    return fail(
      err instanceof Error ? err.message : 'Tencent WebAR failed to initialize',
    );
  }
}
