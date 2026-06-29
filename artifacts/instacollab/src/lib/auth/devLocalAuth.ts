const BYPASS_KEY = 'instacollab_dev_local_auth';

/** Dev-only: keep local demo login while cloud auth has no session (avoids instant logout). */
export function enableDevLocalAuthBypass(): void {
  if (!import.meta.env.DEV || typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(BYPASS_KEY, '1');
  } catch {
    /* private mode */
  }
}

export function isDevLocalAuthBypass(): boolean {
  if (!import.meta.env.DEV || typeof sessionStorage === 'undefined') return false;
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
