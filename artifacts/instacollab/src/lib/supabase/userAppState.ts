import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabaseClient } from './client';
import { isSupabaseConfigured } from './config';
import { removeSupabaseChannelsContaining } from './realtimeChannelUtils';
import type { CloudAppStatePayload } from '../cloudSync/types';

let channelSeq = 0;

type ActiveSubscription = {
  cleanup: () => void;
  channel: RealtimeChannel;
};

const activeByUserId = new Map<string, ActiveSubscription>();

function uniqueChannelName(userId: string): string {
  channelSeq += 1;
  const suffix =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${channelSeq}`;
  return `user_app_state:${userId}:${suffix}`;
}

export async function teardownSupabaseUserAppState(userId: string): Promise<void> {
  const active = activeByUserId.get(userId);
  if (active) {
    active.cleanup();
    activeByUserId.delete(userId);
  }

  const supabase = getSupabaseClient();
  if (!supabase) return;
  await removeSupabaseChannelsContaining(supabase, `user_app_state:${userId}`);
}

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

export async function subscribeSupabaseUserAppState(
  userId: string,
  onPayload: (payload: CloudAppStatePayload) => void
): Promise<() => void> {
  if (!isSupabaseConfigured()) return () => {};
  const supabase = getSupabaseClient();
  if (!supabase) return () => {};

  await teardownSupabaseUserAppState(userId);

  const channel = supabase.channel(uniqueChannelName(userId));
  channel.on(
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
  );
  channel.subscribe((status) => {
    if (import.meta.env.DEV && status === 'CHANNEL_ERROR') {
      console.warn(
        '[sync] user_app_state realtime error — enable Replication for public.user_app_state in Supabase'
      );
    }
  });

  let removed = false;
  const cleanup = () => {
    if (removed) return;
    removed = true;
    activeByUserId.delete(userId);
    void supabase.removeChannel(channel);
  };

  activeByUserId.set(userId, { cleanup, channel });
  return cleanup;
}
