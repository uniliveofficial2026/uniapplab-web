import type { User } from '../../types';
import {
  normalizePublicUserId,
  resolvePublicUserId,
} from '../publicUserId';
import { isSupabaseAuthUserId } from './activeBackend';
import {
  collapseLinkedDeviceAccounts,
  identityAliasUids,
} from './accountIdentity';
import {
  filterEligibleDeviceAccounts,
  readDeviceAccounts,
  writeDeviceAccounts,
  type StoredDeviceAccount,
} from './deviceAccounts';
import { safeLocalStorage } from '../utils';

/** Bump to force every client to re-run a full purge pass. */
const CLEANUP_FLAG = 'instacollab_identity_purge_v2';

export type LocalIdentityCleanupResult = {
  removedUsers: number;
  remappedUsers: number;
  collapsedDeviceAccounts: number;
  clearedLocalProfiles: number;
  clearedSessions: number;
};

function rankUserForIdentityKeep(user: User, currentUserId: string | null): number {
  let score = 0;
  if (currentUserId && user.id === currentUserId) score += 1000;
  if (isSupabaseAuthUserId(user.id)) score += 100;
  if (user.publicUserId?.trim()) score += 10;
  if (user.username?.trim()) score += 1;
  return score;
}

/** All identity keys an account claims (public User ID + username). */
function identityKeysForUser(user: User): string[] {
  const keys = new Set<string>();
  const pub = resolvePublicUserId(user);
  const username = normalizePublicUserId(user.username || '');
  if (pub) keys.add(pub);
  if (username) keys.add(username);
  return [...keys];
}

function clearStoredSessionKeys(uid: string): number {
  let cleared = 0;
  const prefixes = ['supabase_account_session_', 'google_access_token_', 'local_profile_'];
  for (const prefix of prefixes) {
    const key = `${prefix}${uid}`;
    if (safeLocalStorage.getItem(key)) {
      safeLocalStorage.removeItem(key);
      cleared += 1;
    }
  }
  return cleared;
}

/**
 * Security purge: one public User ID → exactly one local account row.
 * Duplicate identity claimants are REMOVED (not kept as remapped ghosts).
 * Distinct accounts with different IDs are preserved until the user deletes them.
 */
