import { useEffect, useState } from 'react';
import { getSupabaseClientAsync } from '../../lib/supabase/client';

function localAdminApiBase(): string {
  if (typeof window === 'undefined') return 'http://127.0.0.1:5001';
  return `${window.location.protocol}//${window.location.hostname}:5001`;
}

async function readFreshBearerToken(): Promise<string | null> {
  try {
    const supabase = await getSupabaseClientAsync();
    if (supabase) {
      let { data } = await supabase.auth.getSession();
      if (!data.session?.access_token) {
        const refreshed = await supabase.auth.refreshSession();
        data = refreshed.data;
      }
      const token = data.session?.access_token?.trim();
      if (token?.startsWith('eyJ')) return token;
    }
  } catch {
    /* try Firebase */
  }

  try {
    const { getFirebaseAuth } = await import('../../lib/firebase/app');
    const auth = getFirebaseAuth();
    const user = auth?.currentUser;
    if (user) {
      const idToken = (await user.getIdToken(true)).trim();
      if (idToken.startsWith('eyJ')) return idToken;
    }
    if (auth) {
      const fromListener = await new Promise<string | null>((resolve) => {
        const timer = window.setTimeout(() => {
          unsub();
          resolve(null);
        }, 8000);
        const unsub = auth.onAuthStateChanged(async (next) => {
          if (!next) return;
          window.clearTimeout(timer);
          unsub();
          try {
            const idToken = (await next.getIdToken(true)).trim();
            resolve(idToken.startsWith('eyJ') ? idToken : null);
          } catch {
            resolve(null);
          }
        });
      });
      if (fromListener) return fromListener;
    }
  } catch {
    /* no session */
  }

  return null;
}

export function AdminHandoffHost() {
  const [message, setMessage] = useState('Connecting admin sign-in…');

  useEffect(() => {
    document.getElementById('boot-shell')?.remove();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const params = new URLSearchParams(window.location.search);
      const nonce = params.get('nonce')?.trim();
      if (!nonce) {
        setMessage('Missing handoff nonce.');
        return;
      }

      const token = await readFreshBearerToken();
      if (cancelled) return;

      if (!token) {
        setMessage(`Sign in on ${window.location.origin} first, then return to admin.`);
        return;
      }

      const api = localAdminApiBase();
      const res = await fetch(`${api}/api/admin/dev/handoff/complete`, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ nonce }),
      });

      if (cancelled) return;

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setMessage(body.error || `Handoff failed (${res.status}). Is api-server running on port 5001?`);
        return;
      }

      setMessage('Admin connected — you can close this tab.');
      window.setTimeout(() => window.close(), 600);
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        padding: '1.5rem',
        background: '#0b0d12',
        color: '#9aa3b5',
        fontFamily: 'system-ui, sans-serif',
        textAlign: 'center',
      }}
    >
      <p>{message}</p>
    </div>
  );
}
