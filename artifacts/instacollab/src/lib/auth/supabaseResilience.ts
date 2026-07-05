import {
  clearSupabaseOAuthHealthyLane,
  isSupabaseOAuthDegraded,
  markSupabaseOAuthDegraded,
  markSupabaseOAuthHealthyLane,
} from './providerState';
import { performSilentSupabaseRecovery } from './silentSupabaseRecovery';
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

async function evaluateSupabaseCloudLane(options?: { coldStart?: boolean }): Promise<void> {
  if (!isSupabaseConfigured() || !isNetworkOnline()) return;
  if (!isFirebaseConfigured()) return;

  invalidateSupabaseHealthCache();

  const oauthMs = options?.coldStart ? 2500 : OAUTH_PROBE_MS;
  const healthMs = options?.coldStart ? 1200 : HEALTH_PROBE_MS;
  const dataMs = options?.coldStart ? 1200 : DATA_PROBE_MS;

  // OAuth /authorize is the real gate — health alone can be 401 while authorize 522s.
  const [healthOk, dataOk, oauthOk] = await Promise.all([
    probeSupabaseHealth(healthMs),
    probeSupabaseDataReady(dataMs),
    probeSupabaseOAuthReady(oauthMs),
  ]);

  if (!healthOk || !dataOk) {
    markSupabaseOAuthDegraded();
    clearSupabaseOAuthHealthyLane();
    return;
  }
  const wasDegraded = isSupabaseOAuthDegraded();
  if (oauthOk) {
    markSupabaseOAuthHealthyLane();
    if (wasDegraded) {
      void performSilentSupabaseRecovery();
    }
    return;
  }

  markSupabaseOAuthDegraded();
  clearSupabaseOAuthHealthyLane();
}

async function tryRecoverSupabaseOAuth(options?: { coldStart?: boolean }): Promise<void> {
  if (recoverInFlight) return;
  recoverInFlight = true;
  try {
    await evaluateSupabaseCloudLane(options);
  } finally {
    recoverInFlight = false;
  }
}

/** Background lane probe — marks Firebase as silent fallback when Supabase is down. */
export function initSupabaseResilience(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  void tryRecoverSupabaseOAuth({ coldStart: true });

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
