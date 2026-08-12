import { getLocalGameBundle } from './vault';
import {
  createVfsPlayLaunch,
  normalizePath,
  rewriteHtmlForLocalPlay,
  type VfsLaunch,
} from './vfs';
import type { LocalGameBundle } from './types';

const SW_PATH = 'local-game-sw.js';

export type WebGameLaunch = {
  mode: 'srcdoc' | 'sw' | 'blob';
  srcDoc?: string;
  url?: string;
  revoke?: () => void;
};

let swRegistrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;

function localGameSwUrl(): string {
  const base = import.meta.env.BASE_URL || '/';
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  return `${normalizedBase}${SW_PATH}`.replace(/\/{2,}/g, '/').replace(':/', '://');
}

function localGameScope(): string {
  const base = import.meta.env.BASE_URL || '/';
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  return `${normalizedBase}__local_game__/`;
}

function waitForWorker(worker: ServiceWorker, timeoutMs = 8_000): Promise<boolean> {
  if (worker.state === 'activated') return Promise.resolve(true);
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(false), timeoutMs);
    worker.addEventListener('statechange', () => {
      if (worker.state === 'activated') {
        window.clearTimeout(timer);
        resolve(true);
      }
    });
  });
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> {
  let timer = 0;
  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => {
        timer = window.setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) window.clearTimeout(timer);
  }
}

function postToWorker<T extends object>(
  worker: ServiceWorker,
  message: T,
  timeoutMs = 12_000,
): Promise<boolean> {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timer = window.setTimeout(() => resolve(false), timeoutMs);
    channel.port1.onmessage = () => {
      window.clearTimeout(timer);
      resolve(true);
    };
    try {
      worker.postMessage(message, [channel.port2]);
    } catch {
      window.clearTimeout(timer);
      resolve(false);
    }
  });
}

/**
 * Register the scoped local-game SW.
 *
 * Important: do NOT await `navigator.serviceWorker.ready` — that waits for a
 * worker that controls *this* page. Our SW only scopes `/__local_game__/`, so
 * in Vite (no PWA controller) `ready` never resolves and Play stays on
 * "Preparing game…".
 */
export async function ensureLocalGameServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }
  if (!window.isSecureContext) return null;

  if (!swRegistrationPromise) {
    swRegistrationPromise = (async () => {
      try {
        const registration = await withTimeout(
          navigator.serviceWorker.register(localGameSwUrl(), {
            scope: localGameScope(),
            updateViaCache: 'none',
          }),
          8_000,
        );
        if (!registration) {
          console.warn('[local-games] service worker registration timed out');
          return null;
        }
        void registration.update().catch(() => undefined);
        const worker = registration.installing || registration.waiting || registration.active;
        if (worker && worker.state !== 'activated') {
          await waitForWorker(worker);
        }
        if (!registration.active) {
          console.warn('[local-games] service worker has no active worker yet');
          return null;
        }
        return registration;
      } catch (err) {
        console.warn('[local-games] service worker registration failed:', err);
        return null;
      }
    })().then((reg) => {
      // Allow retry on the next Play if this attempt did not activate.
      if (!reg?.active) swRegistrationPromise = null;
      return reg;
    });
  }
  return swRegistrationPromise;
}

export function buildWebGamePlayUrl(gameId: string, entryPath: string): string {
  const base = import.meta.env.BASE_URL || '/';
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  const cleanEntry = normalizePath(entryPath);
  return `${normalizedBase}__local_game__/${gameId}/${cleanEntry
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`;
}

async function mountBundleInServiceWorker(
  registration: ServiceWorkerRegistration,
  bundle: LocalGameBundle,
): Promise<boolean> {
  const worker = registration.active;
  if (!worker) return false;
  // Clone buffers — IDB ArrayBuffers can be detached / non-transferable in some browsers.
  const cloned: LocalGameBundle = {
    ...bundle,
    files: bundle.files.map((file) => ({
      path: file.path,
      mime: file.mime,
      data: file.data.slice(0),
    })),
  };
  return postToWorker(worker, { type: 'MOUNT_GAME', gameId: bundle.id, bundle: cloned });
}

