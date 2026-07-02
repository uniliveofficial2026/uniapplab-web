/**
 * Stage deploy / PWA updates in the background — never reload mid-session.
 * Live data (thoughts, profiles, wallet) syncs in-place via cloud systems.
 */
import { refreshCloudSystemsInPlace } from './appCloudSystems';
import { checkForPwaUpdate } from './pwaAutoUpdate';

export const APP_UPDATE_STAGED_EVENT = 'app-update-staged';

let staging = false;
let pendingReason: string | null = null;

async function runStageUpdate(reason: string): Promise<void> {
  try {
    await checkForPwaUpdate();
    refreshCloudSystemsInPlace(`staged:${reason}`);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(APP_UPDATE_STAGED_EVENT, { detail: { reason } }),
      );
    }
  } finally {
    pendingReason = null;
    staging = false;
  }
}

/** @deprecated Name kept for callers — stages updates without reloading. */
export function queueInvisibleReload(reason?: string): void {
  stageAppUpdate(reason);
}

export function stageAppUpdate(reason = 'update'): void {
  if (typeof window === 'undefined') return;
  pendingReason = reason ?? 'update';
  if (staging) return;
  staging = true;
  void runStageUpdate(pendingReason);
}

export function cancelInvisibleReload(): void {
  pendingReason = null;
  staging = false;
}
