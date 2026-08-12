/**
 * Canonical user data flow (1 account → 1 auth id → 1 profile → 1 public User ID).
 *
 * ```
 * Auth session (Supabase UUID preferred; Firebase uid only when no Supabase)
 *   → applySupabaseSessionToLocalDb / applyFirebaseOAuthSessionToLocalDb
 *   → syncAuthUser (local paint only)
 *   → ensureProfileFromSession (create stub row if missing; does not finalize User ID)
 *
 * Profile setup / settings / edit
 *   → commitUserProfile (THIS MODULE)
 *       1. validate public User ID when changing it (except linked Firebase+Supabase owners)
 *       2. db.updateUser (local source of truth)
 *       3. syncDeviceAccountForAppUser (one switcher row)
 *       4. pushCloudProfile once → primary backend + mirror other lane
 * ```
 *
 * Never write profiles via ad-hoc Firestore/Supabase upserts from UI screens.
 */
import type { User } from '../../types';
import { db } from '../db/localDb';
import { isCloudAuthConfigured } from './config';
import {
  flushCloudProfileSync,
  isCloudAuthUserId,
  scheduleCloudProfileSync,
} from './cloudProfile';
import { syncDeviceAccountForAppUser } from './deviceAccounts';
import { ensurePublicUserIdFree } from '../../hooks/usePublicUserIdAvailability';
import { resolvePublicUserId } from '../publicUserId';

export type CommitUserProfileOptions = {
  /** Mark launch profile setup complete after a successful write. */
  profileSetupComplete?: boolean;
  /** Skip cloud push (local-only / offline paint). */
  localOnly?: boolean;
  /** Email for device-account enrichment. */
  email?: string | null;
  /**
   * When true, re-check User ID availability even if unchanged
   * (use on first setup claim).
   */
  enforceUniquePublicUserId?: boolean;
};

export type CommitUserProfileResult =
  | { ok: true; user: User }
  | { ok: false; reason: string };

function mergeUser(base: User, patch: Partial<User>): User {
  return {
    ...base,
    ...patch,
    id: base.id,
  };
}

/**
 * Single write path for profile fields the user controls.
 * Local store is updated first; cloud is pushed once.
 */
export async function commitUserProfile(
  userId: string,
  patch: Partial<User>,
  options: CommitUserProfileOptions = {},
): Promise<CommitUserProfileResult> {
  const existing = db.users.find((u) => u.id === userId);
  if (!existing) {
    return { ok: false, reason: 'Account not found on this device.' };
  }

  const next = mergeUser(existing, patch);
  const prevPublic = resolvePublicUserId(existing);
  const nextPublic = resolvePublicUserId(next);
  const publicIdChanging = prevPublic !== nextPublic;

  if ((options.enforceUniquePublicUserId || publicIdChanging) && nextPublic) {
    const gate = await ensurePublicUserIdFree({
      draft: nextPublic,
      exceptUserId: userId,
      localUsers: db.users,
    });
    if (!gate.ok) return { ok: false, reason: gate.reason };
    next.publicUserId = gate.value;
    if (publicIdChanging || !next.publicUserIdChangedAt) {
      next.publicUserIdChangedAt = Date.now();
    }
  }

  // Local source of truth (also schedules a debounced cloud sync when profile fields change).
  db.updateUser(userId, () => next);

  syncDeviceAccountForAppUser({
    ...next,
    email: options.email ?? next.email,
  });

  if (options.profileSetupComplete) {
    db.completeProfileSetup({ legalAgreementAccepted: true });
  }

  if (!options.localOnly && isCloudAuthConfigured() && isCloudAuthUserId(userId)) {
    // Replace any pending debounced sync with the final payload + setup flag, then flush once.
    scheduleCloudProfileSync(next, {
      profileSetupComplete:
        options.profileSetupComplete ?? db.getLaunchProgress().profileSetupComplete,
    });
    try {
      await flushCloudProfileSync();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not sync profile';
      return { ok: false, reason: message };
    }
  }

  const saved = db.users.find((u) => u.id === userId) ?? next;
  return { ok: true, user: saved };
}

/** Session paint only — never invents a final public User ID. */
export function paintSessionUser(user: User, email?: string | null): void {
  db.syncAuthUser(user);
  if (isCloudAuthConfigured() && isCloudAuthUserId(user.id)) {
    syncDeviceAccountForAppUser({
      ...user,
      email: email ?? user.email,
    });
  }
}
