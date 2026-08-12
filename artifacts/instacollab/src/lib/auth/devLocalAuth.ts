const BYPASS_KEY = 'instacollab_dev_local_auth';

function canUseLocalAuthBypass(): boolean {
  if (import.meta.env.DEV) return true;
  if (typeof window === 'undefined') return false;
  try {
    const stored = sessionStorage.getItem('instacollab_demo_bootstrap_search') || '';
    const search = stored || window.location.search;
    return new URLSearchParams(search.startsWith('?') ? search.slice(1) : search).get(
      'force_demo',
    ) === '1';
  } catch {
    return false;
  }
}

/** Dev-only: keep local demo login while cloud auth has no session (avoids instant logout). */
export function enableDevLocalAuthBypass(): void {
  if (!canUseLocalAuthBypass() || typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(BYPASS_KEY, '1');
  } catch {
    /* private mode */
  }
}

export function isDevLocalAuthBypass(): boolean {
  if (typeof sessionStorage === 'undefined') return false;
  try {
    return sessionStorage.getItem(BYPASS_KEY) === '1';
  } catch {
    return false;
  }
}

export function clearDevLocalAuthBypass(): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(BYPASS_KEY);
  } catch {
    /* ignore */
  }
}
