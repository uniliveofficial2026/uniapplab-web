import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import { applyPwaUpdate } from './pwaRegister';

const RELOAD_GUARD_KEY = 'instacollab_chunk_reload_once';

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
    /Loading chunk [\d]+ failed/i.test(message)
  );
}

function reloadForFreshChunks(): never {
  if (typeof window === 'undefined') {
    throw new Error('Failed to load app module.');
  }
  const alreadyReloaded = sessionStorage.getItem(RELOAD_GUARD_KEY);
  if (!alreadyReloaded) {
    sessionStorage.setItem(RELOAD_GUARD_KEY, '1');
    void applyPwaUpdate();
    window.location.reload();
    return new Promise(() => undefined) as never;
  }
  sessionStorage.removeItem(RELOAD_GUARD_KEY);
  throw new Error(
    'This page is out of date after a deploy. Hard-refresh the page or clear site data, then open Karaoke again.',
  );
}

export function clearChunkReloadGuard(): void {
  try {
    sessionStorage.removeItem(RELOAD_GUARD_KEY);
  } catch {
    /* private mode */
  }
}

/** Lazy import that auto-reloads once when a stale deploy chunk 404s (PWA / browser cache). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
  return lazy(() =>
    factory().catch((err) => {
      if (isChunkLoadError(err)) reloadForFreshChunks();
      throw err;
    }),
  );
}

export function installChunkLoadRecovery(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('unhandledrejection', (event) => {
    if (!isChunkLoadError(event.reason)) return;
    event.preventDefault();
    reloadForFreshChunks();
  });
}
