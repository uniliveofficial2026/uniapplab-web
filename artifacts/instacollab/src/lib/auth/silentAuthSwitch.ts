import { db } from '../db/localDb';
import { getFirebaseAuth } from '../firebase/app';
import {
  getLinkedSupabaseUserIdForFirebase,
  readFirebaseBackupLink,
} from './firebaseBackupLink';
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

  const fbUser = getFirebaseAuth()?.currentUser;
  if (fbUser && getLinkedSupabaseUserIdForFirebase(fbUser.uid) === userId) {
    return true;
  }

  if (isSupabaseOAuthDegraded() && fbUser) {
    return true;
  }

  return false;
}
