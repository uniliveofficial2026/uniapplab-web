import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

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

export function clearChunkReloadGuard(): void {
  // kept for bootstrap compatibility
}

/** Lazy import — never auto-reloads the page (invisible live sync). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
  return lazy(factory);
}

export function installChunkLoadRecovery(): void {
  // intentional no-op — no silent or visible reloads on chunk errors
}
