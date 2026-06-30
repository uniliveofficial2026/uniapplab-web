import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

function channelTopic(channel: RealtimeChannel): string {
  return typeof channel.topic === 'string' ? channel.topic : '';
}

/** Drop every realtime channel whose topic contains `needle` (e.g. user_app_state:<userId>). */
export async function removeSupabaseChannelsContaining(
  supabase: SupabaseClient,
  needle: string,
  maxAttempts = 8,
): Promise<void> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const matches = supabase
      .getChannels()
      .filter((channel) => channelTopic(channel).includes(needle));
    if (matches.length === 0) return;

    await Promise.all(matches.map((channel) => supabase.removeChannel(channel)));

    const remaining = supabase
      .getChannels()
      .some((channel) => channelTopic(channel).includes(needle));
    if (!remaining) return;

    if (attempt < maxAttempts - 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 32));
    }
  }
}

/** True when the channel is still connected or mid-handshake (cannot add postgres_changes). */
export function isSupabaseChannelLive(channel: RealtimeChannel): boolean {
  const state = channel.state;
  return state === 'joined' || state === 'joining';
}
