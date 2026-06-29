import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

function channelTopic(channel: RealtimeChannel): string {
  return typeof channel.topic === 'string' ? channel.topic : '';
}

/** Drop every realtime channel whose topic contains `needle` (e.g. user_app_state:<userId>). */
export async function removeSupabaseChannelsContaining(
  supabase: SupabaseClient,
  needle: string,
): Promise<void> {
  const matches = supabase.getChannels().filter((channel) => channelTopic(channel).includes(needle));
  if (matches.length === 0) return;
  await Promise.all(matches.map((channel) => supabase.removeChannel(channel)));
}
