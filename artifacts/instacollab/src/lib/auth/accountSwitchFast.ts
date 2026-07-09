import type { User } from 'firebase/auth';
import { withTimeout } from '../networkPolicy';
import { db } from '../db/localDb';
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
import { getFirebaseAuth } from '../firebase/app';
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
      saveStoredAccountSessionMirrored(session.user.id, session);
      if (outgoingAppId && outgoingAppId !== session.user.id) {
        saveStoredAccountSessionMirrored(outgoingAppId, session);
      }
      upsertDeviceAccount(accountFromSupabaseUser(session.user));
    }
  }

  const fbUser = getFirebaseAuth()?.currentUser;
  if (fbUser) {
    upsertDeviceAccount(accountFromFirebaseUser(fbUser));
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

  if (cached) {
    writeActiveDeviceUid(appUserId);
    db.syncAuthUser(cached);
  } else {
    writeActiveDeviceUid(deviceUid);
  }

  const account =
    readDeviceAccounts().find((row) => row.uid === deviceUid) ??
    readDeviceAccounts().find((row) => row.uid === appUserId) ??
    null;

  return { appUserId, deviceUid, account };
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
