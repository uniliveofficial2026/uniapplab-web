/**
 * Schedules silent app refresh (PWA update / chunk recovery) when safe —
 * typically when the user backgrounds the app, not mid-tap.
 */
import { applySilentAppUpdate } from './pwaAutoUpdate';

let pendingReason: string | null = null;
let refreshScheduled = false;

async function runSafeRefresh(): Promise<void> {
  const reason = pendingReason ?? 'update';
  try {
    await applySilentAppUpdate(reason);
  } finally {
    pendingReason = null;
    refreshScheduled = false;
  }
}

function scheduleWhenHidden(): void {
  if (typeof document === 'undefined') return;

  if (document.visibilityState === 'hidden') {
    void runSafeRefresh();
    return;
  }

  const onVisibility = () => {
    if (document.visibilityState !== 'hidden') return;
    document.removeEventListener('visibilitychange', onVisibility);
    void runSafeRefresh();
  };
  document.addEventListener('visibilitychange', onVisibility);
}

export function queueInvisibleReload(reason?: string): void {
  if (typeof window === 'undefined') return;
  pendingReason = reason ?? 'update';
  if (refreshScheduled) return;
  refreshScheduled = true;
  scheduleWhenHidden();
}

export function cancelInvisibleReload(): void {
  pendingReason = null;
  refreshScheduled = false;
}
