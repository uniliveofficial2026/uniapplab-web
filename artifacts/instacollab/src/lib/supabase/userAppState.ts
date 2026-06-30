import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabaseClient } from './client';
import { isSupabaseConfigured } from './config';
import {
  isSupabaseChannelLive,
  removeSupabaseChannelsContaining,
} from './realtimeChannelUtils';
import type { CloudAppStatePayload } from '../cloudSync/types';

let channelSeq = 0;

type ActiveSubscription = {
  cleanup: () => void;
  cleanupAsync: () => Promise<void>;
  channel: RealtimeChannel;
};

const activeByUserId = new Map<string, ActiveSubscription>();
const opTailByUserId = new Map<string, Promise<void>>();

function uniqueChannelName(userId: string): string {
  channelSeq += 1;
  const suffix =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${channelSeq}`;
  return `user_app_state:${userId}:${suffix}`;
}

function runSerialized<T>(userId: string, op: () => Promise<T>): Promise<T> {
  const prev = opTailByUserId.get(userId) ?? Promise.resolve();
  const run = prev.catch(() => undefined).then(op);
  opTailByUserId.set(
    userId,
    run.then(
      () => undefined,
      () => undefined,
    ),
  );
  return run;
}

async function teardownSupabaseUserAppStateUnlocked(userId: string): Promise<void> {
  const active = activeByUserId.get(userId);
  if (active) {
    await active.cleanupAsync();
    activeByUserId.delete(userId);
  }

  const supabase = getSupabaseClient();
  if (!supabase) return;
  await removeSupabaseChannelsContaining(supabase, `user_app_state:${userId}`);
}

export async function teardownSupabaseUserAppState(userId: string): Promise<void> {
  return runSerialized(userId, () => teardownSupabaseUserAppStateUnlocked(userId));
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

  return runSerialized(userId, async () => {
    const existing = activeByUserId.get(userId);
    if (existing && isSupabaseChannelLive(existing.channel)) {
      return existing.cleanup;
    }

    await teardownSupabaseUserAppStateUnlocked(userId);

    const channel = supabase
      .channel(uniqueChannelName(userId))
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

    let removed = false;
    const cleanupAsync = async () => {
      if (removed) return;
      removed = true;
      activeByUserId.delete(userId);
      await supabase.removeChannel(channel);
    };
    const cleanup = () => {
      void cleanupAsync();
    };

    activeByUserId.set(userId, { cleanup, cleanupAsync, channel });
    return cleanup;
  });
}
