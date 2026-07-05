/**
 * Sync localStorage session hint — available before IndexedDB hydrates.
 * Enables cache-first UI: show main shell instantly, then live cloud sync.
 */
import type { User } from '../types';
import { safeLocalStorage } from './utils';

const HINT_KEY = 'ic_session_cache_v1';

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
  } catch {
    /* quota / private mode */
  }
}

export function clearSessionCache(): void {
  if (!canUseStorage()) return;
  try {
    safeLocalStorage.removeItem(HINT_KEY);
  } catch {
    /* ignore */
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
