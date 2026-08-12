/**
 * Eager TRTC / Tencent WebAR warm — preload module + catalogs without opening the camera.
 * GPU init is deferred until beauty/effects are actually selected (keeps preview low-latency).
 */
import { releaseAppCamera } from '../camera/appCameraOwner';
import { ensureTencentWebARAllowedHostname, isTencentWebARConfigured } from './webarConfig';
import {
  getSharedTencentWebARInstance,
  hydrateTencentWebARCatalogsFromStorage,
  isSharedTencentWebARInitInProgress,
  isSharedTencentWebARReady,
  preloadTencentWebARModule,
  warmTencentWebARForVideoCall,
} from './tencentWebARPool';
import {
  hasSharedEffectCatalogRows,
  refreshSharedEffectCatalogs,
} from './tencentWebARCatalogs';

const WARM_LEASE_ID = 'trtc-warm';

function releaseWarmCameraLease(): void {
  releaseAppCamera(WARM_LEASE_ID);
}

/** Call when Create Room / call attaches a real camera so the warm LED can turn off. */
export function onSharedInputReplaced(_nextStream?: MediaStream | null): void {
  releaseWarmCameraLease();
}

async function refreshCatalogsIfPossible(): Promise<boolean> {
  if (hasSharedEffectCatalogRows()) return true;
  const instance = getSharedTencentWebARInstance();
  if (!instance) return false;
  await refreshSharedEffectCatalogs(instance, 5);
  return hasSharedEffectCatalogRows();
}

/**
 * Light warm: JS module + cached catalogs only — no GPU / getOutput loop.
 * Safe to call on every camera open; does not add preview latency.
 */
export function ensureTencentWebARPipelineWarm(): Promise<boolean> {
  if (!isTencentWebARConfigured() || typeof window === 'undefined') {
    return Promise.resolve(false);
  }
  if (ensureTencentWebARAllowedHostname()) {
    return Promise.resolve(false);
  }

  hydrateTencentWebARCatalogsFromStorage();
  warmTencentWebARForVideoCall();
  void preloadTencentWebARModule();

  if (hasSharedEffectCatalogRows()) {
    return Promise.resolve(true);
  }

  if (isSharedTencentWebARInitInProgress() || isSharedTencentWebARReady()) {
    return refreshCatalogsIfPossible();
  }

  return Promise.resolve(hasSharedEffectCatalogRows());
}

/** Fire-and-forget light warm from boot / Create Room / call entry. */
export function warmTencentWebARPipelineNow(): void {
  void ensureTencentWebARPipelineWarm();
}
