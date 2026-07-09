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

  if (prefer === 'firebase' || !isSupabaseConfigured()) {
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
