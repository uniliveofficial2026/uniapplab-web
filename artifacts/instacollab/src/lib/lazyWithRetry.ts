import React from 'react';
import { stageAppUpdate } from './invisibleReload';
import { isNetworkOnline } from './networkStatus';
import { checkForPwaUpdate } from './pwaAutoUpdate';

const CHUNK_RELOAD_KEY = 'instacollab-chunk-reload';
const RETRY_DELAYS_MS = [400, 800, 1200];

export function isChunkLoadError(reason: unknown): boolean {
  const message =
    reason instanceof Error
      ? reason.message
      : typeof reason === 'string'
        ? reason
        : '';
  return (
    /Failed to fetch dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message) ||
    /error loading dynamically imported module/i.test(message) ||
    /Loading chunk [\d]+ failed/i.test(message) ||
    /out of date after a deploy/i.test(message)
  );
}

export function chunkLoadUserMessage(): string {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return 'This screen is not cached yet. Your other tabs and saved content stay available offline.';
  }
  return 'This screen is updating in the background. Try again in a moment.';
}

export function clearChunkReloadGuard(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(CHUNK_RELOAD_KEY);
    const url = new URL(window.location.href);
    if (url.searchParams.has('_chunk_recovery')) {
      url.searchParams.delete('_chunk_recovery');
      window.history.replaceState(null, '', url.toString());
    }
  } catch {
    /* ignore */
  }
}

async function handleChunkLoadFailure(): Promise<never> {
  await checkForPwaUpdate();
  stageAppUpdate('lazy_chunk');
  throw new Error(chunkLoadUserMessage());
}

async function loadWithChunkRecovery<T extends React.ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>,
  attempt = 0,
): Promise<{ default: T }> {
  try {
    return await factory();
  } catch (err) {
    if (!isChunkLoadError(err)) throw err;
    // Offline: fail immediately so UI stays on saved shell (no multi-second retry spinner).
    if (!isNetworkOnline() || attempt >= RETRY_DELAYS_MS.length) {
      return handleChunkLoadFailure();
    }
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
    return loadWithChunkRecovery(factory, attempt + 1);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyWithRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
): React.LazyExoticComponent<T> {
  return React.lazy(() => loadWithChunkRecovery(factory));
}

export function installChunkLoadRecovery(): void {
  if (typeof window === 'undefined') return;

  window.addEventListener('unhandledrejection', (event) => {
    if (!isChunkLoadError(event.reason)) return;
    event.preventDefault();
    void checkForPwaUpdate();
    stageAppUpdate('chunk_unhandled');
  });
}
