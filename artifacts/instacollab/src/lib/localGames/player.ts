import { getLocalGameBundle } from './vault';

const SW_PATH = 'local-game-sw.js';
const PLAY_MARKER = '/__local_game__/';

let swRegistrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;

export async function ensureLocalGameServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }
  if (!swRegistrationPromise) {
    const base = import.meta.env.BASE_URL || '/';
    const normalizedBase = base.endsWith('/') ? base : `${base}/`;
    const swUrl = `${normalizedBase}${SW_PATH}`.replace(/\/{2,}/g, '/').replace(':/', '://');
    const scope = `${normalizedBase}__local_game__/`;
    swRegistrationPromise = navigator.serviceWorker
      .register(swUrl, { scope })
      .catch((err) => {
        console.warn('[local-games] service worker registration failed:', err);
        return null;
      });
  }
  return swRegistrationPromise;
}

export function buildWebGamePlayUrl(gameId: string, entryPath: string): string {
  const base = import.meta.env.BASE_URL || '/';
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  const cleanEntry = entryPath.replace(/^\.?\//, '');
  return `${normalizedBase}__local_game__/${gameId}/${cleanEntry.split('/').map(encodeURIComponent).join('/')}`;
}

export async function createSingleFileHtmlPlayUrl(gameId: string): Promise<string | undefined> {
  const bundle = await getLocalGameBundle(gameId);
  if (!bundle || bundle.files.length !== 1) return undefined;
  const file = bundle.files[0];
  if (!/\.html?$/i.test(file.path)) return undefined;
  const blob = new Blob([file.data], { type: file.mime || 'text/html' });
  return URL.createObjectURL(blob);
}

export async function resolveWebGameLaunchUrl(
  gameId: string,
  entryPath: string
): Promise<{ url: string; revoke?: () => void }> {
  const blobUrl = await createSingleFileHtmlPlayUrl(gameId);
  if (blobUrl) {
    return { url: blobUrl, revoke: () => URL.revokeObjectURL(blobUrl) };
  }
  await ensureLocalGameServiceWorker();
  return { url: buildWebGamePlayUrl(gameId, entryPath) };
}

export async function createNativeDownloadUrl(gameId: string): Promise<{ url: string; fileName: string } | undefined> {
  const bundle = await getLocalGameBundle(gameId);
  if (!bundle || bundle.files.length === 0) return undefined;
  const file = bundle.files[0];
  const blob = new Blob([file.data], { type: file.mime || 'application/octet-stream' });
  return {
    url: URL.createObjectURL(blob),
    fileName: file.path.split('/').pop() ?? bundle.entryPath,
  };
}
