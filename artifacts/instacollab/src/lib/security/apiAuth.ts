import { getSupabaseClient } from '../supabase/client';
import { withTimeout, NET_AUTH_MS } from '../networkPolicy';
import { getFirebaseCurrentUser } from '../firebase/authApi';

/** Bearer token for same-origin API calls (handoff, telemetry, YouTube proxy). */
export async function getCloudAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    accept: 'application/json',
    'content-type': 'application/json',
  };

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data } = await withTimeout(
        supabase.auth.getSession(),
        NET_AUTH_MS,
        'auth.getSession',
      );
      const token = data.session?.access_token;
      if (token) {
        headers.authorization = `Bearer ${token}`;
        return headers;
      }
    } catch {
      /* try Firebase backup lane */
    }
  }

  try {
    const fbUser = getFirebaseCurrentUser();
    const idToken = await fbUser?.getIdToken();
    if (idToken) headers.authorization = `Bearer ${idToken}`;
  } catch {
    /* unsigned request — server may reject */
  }

  return headers;
}
