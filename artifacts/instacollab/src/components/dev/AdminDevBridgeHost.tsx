import { useEffect, useState } from 'react';
import { getSupabaseClientAsync } from '../../lib/supabase/client';

const ALLOWED_TARGET_ORIGINS = new Set([
  'http://127.0.0.1:5180',
  'http://localhost:5180',
]);

const ADMIN_BRIDGE_MESSAGE = 'unilives-admin-token';

function resolveTargetOrigin(raw: string | null): string {
  if (raw && ALLOWED_TARGET_ORIGINS.has(raw)) return raw;
  return 'http://127.0.0.1:5180';
}

async function waitForFirebaseToken(timeoutMs = 6000): Promise<string | null> {
  try {
    const { getFirebaseAuth } = await import('../../lib/firebase/app');
    const auth = getFirebaseAuth();
    if (!auth) return null;
    if (auth.currentUser) {
      const idToken = (await auth.currentUser.getIdToken()).trim();
      return idToken.startsWith('eyJ') ? idToken : null;
    }
    return await new Promise((resolve) => {
      const timer = window.setTimeout(() => {
        unsub();
        resolve(null);
      }, timeoutMs);
      const unsub = auth.onAuthStateChanged(async (user) => {
        if (!user) return;
        window.clearTimeout(timer);
        unsub();
        try {
          const idToken = (await user.getIdToken()).trim();
          resolve(idToken.startsWith('eyJ') ? idToken : null);
        } catch {
          resolve(null);
        }
      });
    });
  } catch {
    return null;
  }
}

async function readSessionToken(): Promise<string | null> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      const supabase = await getSupabaseClientAsync();
      if (supabase) {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token?.trim();
        if (token?.startsWith('eyJ')) return token;
      }
    } catch {
      /* try Firebase */
    }

    const firebaseToken = await waitForFirebaseToken(attempt === 0 ? 6000 : 800);
    if (firebaseToken) return firebaseToken;

    await new Promise((resolve) => window.setTimeout(resolve, 400));
  }

  return null;
}

function deliverToken(targetOrigin: string, token: string): boolean {
  const payload = { type: ADMIN_BRIDGE_MESSAGE, token };
  if (window.parent && window.parent !== window) {
    window.parent.postMessage(payload, targetOrigin);
    return true;
  }
  if (window.opener && !window.opener.closed) {
    window.opener.postMessage(payload, targetOrigin);
    return true;
  }
  return false;
}

export function AdminDevBridgeHost() {
  const [status, setStatus] = useState<'working' | 'ok' | 'error'>('working');
  const [message, setMessage] = useState('Reading your UniLive’s session…');
  const [attempt, setAttempt] = useState(0);
  const [tokenForCopy, setTokenForCopy] = useState<string | null>(null);

  useEffect(() => {
    document.getElementById('boot-shell')?.remove();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setStatus('working');
      setMessage('Reading your UniLive’s session…');
      setTokenForCopy(null);
      const params = new URLSearchParams(window.location.search);
      const targetOrigin = resolveTargetOrigin(params.get('opener'));
      const embed = params.get('embed') === '1';
      const token = await readSessionToken();

      if (cancelled) return;

      if (!token) {
        const origin = window.location.origin;
        setStatus('error');
        setMessage(
          `No signed-in session on ${origin}. Sign in on this exact URL (localhost and 127.0.0.1 are different), then try again.`,
        );
        return;
      }

      const delivered = deliverToken(targetOrigin, token);
      if (delivered) {
        setStatus('ok');
        setMessage(
          embed
            ? 'Signed in — switch back to the admin tab.'
            : 'Signed in — you can close this tab.',
        );
        if (!embed) window.setTimeout(() => window.close(), 800);
        return;
      }

      setTokenForCopy(token);
      setStatus('error');
      setMessage(
        'Could not reach the admin tab automatically. Copy the token below and paste it on the admin login screen.',
      );
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        padding: '1.5rem',
        background: '#0b0d12',
        color: status === 'error' ? '#ff8a8a' : status === 'ok' ? '#7dffb0' : '#f4f6fb',
        fontFamily: 'system-ui, sans-serif',
        textAlign: 'center',
      }}
    >
      <div style={{ maxWidth: '28rem' }}>
        <h1 style={{ fontSize: '1.25rem', marginBottom: '0.75rem' }}>Admin sign-in bridge</h1>
        <p style={{ lineHeight: 1.5, color: status === 'working' ? '#9aa3b5' : undefined }}>{message}</p>
        {tokenForCopy ? (
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(tokenForCopy);
              setMessage('Token copied — paste it into the admin login field.');
              setStatus('ok');
            }}
            style={{
              marginTop: '1rem',
              padding: '0.75rem 1rem',
              border: 0,
              borderRadius: '0.5rem',
              background: '#5b7cff',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            Copy token for admin
          </button>
        ) : null}
        {status === 'error' && !tokenForCopy ? (
          <>
            <p style={{ marginTop: '1rem', fontSize: '0.92rem', color: '#9aa3b5' }}>
              Main app:{' '}
              <a href={window.location.origin} style={{ color: '#5b7cff' }}>
                {window.location.origin}
              </a>
            </p>
            <button
              type="button"
              onClick={() => setAttempt((value) => value + 1)}
              style={{
                marginTop: '1rem',
                padding: '0.75rem 1rem',
                border: 0,
                borderRadius: '0.5rem',
                background: '#5b7cff',
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
