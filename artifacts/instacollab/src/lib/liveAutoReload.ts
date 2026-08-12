/**
 * Polls deployed build version — when a new deploy lands, prefetches the service
 * worker so the next cold start picks up the build (no mid-session reload).
 * Works for any release channel written into live-version.json (push, deploy, publish, …).
 */
import { stageAppUpdate } from './invisibleReload';
import { isNetworkOnline } from './networkStatus';

export const LIVE_VERSION_UPDATED_EVENT = 'live-version-updated';

const VERSION_URL = '/live-version.json';
const POLL_MS = 3 * 60_000;

let installed = false;
let lastBuildId = '';

async function pollDeployVersion(): Promise<void> {
  if (!isNetworkOnline() || typeof window === 'undefined') return;
  if (import.meta.env.DEV) return;

  try {
    const res = await fetch(`${VERSION_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const data = (await res.json()) as {
      id?: string;
      version?: number | string;
      reason?: string;
    };
    const buildId = String(data.id ?? data.version ?? '');
    if (!buildId) return;

    const reason = String(data.reason || 'deploy');
    const isNew = Boolean(lastBuildId) && buildId !== lastBuildId;

    window.dispatchEvent(
      new CustomEvent(LIVE_VERSION_UPDATED_EVENT, {
        detail: {
          id: buildId,
          version: data.version ?? null,
          reason,
          isNew,
        },
      }),
    );

    if (!lastBuildId) {
      lastBuildId = buildId;
      return;
    }

    if (buildId !== lastBuildId) {
      lastBuildId = buildId;
      // Prefer the remote reason so UI can show push / deploy / publish.
      stageAppUpdate(reason || 'deploy');
    }
  } catch {
    /* offline */
  }
}

export function initLiveAutoReload(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  void pollDeployVersion();
  window.setInterval(() => {
    void pollDeployVersion();
  }, POLL_MS);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      void pollDeployVersion();
    }
  });
}
