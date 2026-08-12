/**
 * Unified live mode: local dev uses the same Supabase + production API/data as
 * app.uniapplab.com / uniapplab.com (no isolated demo session unless forced).
 *
 * Enable: VITE_UNIFIED_LIVE=true (set automatically by `pnpm live`).
 * Smoke tests: add ?force_demo=1&launch=main to use offline demo session.
 */
export function isUnifiedLiveMode(): boolean {
  return String(import.meta.env.VITE_UNIFIED_LIVE || '').trim().toLowerCase() === 'true';
}

export function isForceDemoSession(search: string): boolean {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  if (params.get('force_demo') === '1') return true;
  if (typeof window === 'undefined') return false;
  try {
    const stored = sessionStorage.getItem('instacollab_demo_bootstrap_search') || '';
    if (!stored) return false;
    const storedParams = new URLSearchParams(
      stored.startsWith('?') ? stored.slice(1) : stored,
    );
    return storedParams.get('force_demo') === '1';
  } catch {
    return false;
  }
}

/** Production app origin used for API proxy in unified local dev. */
export function unifiedLiveApiOrigin(): string {
  const fromEnv = String(import.meta.env.VITE_UNIFIED_LIVE_API || '').trim().replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  return 'https://app.uniapplab.com';
}
