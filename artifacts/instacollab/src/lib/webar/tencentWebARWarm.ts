/**
 * Eager TRTC / Tencent WebAR warm pipeline — init SDK + catalogs before Create Room / calls.
 * Keeps a keepalive consumer so the shared instance stays ready for instant apply.
 */
import { WEBAR_OUTPUT_FPS } from './webarCameraConfig';
import { isTencentWebARConfigured } from './webarConfig';
import {
  ensureSharedTencentWebAR,
  hydrateTencentWebARCatalogsFromStorage,
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
 * Safe to call many times — deduped. Pins one keepalive so the engine stays warm.
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

  if (warmPromise) return warmPromise;

  warmPromise = (async () => {
    const stream = await getWarmCameraStream();
    if (!stream) return hasSharedEffectCatalogRows();

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
      // ensureShared acquired an extra consumer on repeat warm calls — drop it.
      releaseSharedTencentWebAR();
    }

    const instance = shared.instance;
    if (!instance) return false;

    await refreshSharedEffectCatalogs(instance, 5);
    return isSharedTencentWebARReady() && hasSharedEffectCatalogRows();
  })()
    .catch(() => hasSharedEffectCatalogRows())
    .finally(() => {
      // Allow a later retry if this attempt failed to populate catalogs.
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
