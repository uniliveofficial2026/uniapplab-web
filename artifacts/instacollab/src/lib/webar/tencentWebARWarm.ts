/**
 * Eager TRTC / Tencent WebAR warm — preload module + catalogs without stealing the preview camera.
 * Full SDK init with getUserMedia only when the engine is cold and nothing else is initializing.
 */
import { WEBAR_OUTPUT_FPS } from './webarCameraConfig';
import { isTencentWebARConfigured } from './webarConfig';
import {
  ensureSharedTencentWebAR,
  hydrateTencentWebARCatalogsFromStorage,
  isSharedTencentWebARInitInProgress,
  isSharedTencentWebARReady,
  releaseSharedTencentWebAR,
  warmTencentWebARForVideoCall,
} from './tencentWebARPool';
import {
  hasSharedEffectCatalogRows,
  refreshSharedEffectCatalogs,
} from './tencentWebARCatalogs';

let warmPromise: Promise<boolean> | null = null;
let keepalivePinned = false;
let warmCameraStream: MediaStream | null = null;

async function getWarmCameraStream(): Promise<MediaStream | null> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return null;
  const live = warmCameraStream?.getVideoTracks()[0]?.readyState === 'live';
  if (live && warmCameraStream) return warmCameraStream;

  try {
    warmCameraStream?.getTracks().forEach((track) => track.stop());
  } catch {
    /* ignore */
  }

  try {
    warmCameraStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: 'user',
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 24, max: 30 },
      },
    });
    return warmCameraStream;
  } catch {
    warmCameraStream = null;
    return null;
  }
}

function stopWarmCameraStream(): void {
  if (!warmCameraStream) return;
  try {
    warmCameraStream.getTracks().forEach((track) => track.stop());
  } catch {
    /* ignore */
  }
  warmCameraStream = null;
}

/** Call when Create Room / call attaches a real camera so the warm LED can turn off. */
export function onSharedInputReplaced(nextStream?: MediaStream | null): void {
  if (!warmCameraStream) return;
  if (nextStream && nextStream === warmCameraStream) return;
  stopWarmCameraStream();
}

/**
 * Start (or reuse) the shared WebAR engine and load makeup/sticker/filter catalogs.
 * Safe to call many times — deduped. Does not open a second camera when UI already owns one.
 */
export function ensureTencentWebARPipelineWarm(): Promise<boolean> {
  if (!isTencentWebARConfigured() || typeof window === 'undefined') {
    return Promise.resolve(false);
  }

  hydrateTencentWebARCatalogsFromStorage();
  warmTencentWebARForVideoCall();

  if (isSharedTencentWebARReady() && hasSharedEffectCatalogRows()) {
    return Promise.resolve(true);
  }

  // Create Room / call is already initializing — don't open a competing camera.
  if (isSharedTencentWebARInitInProgress() || isSharedTencentWebARReady()) {
    return Promise.resolve(hasSharedEffectCatalogRows());
  }

  if (warmPromise) return warmPromise;

  warmPromise = (async () => {
    // Bail if a UI surface started init while we awaited permission.
    if (isSharedTencentWebARInitInProgress() || isSharedTencentWebARReady()) {
      return hasSharedEffectCatalogRows();
    }

    const stream = await getWarmCameraStream();
    if (!stream) return hasSharedEffectCatalogRows();

    if (isSharedTencentWebARInitInProgress() || isSharedTencentWebARReady()) {
      stopWarmCameraStream();
      return hasSharedEffectCatalogRows();
    }

    const shared = await ensureSharedTencentWebAR({
      inputStream: stream,
      mirror: true,
      needsSegmentation: false,
      outputFps: WEBAR_OUTPUT_FPS,
    });

    // Pin one consumer for the app session so the pool never cold-destroys mid-use.
    if (!keepalivePinned) {
      keepalivePinned = true;
    } else {
      releaseSharedTencentWebAR();
    }

    const instance = shared.instance;
    if (!instance) {
      stopWarmCameraStream();
      return false;
    }

    await refreshSharedEffectCatalogs(instance, 5);
    return isSharedTencentWebARReady() && hasSharedEffectCatalogRows();
  })()
    .catch(() => hasSharedEffectCatalogRows())
    .finally(() => {
      if (!hasSharedEffectCatalogRows() || !isSharedTencentWebARReady()) {
        warmPromise = null;
      }
    });

  return warmPromise;
}

/** Fire-and-forget warm from boot / Create Room / call entry. */
export function warmTencentWebARPipelineNow(): void {
  void ensureTencentWebARPipelineWarm();
}
