import { db } from '../db/localDb';
import { isSupabaseConfigured } from '../supabase/config';
import { applySupabaseSessionToLocalDb, restoreSupabaseSession } from './sessionManager';
import { isFirebaseConfigured } from '../firebase/config';
import { withTimeout } from '../supabase/withTimeout';
import { writeStoredAuthBackend } from './providerState';
import { applyFirebaseOAuthSessionToLocalDb } from './applyFirebaseBackupSession';

const STORAGE_READY_MS = 30_000;

async function waitForLocalStorage(): Promise<void> {
  try {
    await withTimeout(db.whenStorageReady(), STORAGE_READY_MS, 'Local storage');
    return;
  } catch {
    if (db.hasStorageBackend()) return;
    await withTimeout(db.whenReady(), STORAGE_READY_MS, 'Local database');
  }
}

/** Apply the active cloud session into local db (call right after sign-in / sign-up). */
export async function syncCloudSessionNow(): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    await waitForLocalStorage();
  } catch {
    return { ok: false, reason: 'Local storage is still loading. Try again in a moment.' };
  }

  if (isSupabaseConfigured()) {
    try {
      const session = await restoreSupabaseSession();
      if (session?.user) {
        await applySupabaseSessionToLocalDb(session);
        writeStoredAuthBackend('supabase');
        return { ok: true };
      }
    } catch (err) {
      console.warn('[auth] syncCloudSessionNow Supabase failed:', err);
    }
  }

  if (isFirebaseConfigured()) {
    const { getFirebaseAuth } = await import('../firebase/app');
    const auth = getFirebaseAuth();
    const user = auth?.currentUser;
    if (user) {
      const silent = db.isLoggedIn;
      await applyFirebaseOAuthSessionToLocalDb(user, { silent });
      return { ok: true };
    }
  }

  return {
    ok: false,
    reason: 'Signed in with the provider, but this device did not load your session. Refresh the page.',
  };
}
