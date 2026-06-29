import type { User as FirebaseUser } from 'firebase/auth';
import { safeLocalStorage } from '../utils';

export type StoredDeviceAccount = {
  uid: string;
  displayName?: string | null;
  email?: string | null;
  photoURL?: string | null;
  linkedAt?: string;
};

export const DEVICE_ACCOUNTS_KEY = 'user_accounts';
export const DEVICE_ACTIVE_UID_KEY = 'local_active_uid';
const GOOGLE_TOKEN_PREFIX = 'google_access_token_';
const MAX_DEVICE_ACCOUNTS = 5;

function dedupeAccounts(list: StoredDeviceAccount[]): StoredDeviceAccount[] {
  return list.filter(
    (item, idx, self) =>
      item?.uid && self.findIndex((t) => t.uid === item.uid) === idx
  );
}

export function readDeviceAccounts(): StoredDeviceAccount[] {
  const saved = safeLocalStorage.getItem(DEVICE_ACCOUNTS_KEY);
  if (!saved) return [];
  try {
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];
    return dedupeAccounts(parsed);
  } catch {
    return [];
  }
}

export function writeDeviceAccounts(accounts: StoredDeviceAccount[]): void {
  const unique = dedupeAccounts(accounts).slice(-MAX_DEVICE_ACCOUNTS);
  safeLocalStorage.setItem(DEVICE_ACCOUNTS_KEY, JSON.stringify(unique));
}

export function upsertDeviceAccount(
  account: StoredDeviceAccount,
  existing: StoredDeviceAccount[] = readDeviceAccounts()
): StoredDeviceAccount[] {
  const linkedAt = account.linkedAt ?? new Date().toISOString();
  const nextEntry = { ...account, linkedAt };
  const has = existing.some((a) => a.uid === account.uid);
  const next = has
    ? existing.map((a) => (a.uid === account.uid ? { ...a, ...nextEntry } : a))
    : [...existing, nextEntry];
  const unique = dedupeAccounts(next).slice(-MAX_DEVICE_ACCOUNTS);
  writeDeviceAccounts(unique);
  return unique;
}

export function removeDeviceAccount(
  uid: string,
  existing: StoredDeviceAccount[] = readDeviceAccounts()
): StoredDeviceAccount[] {
  const next = existing.filter((a) => a.uid !== uid);
  writeDeviceAccounts(next);
  safeLocalStorage.removeItem(`${GOOGLE_TOKEN_PREFIX}${uid}`);
  safeLocalStorage.removeItem(`local_profile_${uid}`);
  return next;
}

export function readActiveDeviceUid(): string | null {
  return safeLocalStorage.getItem(DEVICE_ACTIVE_UID_KEY);
}

export function writeActiveDeviceUid(uid: string): void {
  safeLocalStorage.setItem(DEVICE_ACTIVE_UID_KEY, uid);
}

export function clearActiveDeviceUid(): void {
  safeLocalStorage.removeItem(DEVICE_ACTIVE_UID_KEY);
}

export function saveGoogleAccessToken(uid: string, token: string): void {
  safeLocalStorage.setItem(`${GOOGLE_TOKEN_PREFIX}${uid}`, token);
}

export function loadGoogleAccessToken(uid: string): string | null {
  return safeLocalStorage.getItem(`${GOOGLE_TOKEN_PREFIX}${uid}`);
}

export function clearGoogleAccessToken(uid?: string): void {
  if (uid) {
    safeLocalStorage.removeItem(`${GOOGLE_TOKEN_PREFIX}${uid}`);
    return;
  }
  readDeviceAccounts().forEach((acc) => {
    safeLocalStorage.removeItem(`${GOOGLE_TOKEN_PREFIX}${acc.uid}`);
  });
}

export function accountFromFirebaseUser(user: FirebaseUser): StoredDeviceAccount {
  return {
    uid: user.uid,
    displayName: user.displayName,
    email: user.email,
    photoURL: user.photoURL,
  };
}

export function accountFromAppUser(user: {
  id: string;
  displayName?: string;
  username?: string;
  avatarUrl?: string;
  email?: string;
}): StoredDeviceAccount {
  return {
    uid: user.id,
    displayName: user.displayName || user.username || 'User',
    email: user.email ?? null,
    photoURL: user.avatarUrl ?? null,
  };
}

/** Persist the active app user into the on-device account list (Supabase / demo / Firebase). */
export function syncDeviceAccountForAppUser(user: {
  id: string;
  displayName?: string;
  username?: string;
  avatarUrl?: string;
  email?: string;
}): StoredDeviceAccount[] {
  writeActiveDeviceUid(user.id);
  return upsertDeviceAccount(accountFromAppUser(user));
}
