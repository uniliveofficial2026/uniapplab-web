/**
 * Client-side deploy polling disabled — production never auto-reloads.
 * `pnpm live` still deploys in the background; users pick up builds on their next visit.
 */
export function initLiveAutoReload(): void {
  // intentional no-op
}
