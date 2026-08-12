/**
 * Instant UI boot — preload hot surfaces first; defer heavy stacks so taps stay instant.
 */
import { preloadInstant } from './instantTask';
import { hasInstantSessionCache } from './instantCachePolicy';
import { onAppShellReady } from './appShellReady';

let started = false;
let entireWarmed = false;
let heavyWarmed = false;

/** Every primary tab lazy chunk in App.tsx — listed for documentation; not auto-preloaded. */
const ALL_TAB_IMPORTS: Array<() => Promise<unknown>> = [
  () => import('../components/messages/MessagesScreen'),
  () => import('../components/notifications/NotificationsScreen'),
  () => import('../components/search/SearchScreen'),
  () => import('../components/reels/ReelsScreen'),
  () => import('../components/profile/ProfileScreen'),
  () => import('../components/live/LiveScreen'),
  () => import('../components/karaoke/KaraokeScreen'),
  () => import('../smule-rooms/RoomsHost'),
  () => import('../components/games/GameHubScreen'),
  () => import('../components/games/LocalGamesScreen'),
  () => import('../components/games/ThirdPartyGamesScreen'),
  () => import('../pages/YouTube'),
  () => import('../components/wallet/WalletScreen'),
  () => import('../components/workspace/WorkspaceGate'),
  () => import('../components/dating/DatingScreen'),
];

void ALL_TAB_IMPORTS;

/** Hot-path tabs — messages, feed, reels, notifications. */
const HOT_TAB_IMPORTS: Array<() => Promise<unknown>> = [
  () => import('../components/messages/MessagesScreen'),
  () => import('../components/notifications/NotificationsScreen'),
  () => import('../components/reels/ReelsScreen'),
  () => import('../components/profile/ProfileScreen'),
];

function preloadAll(factories: Array<() => Promise<unknown>>): void {
  for (const factory of factories) {
    preloadInstant(factory);
  }
}

function scheduleIdle(fn: () => void, timeoutMs: number): void {
  if (typeof window === 'undefined') return;
  const ric = window.requestIdleCallback;
  if (ric) {
    ric(fn, { timeout: timeoutMs });
    return;
  }
  window.setTimeout(fn, Math.min(timeoutMs, 2500));
}

/** Prefetch hot tab chunks immediately (0ms delay). */
export function warmCoreScreenChunks(): void {
  preloadAll(HOT_TAB_IMPORTS);
}

/** Chat / video call surfaces — only when a call is likely. */
export function warmCallSurfaceChunks(): void {
  preloadAll([
    () => import('../contexts/ChatCallProviderImpl'),
    () => import('../contexts/ChatCallVideoEffectsHost'),
    () => import('../components/messages/MessagesActiveCallOverlay'),
    () => import('../components/messages/ChatCallPipWindow'),
  ]);
}

function connectionSaveData(): boolean {
  if (typeof navigator === 'undefined') return false;
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } })
    .connection;
  if (conn?.saveData) return true;
  const t = conn?.effectiveType;
  return t === 'slow-2g' || t === '2g';
}

function warmHeavyAppChunksDeferred(): void {
  if (heavyWarmed || typeof window === 'undefined') return;
  if (connectionSaveData()) return;
  heavyWarmed = true;

  // Tabs only — never AR / RecordingStudio / ensureArStack here.
  preloadAll([
    () => import('../components/wallet/WalletScreen'),
    () => import('../pages/YouTube'),
  ]);
}

/** Entire app — hot tabs only; live/karaoke/AR load on navigation or explicit intent. */
export function warmEntireAppChunks(): void {
  if (entireWarmed || typeof window === 'undefined') return;
  entireWarmed = true;

  warmCoreScreenChunks();
  preloadAll([
    () => import('../components/search/SearchScreen'),
    () => import('../components/feed/StoryRing'),
  ]);

  scheduleIdle(() => {
    void import('./preloadAppSurfaces').then((m) => {
      m.preloadCoreAppSurfaces();
    });
  }, 2_000);

  // Optional light warm much later — never Live/Karaoke/AR.
  scheduleIdle(warmHeavyAppChunksDeferred, 60_000);
}

/**
 * Call once at app boot (after first paint).
 * With cached session: preload hot surfaces immediately; defer AR/live/heavy stacks.
 */
export function startInstantUiBoot(): void {
  if (started || typeof window === 'undefined') return;
  started = true;

  // Hot tabs only at boot — full preload waits for shell ready.
  warmCoreScreenChunks();

  if (hasInstantSessionCache()) {
    onAppShellReady(() => {
      warmEntireAppChunks();
    });
  }
}

export { hasInstantSessionCache } from './instantCachePolicy';
