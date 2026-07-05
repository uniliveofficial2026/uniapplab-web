import { completeSupabaseOAuthReturn, type SupabaseOAuthReturnResult } from './completeSupabaseOAuthReturn';
import { getFirebaseAuth } from '../firebase/app';
import { completeFirebaseOAuthRedirect } from '../firebase/oauth';
import type { AuthResult } from './types';

let inFlight: Promise<SupabaseOAuthReturnResult> | null = null;
let firebaseInFlight: Promise<AuthResult | null> | null = null;

/** Single-flight Supabase OAuth return handling (AuthScreen + CloudAuthContext). */
export function completeSupabaseOAuthReturnOnce(): Promise<SupabaseOAuthReturnResult> {
  if (!inFlight) {
    inFlight = completeSupabaseOAuthReturn().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

/** Single-flight Firebase OAuth redirect completion (backup lane). */
export function completeFirebaseOAuthRedirectOnce(): Promise<AuthResult | null> {
  if (!firebaseInFlight) {
    firebaseInFlight = (async () => {
      const auth = getFirebaseAuth();
      if (!auth) return null;
      return completeFirebaseOAuthRedirect(auth);
    })().finally(() => {
      firebaseInFlight = null;
    });
  }
  return firebaseInFlight;
}
