import type { AuthSdkUser } from './authSdkUser';
import { db } from '../db/localDb';
import { isSupabaseConfigured } from '../supabase/config';
import { readDeviceAccounts } from './deviceAccounts';
import { identityAliasUids } from './accountIdentity';
import { isSupabaseAuthUserId } from './activeBackend';
import { hasStoredAccountSession } from './storedAccountSessions';

const BACKUP_LINK_KEY = 'instacollab_firebase_backup_link';

export type FirebaseBackupLink = {
  firebaseUid: string;
  supabaseUserId: string;
  email: string;
  linkedAt: string;
};

export function normalizeAuthEmail(email: string | null | undefined): string | null {
  const normalized = email?.trim().toLowerCase();
  if (!normalized || !normalized.includes('@')) return null;
  return normalized;
}

function readLocalProfileEmail(uid: string): string | null {
  if (typeof localStorage === 'undefined' || !uid) return null;
  try {
    const raw = localStorage.getItem(`local_profile_${uid}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return normalizeAuthEmail(typeof parsed.email === 'string' ? parsed.email : null);
  } catch {
    return null;
  }
}

function parseBackupLink(raw: string | null): FirebaseBackupLink | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as FirebaseBackupLink;
    if (
      !parsed?.firebaseUid ||
      !parsed?.supabaseUserId ||
      !isSupabaseAuthUserId(parsed.supabaseUserId)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** Find an existing Supabase account on this device by email — never creates a new id. */
export function findSupabaseUserIdByEmail(email: string | null | undefined): string | null {
  const normalized = normalizeAuthEmail(email);
  if (!normalized) return null;

  for (const account of readDeviceAccounts()) {
    if (
      isSupabaseAuthUserId(account.uid) &&
      normalizeAuthEmail(account.email) === normalized
    ) {
      return account.uid;
    }
  }

  for (const user of db.users) {
    if (!isSupabaseAuthUserId(user.id)) continue;
    const profileEmail = readLocalProfileEmail(user.id);
    if (profileEmail === normalized) return user.id;
  }

  for (const user of db.users) {
    if (!isSupabaseAuthUserId(user.id)) continue;
    const account = readDeviceAccounts().find((row) => row.uid === user.id);
    if (normalizeAuthEmail(account?.email) === normalized) return user.id;
  }

  const storedLink = readFirebaseBackupLink();
  if (
    storedLink &&
    normalizeAuthEmail(storedLink.email) === normalized &&
    isSupabaseAuthUserId(storedLink.supabaseUserId)
  ) {
    return storedLink.supabaseUserId;
  }

  return null;
}

export function saveFirebaseBackupLink(link: Omit<FirebaseBackupLink, 'linkedAt'>): void {
  const payload: FirebaseBackupLink = {
    ...link,
    linkedAt: new Date().toISOString(),
  };
  const raw = JSON.stringify(payload);
  try {
    sessionStorage?.setItem(BACKUP_LINK_KEY, raw);
  } catch {
    /* private mode */
  }
  // Persist across tabs / reloads so Firebase↔Supabase stay one account.
  try {
    localStorage?.setItem(BACKUP_LINK_KEY, raw);
  } catch {
    /* private mode / quota */
  }
}

export function readFirebaseBackupLink(): FirebaseBackupLink | null {
  try {
    const fromSession = parseBackupLink(sessionStorage?.getItem(BACKUP_LINK_KEY) ?? null);
    if (fromSession) return fromSession;
  } catch {
    /* ignore */
  }
  try {
    const fromLocal = parseBackupLink(localStorage?.getItem(BACKUP_LINK_KEY) ?? null);
    if (fromLocal) {
      // Rehydrate session for this tab.
      try {
        sessionStorage?.setItem(BACKUP_LINK_KEY, JSON.stringify(fromLocal));
      } catch {
        /* ignore */
      }
      return fromLocal;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function clearFirebaseBackupLink(): void {
  try {
    sessionStorage?.removeItem(BACKUP_LINK_KEY);
  } catch {
    /* ignore */
  }
  try {
    localStorage?.removeItem(BACKUP_LINK_KEY);
  } catch {
    /* ignore */
  }
}

/** Map Firebase OAuth user → existing Supabase UUID when this device already knows that account. */
export function resolveLinkedSupabaseUserId(firebaseUser: AuthSdkUser): string | null {
  const link = readFirebaseBackupLink();
  if (link?.firebaseUid === firebaseUser.uid && isSupabaseAuthUserId(link.supabaseUserId)) {
    return link.supabaseUserId;
  }
  return findSupabaseUserIdByEmail(firebaseUser.email);
}

export function getLinkedSupabaseUserIdForFirebase(firebaseUid: string): string | null {
  const link = readFirebaseBackupLink();
  if (link?.firebaseUid === firebaseUid && isSupabaseAuthUserId(link.supabaseUserId)) {
    return link.supabaseUserId;
  }
  return null;
}

export function getLinkedFirebaseUidForSupabase(supabaseUserId: string): string | null {
  const link = readFirebaseBackupLink();
  if (link?.supabaseUserId === supabaseUserId) return link.firebaseUid;
  return null;
}

/**
 * All auth-lane document ids that count as "this account" for uniqueness + dual writes.
 * Supabase UUID and linked Firebase uid share one public User ID.
 */
export function identityOwnerIds(userId: string): string[] {
  const id = userId.trim();
  if (!id) return [];

  const owners = new Set<string>([id]);
  const link = readFirebaseBackupLink();
  if (
    link &&
    (link.supabaseUserId === id || link.firebaseUid === id)
  ) {
    owners.add(link.firebaseUid);
    owners.add(link.supabaseUserId);
  }

  try {
    for (const alias of identityAliasUids(id, readDeviceAccounts())) {
      if (alias.trim()) owners.add(alias.trim());
    }
  } catch {
    /* device accounts unavailable */
  }

  return [...owners];
}

/** True when signed in via Firebase OAuth but app identity must stay on Supabase data. */
export function isFirebaseBackupSessionActive(supabaseUserId: string): boolean {
  if (!isSupabaseConfigured() || !isSupabaseAuthUserId(supabaseUserId)) return false;
  const link = readFirebaseBackupLink();
  return link?.supabaseUserId === supabaseUserId;
}

/**
 * Mirror profile into Firestore only under a Firebase-auth doc id.
 * Never create a second Firestore identity for a Supabase UUID without an auth claim.
 */
export function shouldMirrorProfileToFirebase(userId: string): boolean {
  if (isSupabaseAuthUserId(userId)) return false;
  return true;
}

/** Firestore doc id for this account's Firebase lane (firebase uid when linked). */
export function firebaseProfileDocIdForUser(userId: string): string | null {
  const link = readFirebaseBackupLink();
  if (link?.supabaseUserId === userId) return link.firebaseUid;
  if (link?.firebaseUid === userId) return link.firebaseUid;
  if (!isSupabaseAuthUserId(userId)) return userId;
  return null;
}

export function hasKnownSupabaseAccountOnDevice(email: string | null | undefined): boolean {
  const uid = findSupabaseUserIdByEmail(email);
  return Boolean(uid && (hasStoredAccountSession(uid) || db.users.some((user) => user.id === uid)));
}
