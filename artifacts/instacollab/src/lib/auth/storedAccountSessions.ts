import type { Session } from '@supabase/supabase-js';
import { safeLocalStorage } from '../utils';

const SESSION_PREFIX = 'supabase_account_session_';

export type StoredAccountSession = {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
};

export function saveStoredAccountSession(uid: string, session: Session): void {
  const id = uid?.trim();
  if (!id || !session.access_token || !session.refresh_token) return;
  const payload: StoredAccountSession = {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at ?? undefined,
  };
  safeLocalStorage.setItem(`${SESSION_PREFIX}${id}`, JSON.stringify(payload));
}

export function loadStoredAccountSession(uid: string): StoredAccountSession | null {
  const raw = safeLocalStorage.getItem(`${SESSION_PREFIX}${uid.trim()}`);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredAccountSession;
    if (parsed?.access_token && parsed?.refresh_token) return parsed;
  } catch {
    /* ignore */
  }
  return null;
}

export function hasStoredAccountSession(uid: string): boolean {
  return loadStoredAccountSession(uid) !== null;
}

export function clearStoredAccountSession(uid: string): void {
  safeLocalStorage.removeItem(`${SESSION_PREFIX}${uid.trim()}`);
}
