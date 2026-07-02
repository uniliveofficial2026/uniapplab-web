/** True when the URL looks like a return from Supabase auth (OAuth, email confirm, recovery). */
export function isSupabaseOAuthReturnInUrl(): boolean {
  if (typeof window === 'undefined') return false;
  const { search, hash } = window.location;
  if (/\bcode=/.test(search)) return true;
  if (/\btoken_hash=/.test(search)) return true;
  if (/\btype=(signup|email|recovery|invite|magiclink|email_change)/.test(search)) return true;
  if (/\baccess_token=/.test(hash)) return true;
  if (/\berror=/.test(search) && /\berror_description=/.test(search)) return true;
  return false;
}

/** Remove OAuth query/hash from the address bar after session is established. */
export function stripSupabaseOAuthParamsFromUrl(): void {
  if (typeof window === 'undefined') return;
  const path = window.location.pathname || '/';
  window.history.replaceState({}, document.title, path);
}
