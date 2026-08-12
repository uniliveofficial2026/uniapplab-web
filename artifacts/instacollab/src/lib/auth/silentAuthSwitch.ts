import { db } from '../db/localDb';
import { readFirebaseBackupLink } from './firebaseBackupLink';
import { isSupabaseAuthUserId } from './activeBackend';
import { isSupabaseOAuthDegraded } from './providerState';

/** True when local app session must stay put during provider lane changes. */
export function shouldKeepLocalSessionDuringAuthSwitch(): boolean {
  return shouldIgnoreSupabaseSignedOut();
}

/** Ignore Supabase SIGNED_OUT while Firebase OAuth backup lane holds the same user. */
export function shouldIgnoreSupabaseSignedOut(): boolean {
  if (!db.isLoggedIn || !db.currentUserId) return false;
  const userId = db.currentUserId;
  if (!isSupabaseAuthUserId(userId)) return false;

  const link = readFirebaseBackupLink();
  if (link?.supabaseUserId === userId) return true;

  // Live Auth.currentUser requires Firebase SDK — only gate on session link + degraded flag.
  if (isSupabaseOAuthDegraded() && link?.supabaseUserId === userId) {
    return true;
  }

  return false;
}
