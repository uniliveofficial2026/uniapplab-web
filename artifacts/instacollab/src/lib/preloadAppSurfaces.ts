/**
 * Warm screen chunks — core tabs first; heavy AR/live bundles on demand.
 */
import { preloadInstant } from './instantTask';

let coreWarmed = false;
let liveWarmed = false;
let heavyWarmed = false;

function scheduleIdle(fn: () => void): void {
  if (typeof window === 'undefined') return;
  const ric = window.requestIdleCallback;
  if (ric) {
    ric(fn, { timeout: 4000 });
    return;
  }
  window.setTimeout(fn, 1500);
}

/** Feed, messages, profile — deferred until browser idle (never blocks boot). */
export function preloadCoreAppSurfaces(): void {
  if (coreWarmed || typeof window === 'undefined') return;
  coreWarmed = true;

  scheduleIdle(() => {
    const factories: Array<() => Promise<unknown>> = [
      () => import('../components/messages/MessagesScreen'),
      () => import('../components/profile/ProfileScreen'),
      () => import('../components/notifications/NotificationsScreen'),
      () => import('../components/search/SearchScreen'),
    ];

    for (const factory of factories) {
      preloadInstant(factory);
    }
  });
}

/** Live tab — warm TRTC module + live screen only (no DeepAR zips). */
export function preloadLiveTabSurfaces(): void {
  if (liveWarmed || typeof window === 'undefined') return;
  liveWarmed = true;

  void import('tencentcloud-webar').catch(() => undefined);
  preloadInstant(() => import('../components/live/LiveScreen'));
}

/** Karaoke, rooms, full AR stack — when user opens those features. */
export function preloadHeavyAppSurfaces(): void {
  if (heavyWarmed || typeof window === 'undefined') return;
  heavyWarmed = true;

  void import('./ar/ensureArStack').then((m) => m.ensureArStackLoaded());

  const factories: Array<() => Promise<unknown>> = [
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
