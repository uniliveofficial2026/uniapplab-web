/**
 * Polls deployed build version — when a new deploy lands, schedules a silent
 * PWA refresh (background) so users never need to reinstall the app.
 */
import { queueInvisibleReload } from './invisibleReload';
import { checkForPwaUpdate } from './pwaAutoUpdate';
import { isNetworkOnline } from './networkStatus';

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
    const data = (await res.json()) as { id?: string; version?: number | string };
    const buildId = String(data.id ?? data.version ?? '');
    if (!buildId) return;

    if (!lastBuildId) {
      lastBuildId = buildId;
      return;
    }

    if (buildId !== lastBuildId) {
      lastBuildId = buildId;
      void checkForPwaUpdate();
      queueInvisibleReload('deploy_version');
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
