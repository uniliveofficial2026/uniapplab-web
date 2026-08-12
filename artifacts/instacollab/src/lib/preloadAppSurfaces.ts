/**
 * Warm screen chunks — core tabs first; heavy AR/live bundles on demand.
 */
import { preloadInstant } from './instantTask';

let coreWarmed = false;
let heavyWarmed = false;

/** Feed, messages, profile — small enough to warm after first paint. */
export function preloadCoreAppSurfaces(): void {
  if (coreWarmed || typeof window === 'undefined') return;
  coreWarmed = true;

  const factories: Array<() => Promise<unknown>> = [
    () => import('../components/feed/Feed'),
    () => import('../components/messages/MessagesScreen'),
    () => import('../components/profile/ProfileScreen'),
    () => import('../components/notifications/NotificationsScreen'),
    () => import('../components/search/SearchScreen'),
  ];

  for (const factory of factories) {
    preloadInstant(factory);
  }

  // Do not warm WebAR/AR on core preload — only on live/camera intent.
}

/** Call when user opens Live / Create / Call — full WebAR pipeline warm. */
export function warmWebARForLiveIntent(): void {
  if (typeof window === 'undefined') return;
  void import('./webar/tencentWebARPool').then((m) => {
    m.hydrateTencentWebARCatalogsFromStorage();
    m.warmTencentWebARForVideoCall();
  });
  void import('./webar/tencentWebARWarm').then((m) => {
    m.warmTencentWebARPipelineNow();
  });
}

/** Karaoke, live, rooms, DeepAR — only when user opens those features. */
export function preloadHeavyAppSurfaces(): void {
  if (heavyWarmed || typeof window === 'undefined') return;
  heavyWarmed = true;

  // Screen chunks only — AR/WebAR stay behind warmWebARForLiveIntent / ensureArStack.
  const factories: Array<() => Promise<unknown>> = [
    () => import('../components/live/LiveScreen'),
    () => import('../components/karaoke/KaraokeScreen'),
    () => import('../smule-rooms/RoomsHost'),
    () => import('../components/wallet/WalletScreen'),
    () => import('../components/workspace/WorkspaceGate'),
    () => import('../components/dating/DatingScreen'),
    () => import('../pages/YouTube'),
  ];

  for (const factory of factories) {
    preloadInstant(factory);
  }
}

/** @deprecated use preloadCoreAppSurfaces + preloadHeavyAppSurfaces */
export function preloadAllAppSurfaces(): void {
  preloadCoreAppSurfaces();
  preloadHeavyAppSurfaces();
}