async function probeServiceWorkerPlayUrl(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'GET', cache: 'no-store' });
    if (!res.ok) return false;
    // Vercel SPA rewrite also returns text/html — require our SW marker header.
    if (res.headers.get('X-Local-Game') !== '1') return false;
    const type = res.headers.get('content-type') || '';
    return /text\/html/i.test(type);
  } catch {
    return false;
  }
}

async function createSingleFileSrcDoc(gameId: string): Promise<VfsLaunch | undefined> {
  const bundle = await getLocalGameBundle(gameId);
  if (!bundle || bundle.files.length !== 1) return undefined;
  const file = bundle.files[0];
  if (!/\.html?$/i.test(file.path)) return undefined;
  const srcDoc = rewriteHtmlForLocalPlay(new TextDecoder().decode(file.data), './');
  return { srcDoc, revoke: () => undefined };
}

async function tryServiceWorkerLaunch(
  gameId: string,
  resolvedEntry: string,
  playBundle: LocalGameBundle,
): Promise<WebGameLaunch | null> {
  const registration = await ensureLocalGameServiceWorker();
  if (!registration?.active) return null;

  const mounted = await mountBundleInServiceWorker(registration, playBundle);
  if (!mounted) return null;

  const url = buildWebGamePlayUrl(gameId, resolvedEntry);
  const ok = await probeServiceWorkerPlayUrl(url);
  if (ok) {
    return {
      mode: 'sw',
      url,
      revoke: () => {
        void postToWorker(registration.active!, { type: 'UNMOUNT_GAME', gameId });
      },
    };
  }

  // SW mounted but HTML probe failed (common in Vite: middleware 404).
  // Prefer pure VFS srcDoc — assets resolve via blob map, no SW needed.
  return null;
}

/**
 * Resolve a launch payload for a web game.
 *
 * Strategy:
 * 1) Single-file HTML → srcDoc
 * 2) Try scoped local-game SW (best relative URL resolution) with a hard timeout
 * 3) Else srcDoc VFS with blob-rewritten assets + fetch/XHR hooks
 */
export async function resolveWebGameLaunchUrl(
  gameId: string,
  entryPath: string,
): Promise<WebGameLaunch> {
  const bundle = await getLocalGameBundle(gameId);
  if (!bundle) {
    throw new Error('Game files are missing from local storage. Re-import the ZIP/HTML and try again.');
  }
  const resolvedEntry = normalizePath(entryPath || bundle.entryPath);
  if (!resolvedEntry) {
    throw new Error('This game has no HTML entry point.');
  }
  const playBundle: LocalGameBundle = { ...bundle, entryPath: resolvedEntry };

  const single = await createSingleFileSrcDoc(gameId);
  if (single) {
    return { mode: 'srcdoc', srcDoc: single.srcDoc, revoke: single.revoke };
  }

  // Cap SW path so a hung register/mount never leaves the UI on "Preparing…".
  const swLaunch = await withTimeout(
    tryServiceWorkerLaunch(gameId, resolvedEntry, playBundle),
    10_000,
  );
  if (swLaunch) return swLaunch;

  try {
    const vfs = await createVfsPlayLaunch(playBundle);
    return { mode: 'srcdoc', srcDoc: vfs.srcDoc, revoke: vfs.revoke };
  } catch (vfsErr) {
    console.warn('[local-games] VFS launch failed:', vfsErr);
    throw new Error(
      vfsErr instanceof Error
        ? vfsErr.message
        : 'Could not start the local game player. Re-import the ZIP and try again.',
    );
  }
}

export async function createNativeDownloadUrl(
  gameId: string,
): Promise<{ url: string; fileName: string } | undefined> {
  const bundle = await getLocalGameBundle(gameId);
  if (!bundle || bundle.files.length === 0) return undefined;
  const file = bundle.files[0];
  const blob = new Blob([file.data], { type: file.mime || 'application/octet-stream' });
  return {
    url: URL.createObjectURL(blob),
    fileName: file.path.split('/').pop() ?? bundle.entryPath,
  };
}
