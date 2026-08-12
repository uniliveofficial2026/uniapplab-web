import type { AuthResult } from './types';
import {
  clearSupabaseOAuthDegraded,
  markSupabaseOAuthDegraded,
  resolveOAuthSignInBackend,
  writeStoredAuthBackend,
} from './providerState';
import { isFirebaseConfigured } from '../firebase/config';
import { isSupabaseConfigured } from '../supabase/config';

const INFRA_PATTERNS =
  /not configured|network|fetch|timeout|timed out|failed to fetch|service unavailable|522|524|503|502|504|econnrefused|health|unavailable|connection/i;

export function isInfrastructureAuthFailure(reason: string): boolean {
  return INFRA_PATTERNS.test(reason);
}

export function getActiveAuthBackendForRequest(): 'supabase' | 'firebase' {
  return resolveOAuthSignInBackend();
}

export async function withSupabaseFirebaseFailover<T extends AuthResult>(
  runSupabase: () => Promise<T>,
  runFirebase: () => Promise<T>,
  options?: { failOnCredentialError?: boolean }
): Promise<T> {
  const failOnCredential = options?.failOnCredentialError !== false;
  const prefer = getActiveAuthBackendForRequest();

  // Even when OAuth is marked degraded, still attempt Supabase first when we refuse
  // to hide credential/config errors (Google). Firebase-first only for infra failover.
  if ((prefer === 'firebase' || !isSupabaseConfigured()) && !failOnCredential) {
    if (!isFirebaseConfigured()) return runSupabase();
    const fb = await runFirebase();
    if (fb.ok) writeStoredAuthBackend('firebase');
    return fb;
  }

  if (!isFirebaseConfigured()) {
    const only = await runSupabase();
    if (only.ok) {
      clearSupabaseOAuthDegraded();
      writeStoredAuthBackend('supabase');
    }
    return only;
  }

  if (!isSupabaseConfigured()) {
    return runFirebase();
  }

  const primary = await runSupabase();
  if (primary.ok) {
    clearSupabaseOAuthDegraded();
    writeStoredAuthBackend('supabase');
    return primary;
  }

  if (failOnCredential && !isInfrastructureAuthFailure(primary.reason)) {
    return primary;
  }

  markSupabaseOAuthDegraded();
  writeStoredAuthBackend('firebase');
  return runFirebase();
}
