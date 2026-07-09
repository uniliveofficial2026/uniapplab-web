import {
  clearSupabaseOAuthDegraded,
  isSupabaseOAuthDegraded,
  markSupabaseOAuthDegraded,
} from './providerState';
import {
  invalidateSupabaseHealthCache,
  probeSupabaseAuthReady,
  probeSupabaseDataReady,
  probeSupabaseHealth,
  probeSupabaseOAuthReady,
} from './health';
import { isSupabaseConfigured } from '../supabase/config';
import { isFirebaseConfigured } from '../firebase/config';
import { isNetworkOnline } from '../networkStatus';

const RECOVER_TICK_MS = 20_000;
const HEALTH_PROBE_MS = 1500;
const DATA_PROBE_MS = 1500;
const OAUTH_PROBE_MS = 2000;

let installed = false;
let recoverInFlight = false;

async function evaluateSupabaseCloudLane(): Promise<void> {
  if (!isSupabaseConfigured() || !isNetworkOnline()) return;
  if (!isFirebaseConfigured()) return;

  invalidateSupabaseHealthCache();

  const healthOk = await probeSupabaseHealth(HEALTH_PROBE_MS);
  if (!healthOk) {
    markSupabaseOAuthDegraded();
    return;
  }

  const dataOk = await probeSupabaseDataReady(DATA_PROBE_MS);
  if (!dataOk) {
    markSupabaseOAuthDegraded();
    return;
  }

  const oauthOk = await probeSupabaseOAuthReady(OAUTH_PROBE_MS);
  if (oauthOk) {
    clearSupabaseOAuthDegraded();
    return;
  }

  markSupabaseOAuthDegraded();
}

async function tryRecoverSupabaseOAuth(): Promise<void> {
  if (recoverInFlight) return;
  recoverInFlight = true;
  try {
    await evaluateSupabaseCloudLane();
  } finally {
    recoverInFlight = false;
  }
}

/** Background lane probe — marks Firebase as silent fallback when Supabase is down. */
export function initSupabaseResilience(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  void tryRecoverSupabaseOAuth();

  window.setInterval(() => {
    void tryRecoverSupabaseOAuth();
  }, RECOVER_TICK_MS);

  window.addEventListener('online', () => {
    void tryRecoverSupabaseOAuth();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      void tryRecoverSupabaseOAuth();
    }
  });
}

export async function refreshSupabaseOAuthLane(): Promise<boolean> {
  await evaluateSupabaseCloudLane();
  return !isSupabaseOAuthDegraded();
}

/** @deprecated use refreshSupabaseOAuthLane */
export const refreshSupabaseAuthReady = refreshSupabaseOAuthLane;
