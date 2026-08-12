import type { User as SupabaseUser } from '@supabase/supabase-js';
import type { AuthSdkUser } from './authSdkUser';
import { safeLocalStorage } from '../utils';
import {
  canonicalDeviceAccountUid,
  collapseLinkedDeviceAccounts,
  identityAliasUids,
} from './accountIdentity';
import { isCloudAuthConfigured } from './config';
import { isCloudAuthUserId } from './cloudProfile';

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
/** Soft cap — never auto-evict old accounts; user must delete. */
export const MAX_DEVICE_ACCOUNTS = 20;

function dedupeAccounts(list: StoredDeviceAccount[]): StoredDeviceAccount[] {
  return list.filter(
    (item, idx, self) =>
      item?.uid && self.findIndex((t) => t.uid === item.uid) === idx
  );
}

function normalizeDeviceAccounts(list: StoredDeviceAccount[]): StoredDeviceAccount[] {
  return collapseLinkedDeviceAccounts(dedupeAccounts(list));
}

export function isDeviceAccountEligible(account: StoredDeviceAccount): boolean {
  if (!account?.uid?.trim()) return false;
  if (isCloudAuthConfigured()) {
    return isCloudAuthUserId(account.uid);
  }
  return true;
}

export function filterEligibleDeviceAccounts(
  accounts: StoredDeviceAccount[] = readDeviceAccounts(),
): StoredDeviceAccount[] {
  return normalizeDeviceAccounts(accounts).filter(isDeviceAccountEligible);
}

/** Drop demo/local ids (u1, u2, …) from the switcher when cloud auth is enabled. */
export function pruneIneligibleDeviceAccounts(): StoredDeviceAccount[] {
  const kept = filterEligibleDeviceAccounts();
  writeDeviceAccounts(kept);
  return kept;
}

export function readDeviceAccounts(): StoredDeviceAccount[] {
  const saved = safeLocalStorage.getItem(DEVICE_ACCOUNTS_KEY);
  if (!saved) return [];
  try {
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];
    return normalizeDeviceAccounts(parsed);
  } catch {
    return [];
  }
}

function notifyDeviceAccountsChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('device-accounts-changed'));
}

export function writeDeviceAccounts(accounts: StoredDeviceAccount[]): void {
  // Keep every distinct account until the user deletes it — never slice off older rows.
  const unique = normalizeDeviceAccounts(accounts);
  safeLocalStorage.setItem(DEVICE_ACCOUNTS_KEY, JSON.stringify(unique));
  notifyDeviceAccountsChanged();
}

export function upsertDeviceAccount(
  account: StoredDeviceAccount,
  existing: StoredDeviceAccount[] = readDeviceAccounts()
): StoredDeviceAccount[] {
  const withCandidate = [...existing, account];
  const canonicalUid = canonicalDeviceAccountUid(account.uid, withCandidate);
  const linkedAt = account.linkedAt ?? new Date().toISOString();
  const nextEntry: StoredDeviceAccount = {
    ...account,
    uid: canonicalUid,
    linkedAt,
  };

  const aliases = new Set(identityAliasUids(canonicalUid, withCandidate));
  const withoutAliases = existing.filter(
    (row) => !aliases.has(row.uid) || row.uid === canonicalUid,
  );
  const has = withoutAliases.some((row) => row.uid === canonicalUid);

  if (!has && withoutAliases.length >= MAX_DEVICE_ACCOUNTS) {
    // Soft cap: refuse adding a brand-new identity; never delete older accounts.
    const collapsed = normalizeDeviceAccounts(withoutAliases);
    writeDeviceAccounts(collapsed);
    return collapsed;
  }

  const next = has
    ? withoutAliases.map((row) =>
        row.uid === canonicalUid ? { ...row, ...nextEntry } : row,
      )
    : [...withoutAliases, nextEntry];
  writeDeviceAccounts(next);
  return readDeviceAccounts();
}

