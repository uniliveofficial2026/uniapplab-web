import { completeSupabaseOAuthReturn, type SupabaseOAuthReturnResult } from './completeSupabaseOAuthReturn';

let inFlight: Promise<SupabaseOAuthReturnResult> | null = null;

/** Single-flight Supabase OAuth return handling (AuthScreen + CloudAuthContext). */
export function completeSupabaseOAuthReturnOnce(): Promise<SupabaseOAuthReturnResult> {
  if (!inFlight) {
    inFlight = completeSupabaseOAuthReturn().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}
