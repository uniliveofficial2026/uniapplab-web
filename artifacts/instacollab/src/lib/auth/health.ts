import { getSupabaseUrl, isSupabaseConfigured, getSupabaseAnonKey } from '../supabase/config';
import { fetchWithTimeout } from '../networkPolicy';

const HEALTH_CACHE_MS = 30_000;
const OAUTH_PROBE_CACHE_MS = 60_000;
const DATA_PROBE_CACHE_MS = 30_000;

let lastProbeAt = 0;
let lastProbeOk = true;
let lastOAuthProbeAt = 0;
let lastOAuthProbeOk = true;
let lastDataProbeAt = 0;
let lastDataProbeOk = true;

/** GoTrue /auth/v1/health returns 401 when the auth process is up (no anon key on that route). */
export function isSupabaseReachableStatus(status: number): boolean {
  if (status === 200 || status === 401) return true;
  if (status === 522 || status === 524) return false;
  return status > 0 && status < 500;
}

export function isSupabaseOAuthReadyStatus(status: number): boolean {
  // Successful OAuth handoff redirects (302/303) or provider HTML (200).
  if (status >= 200 && status < 400) return true;
  if (status === 401) return true;
  if (status === 522 || status === 524) return false;
  return status > 0 && status < 500;
}

/** Fast Supabase Auth health check. Cached 30s when healthy. */
export async function probeSupabaseHealth(timeoutMs = 2000): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const now = Date.now();
  if (now - lastProbeAt < HEALTH_CACHE_MS && lastProbeOk) {
    return true;
  }

  const base = getSupabaseUrl().replace(/\/$/, '');
  try {
    const res = await fetch(`${base}/auth/v1/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(timeoutMs),
    });
    lastProbeOk = isSupabaseReachableStatus(res.status);
  } catch {
    lastProbeOk = false;
  }
  lastProbeAt = now;
  return lastProbeOk;
}

/** Deeper check — OAuth /authorize must respond (health alone is not enough when DB is wedged). */
export async function probeSupabaseOAuthReady(timeoutMs = 5000): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const healthOk = await probeSupabaseHealth(Math.min(timeoutMs, 2500));
  if (!healthOk) return false;

  const now = Date.now();
  if (now - lastOAuthProbeAt < OAUTH_PROBE_CACHE_MS && lastOAuthProbeOk) {
    return true;
  }

  const base = getSupabaseUrl().replace(/\/$/, '');
  const redirectTo =
    typeof window !== 'undefined' ? window.location.origin : 'https://app.uniapplab.com';

  try {
    const res = await fetchWithTimeout(
      `${base}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectTo)}`,
      { method: 'GET', redirect: 'manual', headers: { accept: 'text/html' } },
      timeoutMs,
      'supabase.auth.authorize',
    );
    lastOAuthProbeOk = isSupabaseOAuthReadyStatus(res.status);
  } catch {
    lastOAuthProbeOk = false;
  }
  lastOAuthProbeAt = now;
  return lastOAuthProbeOk;
}

/** REST / Postgres lane — profiles table head request. Cached 30s when healthy. */
export async function probeSupabaseDataReady(timeoutMs = 2000): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const now = Date.now();
  if (now - lastDataProbeAt < DATA_PROBE_CACHE_MS && lastDataProbeOk) {
    return true;
  }

  const base = getSupabaseUrl().replace(/\/$/, '');
  const key = getSupabaseAnonKey();
  try {
    const res = await fetchWithTimeout(
      `${base}/rest/v1/profiles?select=id&limit=0`,
      {
        method: 'GET',
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
        },
      },
      timeoutMs,
      'supabase.rest.profiles',
    );
    lastDataProbeOk = res.ok || res.status === 401 || res.status === 403;
  } catch {
    lastDataProbeOk = false;
  }
  lastDataProbeAt = now;
  return lastDataProbeOk;
}

/** Health + OAuth readiness — use before redirecting users to Supabase OAuth. */
export async function probeSupabaseAuthReady(timeoutMs = 5000): Promise<boolean> {
  return probeSupabaseOAuthReady(timeoutMs);
}

export function invalidateSupabaseHealthCache(): void {
  lastProbeAt = 0;
  lastProbeOk = false;
  lastOAuthProbeAt = 0;
  lastOAuthProbeOk = false;
  lastDataProbeAt = 0;
  lastDataProbeOk = false;
}
