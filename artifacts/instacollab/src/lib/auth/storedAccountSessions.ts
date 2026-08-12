import type { Session } from '@supabase/supabase-js';
import { safeLocalStorage } from '../utils';
import { db } from '../db/localDb';
import { canonicalDeviceAccountUid, identityAliasUids } from './accountIdentity';
import { readDeviceAccounts } from './deviceAccounts';
import { getLinkedSupabaseUserIdForFirebase, readFirebaseBackupLink } from './firebaseBackupLink';
import { isSupabaseAuthUserId } from './activeBackend';

const SESSION_PREFIX = 'supabase_account_session_';

export type StoredAccountSession = {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
};

/** Session lookup aliases for one logical account (Firebase lane ↔ Supabase uuid). */
function aliasUidsForSession(uid: string): string[] {
  const id = uid.trim();
  if (!id) return [];
  const accounts = readDeviceAccounts();
  const aliases = new Set<string>(identityAliasUids(id, accounts));
  const link = readFirebaseBackupLink();
  if (link?.firebaseUid === id) aliases.add(link.supabaseUserId);
  if (link?.supabaseUserId === id) aliases.add(link.firebaseUid);
  const linkedSupabase = getLinkedSupabaseUserIdForFirebase(id);
  if (linkedSupabase) aliases.add(linkedSupabase);
  return [...aliases];
}

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

/** Persist refresh tokens under every uid alias (Firebase ↔ Supabase link). */
export function saveStoredAccountSessionMirrored(uid: string, session: Session): void {
  for (const alias of aliasUidsForSession(uid)) {
    saveStoredAccountSession(alias, session);
  }
}

export function loadStoredAccountSession(uid: string): StoredAccountSession | null {
  for (const alias of aliasUidsForSession(uid)) {
    const raw = safeLocalStorage.getItem(`${SESSION_PREFIX}${alias.trim()}`);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as StoredAccountSession;
      if (parsed?.access_token && parsed?.refresh_token) return parsed;
    } catch {
      /* try next alias */
    }
  }
  return null;
}

export function hasStoredAccountSession(uid: string): boolean {
  return loadStoredAccountSession(uid) !== null;
}

export function clearStoredAccountSession(uid: string): void {
  for (const alias of aliasUidsForSession(uid)) {
    safeLocalStorage.removeItem(`${SESSION_PREFIX}${alias.trim()}`);
  }
}

/** Resolve the app user row id for a device-account uid (Firebase vs Supabase). */
export function resolveAppUserIdForDeviceAccount(deviceUid: string): string {
  const id = deviceUid.trim();
  if (!id) return id;

  const linkedSupabase = getLinkedSupabaseUserIdForFirebase(id);
  if (linkedSupabase) return linkedSupabase;

  const link = readFirebaseBackupLink();
  if (link?.firebaseUid === id) return link.supabaseUserId;

  const accounts = readDeviceAccounts();
  const canonical = canonicalDeviceAccountUid(id, accounts);
  if (canonical !== id) return canonical;

  if (db.users.some((user) => user.id === id)) return id;
  return id;
}

/** True when this device already knows the account — switch without OTP / re-login prompts. */
export function canSwitchAccountInstantly(deviceUid: string): boolean {
  const id = deviceUid.trim();
  if (!id) return false;
  if (hasStoredAccountSession(id)) return true;
  const appUserId = resolveAppUserIdForDeviceAccount(id);
  if (db.users.some((user) => user.id === appUserId || user.id === id)) return true;
  if (readDeviceAccounts().some((row) => row.uid === id)) return true;
  return false;
}

export function sessionLookupUids(deviceUid: string): string[] {
  const appId = resolveAppUserIdForDeviceAccount(deviceUid);
  return [...new Set([...aliasUidsForSession(deviceUid), ...aliasUidsForSession(appId)])];
}

/** @internal tests */
export function isSupabaseUuid(userId: string): boolean {
  return isSupabaseAuthUserId(userId);
}
