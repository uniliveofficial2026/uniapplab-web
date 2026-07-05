/**
 * When Supabase recovers from an outage, restore the primary lane silently —
 * no sign-out, no navigation, no banners. User stays on the current screen.
 */
import { db } from '../db/localDb';
import { getSupabaseClient } from '../supabase/client';
import { isSupabaseConfigured } from '../supabase/config';
import { isFirebaseConfigured } from '../firebase/config';
import { fetchFirebaseUserAppState } from '../firebase/userAppState';
import { fetchSupabaseUserAppState, upsertSupabaseUserAppState } from '../supabase/userAppState';
import {
  applySupabaseSessionToLocalDb,
  restoreSupabaseSession,
} from './sessionManager';
import { isSupabaseAuthUserId } from './activeBackend';
import { restartCloudAppStateSync } from './cloudAppState';
import { writeStoredAuthBackend, markSupabaseOAuthHealthyLane } from './providerState';
import { readFirebaseBackupLink } from './firebaseBackupLink';
import { loadStoredAccountSession } from './storedAccountSessions';
import { withTimeout } from '../supabase/withTimeout';
import { migrateFirebaseNewcomerToSupabase } from './migrateFirebaseNewcomer';
import { getFirebaseAuth } from '../firebase/app';
import { startLiveCloudSurfaces } from '../liveCloudSurfaces';
import { syncCloudChatInbox } from '../chat/cloudChatSync';

const RECOVERY_MS = 8_000;
let recoveryInFlight = false;

async function mergeFirebaseAppStateIntoSupabase(userId: string): Promise<void> {
  if (!isFirebaseConfigured() || !isSupabaseAuthUserId(userId)) return;

  const [firebasePayload, supabasePayload] = await Promise.all([
    fetchFirebaseUserAppState(userId).catch(() => null),
    fetchSupabaseUserAppState(userId).catch(() => null),
  ]);

  if (!firebasePayload) return;

  const firebaseAt = firebasePayload.updatedAt ?? 0;
  const supabaseAt = supabasePayload?.updatedAt ?? 0;
  if (firebaseAt <= supabaseAt) return;

  try {
    await upsertSupabaseUserAppState(userId, firebasePayload);
  } catch (err) {
    console.warn('[auth] silent recovery app_state merge failed:', err);
  }
}

/** Restore Supabase session + cloud lane for the signed-in user (no UI side effects). */
export async function performSilentSupabaseRecovery(): Promise<boolean> {
  if (!isSupabaseConfigured() || !db.isLoggedIn || !db.currentUserId) return false;
  if (recoveryInFlight) return false;

  recoveryInFlight = true;
  try {
    const userId = db.currentUserId;
    const supabase = getSupabaseClient();
    if (!supabase) return false;

    let session = await withTimeout(
      restoreSupabaseSession(),
      RECOVERY_MS,
      'Supabase getSession',
    ).catch(() => null);

    if ((!session?.user || session.user.id !== userId) && isSupabaseAuthUserId(userId)) {
      const stored = loadStoredAccountSession(userId);
      if (stored) {
        await withTimeout(
          supabase.auth.setSession({
            access_token: stored.access_token,
            refresh_token: stored.refresh_token,
          }),
          RECOVERY_MS,
          'Supabase setSession',
        ).catch(() => undefined);
        session = await restoreSupabaseSession().catch(() => null);
      }
    }

    const link = readFirebaseBackupLink();
    const sessionUserId = session?.user?.id;
    const matchesCurrent =
      sessionUserId === userId ||
      (link?.supabaseUserId === userId && sessionUserId === link.supabaseUserId);

    if (!session?.user || !matchesCurrent) {
      if (!isSupabaseAuthUserId(userId)) {
        const fbUid = getFirebaseAuth()?.currentUser?.uid;
        if (fbUid === userId) {
          return migrateFirebaseNewcomerToSupabase(fbUid);
        }
      }
      return false;
    }

    const silent = db.isLoggedIn && db.currentUserId === session.user.id;
    await applySupabaseSessionToLocalDb(session, { silent });
    writeStoredAuthBackend('supabase');
    markSupabaseOAuthHealthyLane();

    await mergeFirebaseAppStateIntoSupabase(session.user.id);
    await restartCloudAppStateSync(session.user.id);
    startLiveCloudSurfaces(session.user.id);
    void syncCloudChatInbox();

    if (import.meta.env.DEV) {
      console.info('[auth] silent Supabase recovery complete', session.user.id.slice(0, 8));
    }
    return true;
  } catch (err) {
    console.warn('[auth] silent Supabase recovery failed:', err);
    return false;
  } finally {
    recoveryInFlight = false;
  }
}
