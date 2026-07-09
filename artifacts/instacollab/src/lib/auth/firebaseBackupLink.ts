import type { User as FirebaseUser } from 'firebase/auth';
import { db } from '../db/localDb';
import { getFirebaseAuth } from '../firebase/app';
import { isSupabaseConfigured } from '../supabase/config';
import { readDeviceAccounts } from './deviceAccounts';
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
  if (typeof sessionStorage === 'undefined') return;
  const payload: FirebaseBackupLink = {
    ...link,
    linkedAt: new Date().toISOString(),
  };
  try {
    sessionStorage.setItem(BACKUP_LINK_KEY, JSON.stringify(payload));
  } catch {
    /* private mode */
  }
}

export function readFirebaseBackupLink(): FirebaseBackupLink | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(BACKUP_LINK_KEY);
    if (!raw) return null;
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

export function clearFirebaseBackupLink(): void {
  try {
    sessionStorage?.removeItem(BACKUP_LINK_KEY);
  } catch {
    /* ignore */
  }
}

/** Map Firebase OAuth user → existing Supabase UUID when this device already knows that account. */
export function resolveLinkedSupabaseUserId(firebaseUser: FirebaseUser): string | null {
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

/** True when signed in via Firebase OAuth but app identity must stay on Supabase data. */
export function isFirebaseBackupSessionActive(supabaseUserId: string): boolean {
  if (!isSupabaseConfigured() || !isSupabaseAuthUserId(supabaseUserId)) return false;
  const auth = getFirebaseAuth();
  const fbUser = auth?.currentUser;
  if (!fbUser) return false;
  const linked = resolveLinkedSupabaseUserId(fbUser);
  return linked === supabaseUserId;
}

/** Never mirror Supabase UUID rows into Firestore — prevents split accounts / data loss. */
export function shouldMirrorProfileToFirebase(userId: string): boolean {
  if (isSupabaseAuthUserId(userId)) return false;
  return true;
}

export function hasKnownSupabaseAccountOnDevice(email: string | null | undefined): boolean {
  const uid = findSupabaseUserIdByEmail(email);
  return Boolean(uid && (hasStoredAccountSession(uid) || db.users.some((user) => user.id === uid)));
}
