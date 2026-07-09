/**
 * Instant UI boot — preload hot surfaces first; defer heavy stacks so taps stay instant.
 */
import { preloadInstant } from './instantTask';
import { hasInstantSessionCache } from './instantCachePolicy';
import { onAppShellReady } from './appShellReady';

let started = false;
let entireWarmed = false;
let heavyWarmed = false;

/** Every primary tab lazy chunk in App.tsx */
const ALL_TAB_IMPORTS: Array<() => Promise<unknown>> = [
  () => import('../components/messages/MessagesScreen'),
  () => import('../components/notifications/NotificationsScreen'),
  () => import('../components/search/SearchScreen'),
  () => import('../components/reels/ReelsScreen'),
  () => import('../components/profile/ProfileScreen'),
  () => import('../components/live/LiveScreen'),
  () => import('../components/karaoke/KaraokeScreen'),
  () => import('../smule-rooms/RoomsHost'),
  () => import('../components/games/LocalGamesScreen'),
  () => import('../components/games/ThirdPartyGamesScreen'),
  () => import('../pages/YouTube'),
  () => import('../components/wallet/WalletScreen'),
  () => import('../components/workspace/WorkspaceGate'),
  () => import('../components/dating/DatingScreen'),
];

/** Hot-path tabs — messages, feed, reels, notifications. */
const HOT_TAB_IMPORTS: Array<() => Promise<unknown>> = [
  () => import('../components/messages/MessagesScreen'),
  () => import('../components/notifications/NotificationsScreen'),
  () => import('../components/reels/ReelsScreen'),
  () => import('../components/profile/ProfileScreen'),
];

/** Overlays, launch/auth, and global hosts */
const ALL_OVERLAY_IMPORTS: Array<() => Promise<unknown>> = [
  () => import('../components/launch/LaunchFlowHost'),
  () => import('../components/profile/UserProfilePreview'),
  () => import('../components/feed/StoryRing'),
  () => import('../components/youtube/YoutubeMiniPlayerHost'),
  () => import('../components/auth/SplashScreen'),
  () => import('../components/auth/AuthScreen'),
  () => import('../components/auth/ProfileSetup'),
  () => import('../contexts/ChatCallContext'),
  () => import('../contexts/ChatCallVideoEffectsHost'),
  () => import('../components/messages/MessagesActiveCallOverlay'),
  () => import('../components/messages/ChatCallPipWindow'),
];

/** Smule-rooms sub-routes (RoomsHost is lazy; pages are eager but warm route CSS/logic). */
const SMULE_ROOM_IMPORTS: Array<() => Promise<unknown>> = [
  () => import('../smule-rooms/pages/Party'),
  () => import('../smule-rooms/pages/Room'),
  () => import('../smule-rooms/pages/EditRoom'),
  () => import('../smule-rooms/pages/RoomDetails'),
  () => import('../smule-rooms/pages/CreateRoom'),
];

/** Shell modals and heavy feature stacks */
const HEAVY_SURFACE_IMPORTS: Array<() => Promise<unknown>> = [
  () => import('../components/layout/ShellCreateModal'),
  () => import('../components/profile/AccountSwitcherModal'),
  () => import('../components/profile/ProfileEditSettingsModal'),
  () => import('../components/karaoke/RecordingStudio'),
  () => import('../components/feed/PostModal'),
  () => import('../components/messages/ChatFileInAppViewer'),
  () => import('./ar/ensureArStack'),
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

/** Chat / video call + AR surfaces — only when a call is likely. */
export function warmCallSurfaceChunks(): void {
  preloadAll([
    () => import('../contexts/ChatCallVideoEffectsHost'),
    () => import('../components/messages/MessagesActiveCallOverlay'),
    () => import('../components/messages/ChatCallPipWindow'),
  ]);
}

function warmHeavyAppChunksDeferred(): void {
  if (heavyWarmed || typeof window === 'undefined') return;
  heavyWarmed = true;

  preloadAll(ALL_TAB_IMPORTS.filter(
    (factory) => !HOT_TAB_IMPORTS.includes(factory),
  ));
  preloadAll(ALL_OVERLAY_IMPORTS);
  preloadAll(SMULE_ROOM_IMPORTS);
  preloadAll(HEAVY_SURFACE_IMPORTS);

  void import('./preloadAppSurfaces').then((m) => {
    m.preloadHeavyAppSurfaces();
  });
}

/** Entire app — hot tabs first; heavy stacks idle-deferred. */
export function warmEntireAppChunks(): void {
  if (entireWarmed || typeof window === 'undefined') return;
  entireWarmed = true;

  warmCoreScreenChunks();
  preloadAll([
    () => import('../components/search/SearchScreen'),
    () => import('../components/feed/StoryRing'),
    () => import('../contexts/ChatCallContext'),
  ]);

  scheduleIdle(() => {
    warmCallSurfaceChunks();
    void import('./preloadAppSurfaces').then((m) => {
      m.preloadCoreAppSurfaces();
    });
  }, 2500);

  scheduleIdle(warmHeavyAppChunksDeferred, 5000);
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
