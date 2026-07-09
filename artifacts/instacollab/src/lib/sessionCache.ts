/**
 * Sync localStorage session hint — available before IndexedDB hydrates.
 * Enables cache-first UI: show main shell instantly, then live cloud sync.
 */
import type { User } from '../types';
import { safeLocalStorage } from './utils';

const HINT_KEY = 'ic_session_cache_v1';
/** Set after first successful login — next web visit / PWA open warms entire app UI. */
const UI_CACHE_READY_KEY = 'ic_app_ui_cache_ready_v1';

export type SessionCacheHint = {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  profileSetupComplete: boolean;
  at: number;
};

function canUseStorage(): boolean {
  return typeof window !== 'undefined';
}

export function readSessionCache(): SessionCacheHint | null {
  if (!canUseStorage()) return null;
  try {
    const raw = safeLocalStorage.getItem(HINT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionCacheHint;
    if (!parsed?.userId || typeof parsed.userId !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeSessionCache(
  user: Pick<User, 'id' | 'username' | 'displayName' | 'avatarUrl'>,
  options?: { profileSetupComplete?: boolean },
): void {
  if (!canUseStorage() || !user?.id) return;
  const hint: SessionCacheHint = {
    userId: user.id,
    username: user.username || 'user',
    displayName: user.displayName || 'User',
    avatarUrl: user.avatarUrl || '',
    profileSetupComplete: options?.profileSetupComplete ?? true,
    at: Date.now(),
  };
  try {
    safeLocalStorage.setItem(HINT_KEY, JSON.stringify(hint));
    markAppUiCacheReady();
  } catch {
    /* quota / private mode */
  }
}

export function clearSessionCache(): void {
  if (!canUseStorage()) return;
  try {
    safeLocalStorage.removeItem(HINT_KEY);
    safeLocalStorage.removeItem(UI_CACHE_READY_KEY);
  } catch {
    /* ignore */
  }
}

/** Mark that full app UI has been cached locally (survives reinstall / revisit). */
export function markAppUiCacheReady(): void {
  if (!canUseStorage()) return;
  try {
    safeLocalStorage.setItem(UI_CACHE_READY_KEY, String(Date.now()));
  } catch {
    /* quota */
  }
}

export function isAppUiCacheReady(): boolean {
  if (!canUseStorage()) return false;
  try {
    return Boolean(safeLocalStorage.getItem(UI_CACHE_READY_KEY));
  } catch {
    return false;
  }
}

/** Minimal User for Shell before IDB is ready. */
export function sessionCacheToUser(hint: SessionCacheHint): User {
  return {
    id: hint.userId,
    username: hint.username || 'user',
    displayName: hint.displayName || 'User',
    avatarUrl: hint.avatarUrl || '',
    bio: '',
    followers: 0,
    following: 0,
  };
}

/** Sync session hint from localStorage login mirror (before IDB opens). */
export function syncSessionCacheFromLoginMirror(cache: {
  isLoggedIn?: unknown;
  currentUserId?: unknown;
  users?: unknown;
  launch_progress?: unknown;
}): void {
  if (cache.isLoggedIn !== true) return;
  const userId = cache.currentUserId;
  if (typeof userId !== 'string' || !userId) return;
  const existing = readSessionCache();
  if (existing?.userId === userId) return;

  const users = Array.isArray(cache.users)
    ? (cache.users as Array<{
        id?: string;
        username?: string;
        displayName?: string;
        avatarUrl?: string;
      }>)
    : [];
  const me = users.find((u) => u?.id === userId);
  if (!me?.id) return;

  const progress = cache.launch_progress as { profileSetupComplete?: boolean } | undefined;
  writeSessionCache(
    {
      id: me.id,
      username: me.username || 'user',
      displayName: me.displayName || 'User',
      avatarUrl: me.avatarUrl || '',
    },
    { profileSetupComplete: progress?.profileSetupComplete ?? true },
  );
}
