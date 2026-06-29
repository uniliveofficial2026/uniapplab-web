import { getSupabaseUrl, isSupabaseConfigured } from '../supabase/config';

const HEALTH_CACHE_MS = 30_000;
let lastProbeAt = 0;
let lastProbeOk = true;

/** Fast Supabase Auth health check (2s). Cached 30s when healthy. */
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
    lastProbeOk = res.ok;
  } catch {
    lastProbeOk = false;
  }
  lastProbeAt = now;
  return lastProbeOk;
}

export function invalidateSupabaseHealthCache(): void {
  lastProbeAt = 0;
  lastProbeOk = false;
}
