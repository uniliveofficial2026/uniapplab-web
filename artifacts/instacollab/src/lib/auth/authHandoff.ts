import { withTimeout, NET_AUTH_MS } from '../networkPolicy';
import { db } from '../db/localDb';
import { authSignOut } from './authService';
import { flushCloudAppStateSync } from './cloudAppState';
import { flushCloudProfileSync } from './cloudProfile';
import { clearActiveDeviceUid, clearGoogleAccessToken } from './deviceAccounts';
import { clearStoredAccountSession } from './storedAccountSessions';
import { teardownCloudSession } from './sessionManager';
import { clearSessionCache } from '../sessionCache';

/** Max wait for cloud flush before switch/logout — UX must not hang on slow networks. */
const AUTH_HANDOFF_FLUSH_MS = 800;

/** Best-effort push of profile + app state; capped so handoff stays snappy. */
export async function flushAuthHandoff(): Promise<void> {
  await Promise.allSettled([
    withTimeout(flushCloudAppStateSync(), AUTH_HANDOFF_FLUSH_MS, 'flush app state'),
    withTimeout(flushCloudProfileSync(), AUTH_HANDOFF_FLUSH_MS, 'flush profile'),
  ]);
}

/** Fire-and-forget flush — use when local session already moved on. */
export function flushAuthHandoffInBackground(): void {
  void flushAuthHandoff().catch(() => undefined);
}

/** Clear local session + realtime listeners immediately (no network). */
export function finalizeLocalAuthSession(): void {
  clearActiveDeviceUid();
  teardownCloudSession();
  db.logout();
}

/** Finish Supabase/Firebase sign-out without blocking UI. */
export function runProviderSignOutInBackground(): void {
  void withTimeout(authSignOut(), NET_AUTH_MS, 'authSignOut').catch((err) => {
    console.warn('[auth] signOut failed:', err);
  });
}

export type FastSignOutOptions = {
  /** Remove saved per-account tokens for this uid (full logout). */
  clearStoredSession?: boolean;
  userId?: string | null;
};

/**
 * Complete device logout: wipe local session/cache pin, stored tokens, Google token,
 * then sign out Supabase + Firebase in the background.
 */
export function signOutFast(options: FastSignOutOptions = {}): void {
  const uid = options.userId ?? db.currentUserId;
  if (options.clearStoredSession && uid) {
    clearStoredAccountSession(uid);
    clearGoogleAccessToken(uid);
  }
  clearSessionCache();
  finalizeLocalAuthSession();
  flushAuthHandoffInBackground();
  runProviderSignOutInBackground();
}
