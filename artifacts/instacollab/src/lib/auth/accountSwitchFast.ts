import type { User } from 'firebase/auth';
import { withTimeout } from '../networkPolicy';
import { db } from '../db/localDb';
import { persistLaunchFunnelAfterAuth } from '../splashSession';
import { getSupabaseClient } from '../supabase/client';
import {
  accountFromAppUser,
  accountFromFirebaseUser,
  accountFromSupabaseUser,
  readDeviceAccounts,
  upsertDeviceAccount,
  writeActiveDeviceUid,
  type StoredDeviceAccount,
} from './deviceAccounts';
import { canonicalDeviceAccountUid } from './accountIdentity';
import { getFirebaseAuth } from '../firebase/app';
import { rebindPushDeviceToPerson } from '../push/pushDeviceLifecycle';
import {
  resolveAppUserIdForDeviceAccount,
  saveStoredAccountSessionMirrored,
  sessionLookupUids,
} from './storedAccountSessions';

const SESSION_SNAPSHOT_MS = 450;

/** Save the active provider session tokens before switching away (fast, capped). */
export async function persistOutgoingAccountSessionFast(): Promise<void> {
  const outgoingAppId = db.currentUserId;
  const supabase = getSupabaseClient();

  if (supabase) {
    const { data } = await withTimeout(
      supabase.auth.getSession(),
      SESSION_SNAPSHOT_MS,
      'Supabase getSession',
    ).catch(() => ({ data: { session: null as import('@supabase/supabase-js').Session | null } }));

    const session = data.session;
    if (session?.user?.id && session.refresh_token) {
      // Only store under this session's identity aliases — never under an unrelated
      // currentUserId (that caused account B to restore account A's tokens).
      saveStoredAccountSessionMirrored(session.user.id, session);
      upsertDeviceAccount(accountFromSupabaseUser(session.user));
    }
  }

  const fbUser = getFirebaseAuth()?.currentUser;
  if (fbUser) {
    const accounts = readDeviceAccounts();
    const fromFirebase = accountFromFirebaseUser(fbUser);
    // Collapse onto Supabase uuid when this Firebase lane is the same person.
    const uid = canonicalDeviceAccountUid(fromFirebase.uid, [...accounts, fromFirebase]);
    upsertDeviceAccount({ ...fromFirebase, uid }, accounts);
  } else if (outgoingAppId && db.currentUser) {
    upsertDeviceAccount(
      accountFromAppUser({
        ...db.currentUser,
        email: db.currentUser.email,
      }),
    );
  }
}

export type InstantAccountSwitchResult = {
  appUserId: string;
  deviceUid: string;
  account: StoredDeviceAccount | null;
};

/** Paint the target account from local cache — no network. */
export function applyInstantAccountSwitch(deviceUid: string): InstantAccountSwitchResult {
  const appUserId = resolveAppUserIdForDeviceAccount(deviceUid);
  const cached =
    db.users.find((user) => user.id === appUserId) ??
    db.users.find((user) => user.id === deviceUid) ??
    null;

  writeActiveDeviceUid(appUserId || deviceUid);
  rebindPushDeviceToPerson(appUserId || deviceUid);

  if (cached) {
    // Prefer canonical app id so local snapshots / cloud sync stay on one key.
    db.syncAuthUser({ ...cached, id: appUserId || cached.id });
  } else if (appUserId && appUserId !== deviceUid) {
    db.login(appUserId);
  } else {
    db.login(deviceUid);
  }
  persistLaunchFunnelAfterAuth();

  const accounts = readDeviceAccounts();
  const account =
    accounts.find((row) => row.uid === appUserId) ??
    accounts.find((row) => row.uid === deviceUid) ??
    null;

  return { appUserId: appUserId || deviceUid, deviceUid, account };
}

export function firebaseUserFromDeviceAccount(
  account: StoredDeviceAccount | null,
  appUserId: string,
): User | null {
  if (!account) return null;
  return {
    uid: account.uid || appUserId,
    displayName: account.displayName,
    email: account.email,
    photoURL: account.photoURL,
  } as User;
}

/** Uids to try when restoring a saved refresh token for this device row. */
export function restoreLookupUids(deviceUid: string): string[] {
  return sessionLookupUids(deviceUid);
}