export function removeDeviceAccount(
  uid: string,
  existing: StoredDeviceAccount[] = readDeviceAccounts()
): StoredDeviceAccount[] {
  const aliases = new Set(identityAliasUids(uid, existing));
  const next = existing.filter((row) => !aliases.has(row.uid));
  writeDeviceAccounts(next);
  for (const alias of aliases) {
    safeLocalStorage.removeItem(`${GOOGLE_TOKEN_PREFIX}${alias}`);
    safeLocalStorage.removeItem(`local_profile_${alias}`);
  }
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

export function accountFromSupabaseUser(user: SupabaseUser): StoredDeviceAccount {
  const meta = (user.user_metadata || {}) as Record<string, unknown>;
  const displayName =
    (typeof meta.display_name === 'string' && meta.display_name) ||
    (typeof meta.full_name === 'string' && meta.full_name) ||
    (typeof meta.name === 'string' && meta.name) ||
    user.email?.split('@')[0] ||
    'User';
  const photoURL =
    (typeof meta.avatar_url === 'string' && meta.avatar_url) ||
    (typeof meta.picture === 'string' && meta.picture) ||
    null;
  return {
    uid: user.id,
    displayName,
    email: user.email,
    photoURL,
  };
}

export function accountFromFirebaseUser(user: AuthSdkUser): StoredDeviceAccount {
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

function readLocalProfileSnapshot(uid: string): {
  displayName?: string;
  username?: string;
  avatarUrl?: string;
  email?: string;
} | null {
  if (typeof localStorage === 'undefined' || !uid) return null;
  try {
    const raw = localStorage.getItem(`local_profile_${uid}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      displayName:
        typeof parsed.displayName === 'string' ? parsed.displayName : undefined,
      username: typeof parsed.username === 'string' ? parsed.username : undefined,
      avatarUrl: typeof parsed.avatarUrl === 'string' ? parsed.avatarUrl : undefined,
      email: typeof parsed.email === 'string' ? parsed.email : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Merge device-account rows with live app users + local profile snapshots
 * so the switcher shows current names/avatars, not stale cached metadata.
 */
export function enrichDeviceAccountsForDisplay(
  accounts: StoredDeviceAccount[],
  liveUsers: Array<{
    id: string;
    displayName?: string;
    username?: string;
    avatarUrl?: string;
    email?: string;
  }> = [],
): StoredDeviceAccount[] {
  const byId = new Map(liveUsers.map((user) => [user.id, user]));
  return normalizeDeviceAccounts(accounts).map((account) => {
    const live =
      byId.get(account.uid) ||
      byId.get(canonicalDeviceAccountUid(account.uid, accounts));
    const snapshot =
      readLocalProfileSnapshot(account.uid) ||
      readLocalProfileSnapshot(canonicalDeviceAccountUid(account.uid, accounts));
    const displayName =
      live?.displayName ||
      live?.username ||
      snapshot?.displayName ||
      snapshot?.username ||
      account.displayName ||
      'User';
    const photoURL =
      live?.avatarUrl || snapshot?.avatarUrl || account.photoURL || null;
    const email = live?.email || snapshot?.email || account.email || null;
    if (
      displayName === account.displayName &&
      photoURL === account.photoURL &&
      email === account.email
    ) {
      return account;
    }
    return {
      ...account,
      displayName,
      photoURL,
      email,
    };
  });
}

/** Persist the active app user into the on-device account list (cloud accounts only when configured). */
export function syncDeviceAccountForAppUser(user: {
  id: string;
  displayName?: string;
  username?: string;
  avatarUrl?: string;
  email?: string;
}): StoredDeviceAccount[] {
  if (isCloudAuthConfigured() && !isCloudAuthUserId(user.id)) {
    return filterEligibleDeviceAccounts();
  }
  const existing = readDeviceAccounts();
  const account = accountFromAppUser(user);
  const canonicalUid = canonicalDeviceAccountUid(account.uid, [...existing, account]);
  writeActiveDeviceUid(canonicalUid);
  return upsertDeviceAccount({ ...account, uid: canonicalUid }, existing);
}
