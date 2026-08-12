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

type PresenceListener = (members: PartyRoomPresencePayload[]) => void;

export type PartyRoomPresenceHandle = {
  channel: RealtimeChannel;
  unsubscribe: () => void;
};

type PresenceSubscription = {
  roomId: string;
  listener: PresenceListener;
  joinSelf: PartyRoomPresencePayload | null;
};

type PartyRoomPresenceHub = {
  roomId: string;
  channel: RealtimeChannel;
  subscriptions: Set<PresenceSubscription>;
  subscribed: boolean;
  pendingTrack: PartyRoomPresencePayload | null;
};

const hubsByRoomId = new Map<string, PartyRoomPresenceHub>();

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

function emitHub(hub: PartyRoomPresenceHub): void {
  const members = membersFromChannel(hub.channel);
  for (const sub of hub.subscriptions) {
    try {
      sub.listener(members);
    } catch {
      /* ignore listener errors */
    }
  }
  const hasJoiner = [...hub.subscriptions].some((sub) => Boolean(sub.joinSelf));
  if (hasJoiner) {
    void updatePartyRoomParticipantCount(hub.roomId, members.length).catch(() => {});
  }
}

function topicMatchesRoom(topic: string, roomId: string): boolean {
  const needle = partyRoomPresenceTopic(roomId);
  return topic === needle || topic === `realtime:${needle}` || topic.endsWith(`:${needle}`);
}

/**
 * One Realtime channel per room topic.
 * Presence `.on()` handlers are registered once BEFORE `subscribe()`.
 * Later karaoke / live viewers only attach local listeners (no second `.on('presence')`).
 */
function ensurePartyRoomPresenceHub(
  roomId: string,
  presenceKey?: string,
): PartyRoomPresenceHub | null {
  const existing = hubsByRoomId.get(roomId);
  if (existing) return existing;

  const supabase = getSupabaseClient();
  if (!supabase || !roomId) return null;

  for (const channel of supabase.getChannels()) {
    const topic = typeof channel.topic === 'string' ? channel.topic : '';
    if (topicMatchesRoom(topic, roomId)) {
      void supabase.removeChannel(channel);
    }
  }

  const channel = supabase.channel(partyRoomPresenceTopic(roomId), {
    config: {
      presence: {
        key: presenceKey || `watch:${roomId}`,
      },
    },
  });

  const hub: PartyRoomPresenceHub = {
    roomId,
    channel,
    subscriptions: new Set(),
    subscribed: false,
    pendingTrack: null,
  };

  channel
    .on('presence', { event: 'sync' }, () => emitHub(hub))
    .on('presence', { event: 'join' }, () => emitHub(hub))
    .on('presence', { event: 'leave' }, () => emitHub(hub))
    .subscribe((status) => {
      if (status !== 'SUBSCRIBED') return;
      hub.subscribed = true;
      if (hub.pendingTrack) {
        const payload = hub.pendingTrack;
        void hub.channel
          .track(payload)
          .then(() => emitHub(hub))
          .catch(() => {});
      } else {
        emitHub(hub);
      }
    });

  hubsByRoomId.set(roomId, hub);
  return hub;
}

function detachSubscription(subscription: PresenceSubscription): void {
  const hub = hubsByRoomId.get(subscription.roomId);
  if (!hub) return;

  hub.subscriptions.delete(subscription);

  const stillJoining = [...hub.subscriptions].some((sub) => Boolean(sub.joinSelf));
  if (!stillJoining && subscription.joinSelf) {
    hub.pendingTrack = null;
    void hub.channel.untrack().catch(() => {});
  }

  if (hub.subscriptions.size > 0) {
    emitHub(hub);
    return;
  }

  hubsByRoomId.delete(subscription.roomId);
  const supabase = getSupabaseClient();
  if (supabase) void supabase.removeChannel(hub.channel);
}

function attachSubscription(
  roomId: string,
  listener: PresenceListener,
  joinSelf: PartyRoomPresencePayload | null,
): PartyRoomPresenceHandle | null {
  const hub = ensurePartyRoomPresenceHub(roomId, joinSelf?.user_id);
  if (!hub) return null;

  const subscription: PresenceSubscription = { roomId, listener, joinSelf };
  hub.subscriptions.add(subscription);

  if (joinSelf) {
    hub.pendingTrack = joinSelf;
    if (hub.subscribed) {
      void hub.channel
        .track(joinSelf)
        .then(() => emitHub(hub))
        .catch(() => {});
    }
  } else if (hub.subscribed) {
    emitHub(hub);
  }

  let active = true;
  return {
    channel: hub.channel,
    unsubscribe: () => {
      if (!active) return;
      active = false;
      detachSubscription(subscription);
    },
  };
}

/** Join room presence as a participant (tracks self, updates participant_count). */
export function subscribePartyRoomPresence(
  roomId: string,
  self: PartyRoomPresencePayload,
  onSync: PresenceListener,
): PartyRoomPresenceHandle | null {
  if (!roomId || !self.user_id) return null;
  return attachSubscription(roomId, onSync, self);
}

/**
 * Observe room presence without joining (for discovery cards).
 * Does not track self or write participant_count.
 */
export function watchPartyRoomPresence(
  roomId: string,
  onSync: PresenceListener,
): PartyRoomPresenceHandle | null {
  if (!roomId) return null;
  return attachSubscription(roomId, onSync, null);
}

/** @deprecated Prefer handle.unsubscribe(); kept for older call sites. */
export function unsubscribePartyRoomPresence(
  handle: PartyRoomPresenceHandle | RealtimeChannel | null,
): void {
  if (!handle) return;
  if ('unsubscribe' in handle && typeof handle.unsubscribe === 'function') {
    handle.unsubscribe();
    return;
  }
  const supabase = getSupabaseClient();
  if (supabase) void supabase.removeChannel(handle as RealtimeChannel);
}

export function isPartyRoomPresenceCloudAvailable(): boolean {
  return isSupabaseConfigured();
}
