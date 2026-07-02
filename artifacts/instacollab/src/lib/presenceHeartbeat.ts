/**
 * Throttled online presence heartbeat — Redis TTL via /api/presence/online.
 */
import { isPlatformApiAvailable, postPresenceHeartbeat } from './platformApi';
import { isSupabaseConfigured } from './supabase/config';
import { getSupabaseClient } from './supabase/client';

const HEARTBEAT_MS = 60_000;

let timer: ReturnType<typeof window.setInterval> | null = null;
let authUnsub: (() => void) | null = null;

async function sendHeartbeat(): Promise<void> {
  if (!isPlatformApiAvailable() || !isSupabaseConfigured()) return;
  const supabase = getSupabaseClient();
  if (!supabase) return;
  const { data } = await supabase.auth.getSession();
  if (!data.session?.access_token) return;
  try {
    await postPresenceHeartbeat();
  } catch {
    /* non-fatal */
  }
}

export function installPresenceHeartbeat(): void {
  if (typeof window === 'undefined') return;
  if (timer) return;

  void sendHeartbeat();
  timer = window.setInterval(() => {
    void sendHeartbeat();
  }, HEARTBEAT_MS);

  const supabase = getSupabaseClient();
  if (supabase && !authUnsub) {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) void sendHeartbeat();
    });
    authUnsub = () => data.subscription.unsubscribe();
  }
}

export function stopPresenceHeartbeat(): void {
  if (timer) {
    window.clearInterval(timer);
    timer = null;
  }
  authUnsub?.();
  authUnsub = null;
}
