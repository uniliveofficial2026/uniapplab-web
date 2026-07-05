import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabaseClient } from './client';
import { isSupabaseConfigured } from './config';
import { updatePartyRoomParticipantCount } from './partyRooms';

export type PartyRoomPresencePayload = {
  user_id: string;
  name: string;
  avatar_url: string;
  joined_at: number;
};

function partyRoomPresenceTopic(roomId: string): string {
  return `party-room-presence:${roomId}`;
}

function membersFromChannel(channel: RealtimeChannel): PartyRoomPresencePayload[] {
  const state = channel.presenceState<PartyRoomPresencePayload>();
  const members: PartyRoomPresencePayload[] = [];
  const seen = new Set<string>();
  for (const entries of Object.values(state)) {
    for (const entry of entries) {
      if (!entry?.user_id || seen.has(entry.user_id)) continue;
      seen.add(entry.user_id);
      members.push(entry);
    }
  }
  members.sort((a, b) => (b.joined_at || 0) - (a.joined_at || 0));
  return members;
}

/** Join room presence as a participant (tracks self, updates participant_count). */
export function subscribePartyRoomPresence(
  roomId: string,
  self: PartyRoomPresencePayload,
  onSync: (members: PartyRoomPresencePayload[]) => void,
): RealtimeChannel | null {
  const supabase = getSupabaseClient();
  if (!supabase || !roomId || !self.user_id) return null;

  const channel = supabase.channel(partyRoomPresenceTopic(roomId), {
    config: { presence: { key: self.user_id } },
  });

  const emit = () => {
    const members = membersFromChannel(channel);
    onSync(members);
    void updatePartyRoomParticipantCount(roomId, members.length).catch(() => {});
  };

  channel
    .on('presence', { event: 'sync' }, emit)
    .on('presence', { event: 'join' }, emit)
    .on('presence', { event: 'leave' }, emit)
    .subscribe(async (status) => {
      if (status !== 'SUBSCRIBED') return;
      await channel.track(self);
      emit();
    });

  return channel;
}

/**
 * Observe room presence without joining (for discovery cards).
 * Does not track self or write participant_count.
 */
export function watchPartyRoomPresence(
  roomId: string,
  onSync: (members: PartyRoomPresencePayload[]) => void,
): RealtimeChannel | null {
  const supabase = getSupabaseClient();
  if (!supabase || !roomId) return null;

  const channel = supabase.channel(partyRoomPresenceTopic(roomId));

  const emit = () => {
    onSync(membersFromChannel(channel));
  };

  channel
    .on('presence', { event: 'sync' }, emit)
    .on('presence', { event: 'join' }, emit)
    .on('presence', { event: 'leave' }, emit)
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') emit();
    });

  return channel;
}

export function unsubscribePartyRoomPresence(channel: RealtimeChannel | null): void {
  const supabase = getSupabaseClient();
  if (!channel || !supabase) return;
  void supabase.removeChannel(channel);
}

export function isPartyRoomPresenceCloudAvailable(): boolean {
  return isSupabaseConfigured();
}
