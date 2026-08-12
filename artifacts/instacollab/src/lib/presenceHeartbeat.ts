/**
 * Throttled online presence heartbeat — Redis TTL via /api/presence/online.
 */
import { isPlatformApiAvailable, postPresenceHeartbeat } from './platformApi';
import { isSupabaseConfigured } from './supabase/config';
import { getSupabaseClient } from './supabase/client';
import { realtimeLifecycleDebug } from './realtime/realtimeLifecycleDebug';

const HEARTBEAT_MS = 60_000;

let timer: number | null = null;
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

function startTimer(): void {
  if (timer) return;
  void sendHeartbeat();
  timer = window.setInterval(() => {
    void sendHeartbeat();
  }, HEARTBEAT_MS);
}

function clearTimer(): void {
  if (timer) {
    window.clearInterval(timer);
    timer = null;
  }
}

export function installPresenceHeartbeat(): void {
  if (typeof window === 'undefined') return;
  startTimer();

  const supabase = getSupabaseClient();
  if (supabase && !authUnsub) {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        clearTimer();
        realtimeLifecycleDebug('presence-heartbeat-paused', { reason: event || 'no-session' });
        return;
      }
      startTimer();
      void sendHeartbeat();
    });
    authUnsub = () => data.subscription.unsubscribe();
  }
  realtimeLifecycleDebug('presence-heartbeat-installed', {});
}

export function stopPresenceHeartbeat(): void {
  clearTimer();
  authUnsub?.();
  authUnsub = null;
  realtimeLifecycleDebug('presence-heartbeat-stopped', {});
}
