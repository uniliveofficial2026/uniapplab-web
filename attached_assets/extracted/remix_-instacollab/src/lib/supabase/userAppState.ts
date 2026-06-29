import { getSupabaseClient } from './client';
import { isSupabaseConfigured } from './config';
import type { CloudAppStatePayload } from '../cloudSync/types';

export async function fetchSupabaseUserAppState(
  userId: string
): Promise<CloudAppStatePayload | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('user_app_state')
    .select('payload')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  const payload = data?.payload as CloudAppStatePayload | undefined;
  if (!payload || typeof payload !== 'object' || payload.v !== 1) return null;
  return payload;
}

export async function upsertSupabaseUserAppState(
  userId: string,
  payload: CloudAppStatePayload
): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const { error } = await supabase.from('user_app_state').upsert(
    {
      user_id: userId,
      payload,
    },
    { onConflict: 'user_id' }
  );
  if (error) throw error;
}

export function subscribeSupabaseUserAppState(
  userId: string,
  onPayload: (payload: CloudAppStatePayload) => void
): () => void {
  if (!isSupabaseConfigured()) return () => {};
  const supabase = getSupabaseClient();
  if (!supabase) return () => {};

  const channel = supabase
    .channel(`user_app_state:${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'user_app_state',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        const row = payload.new as { payload?: CloudAppStatePayload } | null;
        const next = row?.payload;
        if (next && typeof next === 'object' && next.v === 1) {
          onPayload(next);
        }
      }
    )
    .subscribe((status) => {
      if (import.meta.env.DEV && status === 'CHANNEL_ERROR') {
        console.warn(
          '[sync] user_app_state realtime error — enable Replication for public.user_app_state in Supabase'
        );
      }
    });

  return () => {
    void supabase.removeChannel(channel);
  };
}