export function pruneLocalDuplicatePublicUserIds(input: {
  users: User[];
  currentUserId?: string | null;
  saveUsers: (users: User[]) => void;
  deleteAccountSnapshot?: (userId: string) => void;
}): LocalIdentityCleanupResult {
  const currentUserId = input.currentUserId ?? null;
  const users = [...(input.users ?? [])].filter((u) => u?.id);

  // Build identity → claimants map (public id AND username keys).
  const claimants = new Map<string, Set<string>>();
  const byId = new Map(users.map((u) => [u.id, u]));

  for (const user of users) {
    for (const key of identityKeysForUser(user)) {
      const set = claimants.get(key) ?? new Set<string>();
      set.add(user.id);
      claimants.set(key, set);
    }
  }

  const removeIds = new Set<string>();

  for (const [, ids] of claimants) {
    if (ids.size <= 1) continue;
    const ranked = [...ids]
      .map((id) => byId.get(id)!)
      .filter(Boolean)
      .sort(
        (a, b) =>
          rankUserForIdentityKeep(b, currentUserId) - rankUserForIdentityKeep(a, currentUserId),
      );
    const keeper = ranked[0];
    if (!keeper) continue;
    for (const loser of ranked.slice(1)) {
      // Never delete the signed-in account — remap it instead only if somehow not keeper
      if (loser.id === currentUserId) continue;
      removeIds.add(loser.id);
    }
  }

  // If current user somehow shares identity with others and lost ranking, force-keep current
  // and remove everyone else claiming those keys.
  if (currentUserId && byId.has(currentUserId)) {
    const me = byId.get(currentUserId)!;
    for (const key of identityKeysForUser(me)) {
      for (const otherId of claimants.get(key) ?? []) {
        if (otherId !== currentUserId) removeIds.add(otherId);
      }
    }
  }

  let clearedSessions = 0;
  let clearedLocalProfiles = 0;

  for (const id of removeIds) {
    clearedSessions += clearStoredSessionKeys(id);
    input.deleteAccountSnapshot?.(id);
  }

  const keptUsers = users.filter((u) => !removeIds.has(u.id));
  const removedUsers = users.length - keptUsers.length;

  // Second pass: if current user is absent from keep set somehow, restore them.
  if (currentUserId && byId.has(currentUserId) && !keptUsers.some((u) => u.id === currentUserId)) {
    keptUsers.push(byId.get(currentUserId)!);
  }

  if (removedUsers > 0 || keptUsers.length !== users.length) {
    input.saveUsers(keptUsers);
  }

  // Device accounts: collapse auth lanes, drop rows for purged users.
  const beforeAccounts = readDeviceAccounts();
  const collapsed = collapseLinkedDeviceAccounts(beforeAccounts).filter(
    (row) => !removeIds.has(row.uid),
  );
  const eligible = filterEligibleDeviceAccounts(collapsed);
  writeDeviceAccounts(eligible);
  const collapsedDeviceAccounts = Math.max(0, beforeAccounts.length - eligible.length);

  // Purge orphan local_profile_* / session keys for alias lanes and removed accounts.
  for (const account of beforeAccounts) {
    const aliases = identityAliasUids(account.uid, beforeAccounts);
    const stillKept = eligible.some((row) => aliases.includes(row.uid));
    if (!stillKept) {
      for (const alias of aliases) {
        clearedSessions += clearStoredSessionKeys(alias);
      }
      continue;
    }
    const canonical = eligible.find((row) => aliases.includes(row.uid))?.uid;
    if (!canonical) continue;
    for (const alias of aliases) {
      if (alias === canonical) continue;
      const key = `local_profile_${alias}`;
      if (safeLocalStorage.getItem(key)) {
        safeLocalStorage.removeItem(key);
        clearedLocalProfiles += 1;
      }
    }
  }

  // Sweep any leftover local_profile_* not belonging to kept users / device accounts.
  try {
    const keepUids = new Set([
      ...keptUsers.map((u) => u.id),
      ...eligible.map((a) => a.uid),
      ...(currentUserId ? [currentUserId] : []),
    ]);
    const keysToScan: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key) keysToScan.push(key);
    }
    for (const key of keysToScan) {
      const match = /^local_profile_(.+)$/.exec(key);
      if (!match) continue;
      const uid = match[1];
      if (!keepUids.has(uid)) {
        localStorage.removeItem(key);
        clearedLocalProfiles += 1;
      }
    }
  } catch {
    /* private mode */
  }

  return {
    removedUsers,
    remappedUsers: 0,
    collapsedDeviceAccounts,
    clearedLocalProfiles,
    clearedSessions,
  };
}

export function markIdentityCleanupDone(): void {
  safeLocalStorage.setItem(CLEANUP_FLAG, '1');
}

export function resetIdentityCleanupFlag(): void {
  safeLocalStorage.removeItem(CLEANUP_FLAG);
  // Also clear prior v1 flag so old clients don't skip.
  safeLocalStorage.removeItem('instacollab_identity_dedupe_v1');
}

/**
 * Full local security purge — always runs (idempotent).
 */
export function runLocalIdentitySecurityCleanup(dbLike: {
  users: User[];
  currentUserId?: string | null;
  save: (key: 'users', value: User[]) => void;
  deleteAccountSnapshot?: (userId: string) => void;
  whenStorageReady?: () => Promise<unknown>;
}): Promise<LocalIdentityCleanupResult> {
  // Always reset so every boot/session re-sweeps until store is clean.
  resetIdentityCleanupFlag();

  const execute = () => {
    const result = pruneLocalDuplicatePublicUserIds({
      users: dbLike.users ?? [],
      currentUserId: dbLike.currentUserId ?? null,
      saveUsers: (users) => dbLike.save('users', users),
      deleteAccountSnapshot: dbLike.deleteAccountSnapshot,
    });
    markIdentityCleanupDone();
    return result;
  };

  if (typeof dbLike.whenStorageReady === 'function') {
    return dbLike
      .whenStorageReady()
      .then(() => execute())
      .catch(() => execute());
  }
  return Promise.resolve(execute());
}

/** @internal */
export function __deviceAccountCollapseForTests(
  accounts: StoredDeviceAccount[],
): StoredDeviceAccount[] {
  return collapseLinkedDeviceAccounts(accounts);
}
