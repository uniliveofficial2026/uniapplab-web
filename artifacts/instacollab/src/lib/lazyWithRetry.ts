import React from 'react';
import { recoverStaleBuild } from './pwaRegister';

const CHUNK_RELOAD_KEY = 'instacollab-chunk-reload';

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
  return 'This app is out of date after a deploy. Reload to get the latest version.';
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

export { recoverStaleBuild };

async function handleChunkLoadFailure(): Promise<never> {
  if (typeof window === 'undefined') {
    throw new Error(chunkLoadUserMessage());
  }

  const alreadyRetried = sessionStorage.getItem(CHUNK_RELOAD_KEY) === '1';
  if (!alreadyRetried) {
    sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
    await recoverStaleBuild();
    return new Promise(() => {});
  }

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
    if (attempt === 0) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      return loadWithChunkRecovery(factory, 1);
    }
    return handleChunkLoadFailure();
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

  const onFailure = (reason: unknown) => {
    if (!isChunkLoadError(reason)) return;
    void handleChunkLoadFailure();
  };

  window.addEventListener('unhandledrejection', (event) => {
    if (!isChunkLoadError(event.reason)) return;
    event.preventDefault();
    onFailure(event.reason);
  });

  window.addEventListener(
    'error',
    (event) => {
      const target = event.target;
      if (target instanceof HTMLScriptElement && target.src.includes('/assets/')) {
        event.preventDefault();
        onFailure(event.message || `Failed to load ${target.src}`);
      }
    },
    true,
  );
}
