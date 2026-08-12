/**
 * Safe Supabase Realtime channel helpers.
 * Reusing a fixed channel name after subscribe() throws and can blank the UI via Vite overlay.
 */
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

function uniqueTopic(base: string): string {
  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${base}:${id}`;
}

/**
 * Create a fresh channel, attach handlers, then subscribe — never re-bind an already-subscribed channel.
 * Always uses a unique topic so stop/start races cannot hit "after subscribe()".
 */
export function subscribeSafeRealtimeChannel(
  supabase: SupabaseClient,
  topicBase: string,
  attach: (channel: RealtimeChannel) => void,
): RealtimeChannel | null {
  try {
    const channel = supabase.channel(uniqueTopic(topicBase));
    attach(channel);
    channel.subscribe();
    return channel;
  } catch (err) {
    console.warn(`[realtime] subscribe skipped (${topicBase}):`, err);
    return null;
  }
}

/** Best-effort remove; never throws. */
export function removeSafeRealtimeChannel(
  supabase: SupabaseClient | null | undefined,
  channel: RealtimeChannel | null | undefined,
): void {
  if (!supabase || !channel) return;
  try {
    void supabase.removeChannel(channel);
  } catch {
    /* ignore */
  }
}
