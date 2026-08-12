import { isSupabaseAuthUserId } from './activeBackend';

/** Minimal device-account row used for identity collapse (avoids import cycles). */
export type DeviceAccountIdentityRow = {
  uid: string;
  displayName?: string | null;
  email?: string | null;
  photoURL?: string | null;
  linkedAt?: string;
};

const BACKUP_LINK_KEY = 'instacollab_firebase_backup_link';

type BackupLink = {
  firebaseUid: string;
  supabaseUserId: string;
};

function parseBackupLink(raw: string | null): BackupLink | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as BackupLink;
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

function readBackupLink(): BackupLink | null {
  try {
    const fromSession = parseBackupLink(sessionStorage?.getItem(BACKUP_LINK_KEY) ?? null);
    if (fromSession) return fromSession;
  } catch {
    /* ignore */
  }
  try {
    return parseBackupLink(localStorage?.getItem(BACKUP_LINK_KEY) ?? null);
  } catch {
    return null;
  }
}

function normalizeEmail(email: string | null | undefined): string | null {
  const normalized = email?.trim().toLowerCase();
  if (!normalized || !normalized.includes('@')) return null;
  return normalized;
}

function preferText(
  primary: string | null | undefined,
  fallback: string | null | undefined,
): string | null {
  const a = primary?.trim();
  if (a) return a;
  const b = fallback?.trim();
  return b || null;
}

function earlierIso(
  a: string | null | undefined,
  b: string | null | undefined,
): string | undefined {
  if (!a) return b || undefined;
  if (!b) return a;
  return a <= b ? a : b;
}

/**
 * One login identity → one device-account uid.
 * Prefer Supabase UUID when Firebase is only a backup lane for the same email.
 * Distinct accounts (different emails / different Supabase UUIDs) stay separate.
 */
export function canonicalDeviceAccountUid(
  uid: string,
  accounts: DeviceAccountIdentityRow[],
): string {
  const id = uid.trim();
  if (!id) return id;

  const link = readBackupLink();
  if (link?.firebaseUid === id) return link.supabaseUserId;
  if (link?.supabaseUserId === id) return link.supabaseUserId;

  if (isSupabaseAuthUserId(id)) return id;

  const email = normalizeEmail(accounts.find((row) => row.uid === id)?.email);
  if (email) {
    const supabasePeer = accounts.find(
      (row) => isSupabaseAuthUserId(row.uid) && normalizeEmail(row.email) === email,
    );
    if (supabasePeer) return supabasePeer.uid;
  }

  return id;
}

/** All auth-lane uids that belong to the same logical account as `uid`. */
export function identityAliasUids(
  uid: string,
  accounts: DeviceAccountIdentityRow[],
): string[] {
  const id = uid.trim();
  if (!id) return [];

  const canonical = canonicalDeviceAccountUid(id, accounts);
  const aliases = new Set<string>([id, canonical]);

  const link = readBackupLink();
  if (
    link &&
    (link.supabaseUserId === canonical ||
      link.firebaseUid === id ||
      link.supabaseUserId === id ||
      link.firebaseUid === canonical)
  ) {
    aliases.add(link.firebaseUid);
    aliases.add(link.supabaseUserId);
  }

  const email = normalizeEmail(
    accounts.find((row) => row.uid === id || row.uid === canonical)?.email,
  );
  if (email) {
    for (const row of accounts) {
      if (normalizeEmail(row.email) !== email) continue;
      // Same email + non-Supabase lane collapses onto the Supabase uuid.
      // Never merge two different Supabase uuids — those are separate accounts.
      if (!isSupabaseAuthUserId(row.uid) || row.uid === canonical) {
        aliases.add(row.uid);
      }
    }
  }

  return [...aliases];
}

/**
 * Collapse Firebase↔Supabase auth lanes into one switcher row per person.
 * Does not merge distinct accounts; those remain until the user deletes them.
 */
export function collapseLinkedDeviceAccounts<T extends DeviceAccountIdentityRow>(
  accounts: T[],
): T[] {
  const byCanonical = new Map<string, T>();
  const order: string[] = [];

  for (const account of accounts) {
    if (!account?.uid?.trim()) continue;
    const canonical = canonicalDeviceAccountUid(account.uid, accounts);
    const existing = byCanonical.get(canonical);
    if (existing) {
      byCanonical.set(canonical, {
        ...existing,
        ...account,
        uid: canonical,
        displayName: preferText(existing.displayName, account.displayName),
        email: preferText(existing.email, account.email),
        photoURL: preferText(existing.photoURL, account.photoURL),
        linkedAt: earlierIso(existing.linkedAt, account.linkedAt),
      });
      continue;
    }
    byCanonical.set(canonical, { ...account, uid: canonical });
    order.push(canonical);
  }

  return order.map((id) => byCanonical.get(id)!);
}
