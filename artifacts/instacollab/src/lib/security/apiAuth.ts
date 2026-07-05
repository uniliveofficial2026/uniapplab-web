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
  let token: string | null = null;

  if (supabase) {
    try {
      const { data } = await withTimeout(
        supabase.auth.getSession(),
        NET_AUTH_MS,
        'auth.getSession',
      );
      token = data.session?.access_token ?? null;
      if (!token) {
        const refreshed = await withTimeout(
          supabase.auth.refreshSession(),
          NET_AUTH_MS,
          'auth.refreshSession',
        );
        token = refreshed.data.session?.access_token ?? null;
      }
    } catch {
      /* try Firebase backup lane */
    }
  }

  if (!token) {
    try {
      const fbUser = getFirebaseCurrentUser();
      if (fbUser) {
        token = await withTimeout(fbUser.getIdToken(), NET_AUTH_MS, 'firebase.getIdToken');
      }
    } catch {
      /* unsigned request — server may reject */
    }
  }

  if (token) headers.authorization = `Bearer ${token}`;
  return headers;
}
