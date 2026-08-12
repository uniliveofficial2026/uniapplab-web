/** Retired Supabase project refs that must never win env merge or ship in builds. */
export const STALE_PROJECT_REFS = new Set([
  'kgiaflmukkguzjtmcuqd',
  'otiqckextvdbudbxzmau',
  'ffhvdoooxkthlvlvdiiu', // replaced by ldxrdbyznheayhbkvxlq (2026-07-17)
]);

export function supabaseProjectRef(url) {
  try {
    return new URL(String(url || '').trim().replace(/^["']|["']$/g, '')).hostname.split('.')[0];
  } catch {
    return null;
  }
}

export function isStaleSupabaseUrl(url) {
  const ref = supabaseProjectRef(url);
  return Boolean(ref && STALE_PROJECT_REFS.has(ref));
}

/** Skip assigning env keys whose value points at a retired Supabase project. */
export function assignEnvUnlessStale(target, key, value) {
  if (value == null || value === '') return false;
  const text = String(value).trim();
  if (
    (key === 'VITE_SUPABASE_URL' ||
      key === 'SUPABASE_URL' ||
      key === 'NEXT_PUBLIC_SUPABASE_URL') &&
    isStaleSupabaseUrl(text)
  ) {
    return false;
  }
  target[key] = text.replace(/^["']|["']$/g, '');
  return true;
}
