import { getSupabaseClient } from '../supabase/client';
import { withTimeout, NET_AUTH_MS } from '../networkPolicy';

/** Bearer token for same-origin API calls (handoff, telemetry, YouTube proxy). */
export async function getCloudAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    accept: 'application/json',
    'content-type': 'application/json',
  };
  const supabase = getSupabaseClient();
  if (!supabase) return headers;
  try {
    const { data } = await withTimeout(
      supabase.auth.getSession(),
      NET_AUTH_MS,
      'auth.getSession',
    );
    const token = data.session?.access_token;
    if (token) headers.authorization = `Bearer ${token}`;
  } catch {
    /* unsigned request — server may reject */
  }
  return headers;
}
