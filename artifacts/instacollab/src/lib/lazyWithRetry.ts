import React from 'react';
import { queueInvisibleReload } from './invisibleReload';

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

/** React #310/#311 — hook list desync (often Vite HMR mid-session). */
export function isInvalidHookCallError(reason: unknown): boolean {
  const message =
    reason instanceof Error
      ? reason.message
      : typeof reason === 'string'
        ? reason
        : '';
  return (
    /Should have a queue/i.test(message) ||
    /Rendered more hooks than during the previous render/i.test(message) ||
    /Rendered fewer hooks than expected/i.test(message) ||
    /change in the order of Hooks/i.test(message) ||
    /Invalid hook call/i.test(message) ||
    /calling Hooks conditionally/i.test(message)
  );
}

/**
 * Stale Vite HMR / half-applied module — e.g. removed `menuDrag` still referenced
 * by a hot-patched render until a full remount.
 */
export function isStaleModuleReferenceError(reason: unknown): boolean {
  const message =
    reason instanceof Error
      ? reason.message
      : typeof reason === 'string'
        ? reason
        : '';
  if (!/\bis not defined\b/i.test(message)) return false;
  return /\b(menuDrag|chatToggleDrag|viewersToggleDrag|menuPosition|toolsDockDrag)\b/i.test(
    message,
  );
}

export function isRecoverableRenderError(reason: unknown): boolean {
  return isInvalidHookCallError(reason) || isStaleModuleReferenceError(reason);
}

export function chunkLoadUserMessage(): string {
  return 'A newer version is available. Reload when you are ready.';
}

export function invalidHookUserMessage(): string {
  return 'The live session got out of sync. Reloading…';
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
  queueInvisibleReload('lazy_chunk');
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
      await new Promise((resolve) => setTimeout(resolve, 400));
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

  window.addEventListener('unhandledrejection', (event) => {
    if (!isChunkLoadError(event.reason)) return;
    event.preventDefault();
    queueInvisibleReload('chunk_unhandled');
  });
}
