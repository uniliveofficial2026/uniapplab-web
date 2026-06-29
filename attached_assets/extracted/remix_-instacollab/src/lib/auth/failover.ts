import type { AuthResult } from './types';
import {
  clearSupabaseUnhealthy,
  markSupabaseUnhealthy,
  resolveInitialAuthBackend,
  writeStoredAuthBackend,
} from './providerState';
import { isFirebaseConfigured } from '../firebase/config';
import { isSupabaseConfigured } from '../supabase/config';

const INFRA_PATTERNS =
  /not configured|network|fetch|timeout|failed to fetch|service unavailable|503|502|504|econnrefused|health/i;

export function isInfrastructureAuthFailure(reason: string): boolean {
  return INFRA_PATTERNS.test(reason);
}

export function getActiveAuthBackendForRequest(): 'supabase' | 'firebase' {
  return resolveInitialAuthBackend();
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
      clearSupabaseUnhealthy();
      writeStoredAuthBackend('supabase');
    }
    return only;
  }

  const primary = await runSupabase();
  if (primary.ok) {
    clearSupabaseUnhealthy();
    writeStoredAuthBackend('supabase');
    return primary;
  }

  if (failOnCredential && !isInfrastructureAuthFailure(primary.reason)) {
    return primary;
  }

  markSupabaseUnhealthy();
  writeStoredAuthBackend('firebase');
  return runFirebase();
}
