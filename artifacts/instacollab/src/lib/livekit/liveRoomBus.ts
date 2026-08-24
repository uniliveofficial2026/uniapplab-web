import { Room, RoomEvent, type RemoteParticipant } from '../rtc/livekitCompatibilityBoundary';

export type LiveRoomEventType =
  | 'gift'
  | 'gift_play'
  | 'pk'
  | 'commerce'
  | 'game'
  | 'seats'
  | 'lifecycle'
  | 'like'
  | 'follow';

export type LiveRoomEnvelope<T = unknown> = {
  v: 1;
  id: string;
  type: LiveRoomEventType;
  roomId: string;
  senderId: string;
  senderName?: string;
  ts: number;
  payload: T;
};

type LiveRoomListener = (event: LiveRoomEnvelope) => void;

const roomsById = new Map<string, Set<Room>>();
const listenersByRoom = new Map<string, Set<LiveRoomListener>>();
const boundRooms = new WeakSet<Room>();

function encodeEnvelope(envelope: LiveRoomEnvelope): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(envelope));
}

function decodeEnvelope(raw: Uint8Array): LiveRoomEnvelope | null {
  try {
    const parsed = JSON.parse(new TextDecoder().decode(raw)) as LiveRoomEnvelope;
    if (parsed?.v !== 1 || !parsed.type || !parsed.roomId) return null;
    return parsed;
  } catch {
    return null;
  }
}

function bindDataChannel(room: Room, roomId: string) {
  if (boundRooms.has(room)) return;
  boundRooms.add(room);

  room.on(RoomEvent.DataReceived, (payload, participant?: RemoteParticipant) => {
    const event = decodeEnvelope(payload);
    if (!event || event.roomId !== roomId) return;
    // Transport identity wins for peer-originated packets (prevents spoofed senderId).
    if (participant?.identity) {
      const claimed = String(event.senderId || '').trim();
      const authentic = participant.identity;
      if (claimed && claimed !== authentic) {
        // Keep payload for UX names, but never trust a mismatched paid/identity claim.
        event.senderId = authentic;
      } else if (!claimed) {
        event.senderId = authentic;
      }
    }
    dispatchLiveRoomEvent(roomId, event);
  });
}

function dispatchLiveRoomEvent(roomId: string, event: LiveRoomEnvelope) {
  const listeners = listenersByRoom.get(roomId);
  if (!listeners) return;
  for (const listener of listeners) {
    try {
      listener(event);
    } catch {
      /* isolated handler failure */
    }
  }
}

/** Attach a LiveKit room so publish/subscribe can use its data channel. */
export function registerLiveKitRoom(roomId: string, room: Room): void {
  const id = roomId.trim();
  if (!id) return;
  bindDataChannel(room, id);
  const set = roomsById.get(id) ?? new Set<Room>();
  set.add(room);
  roomsById.set(id, set);
}

/** Detach when a hook disconnects its LiveKit session. */
export function unregisterLiveKitRoom(roomId: string, room: Room): void {
  const id = roomId.trim();
  const set = roomsById.get(id);
  if (!set) return;
  set.delete(room);
  if (set.size === 0) roomsById.delete(id);
}

export function subscribeLiveRoomEvents(
  roomId: string,
  listener: LiveRoomListener,
): () => void {
  const id = roomId.trim();
  const set = listenersByRoom.get(id) ?? new Set<LiveRoomListener>();
  set.add(listener);
  listenersByRoom.set(id, set);
  return () => {
    const current = listenersByRoom.get(id);
    if (!current) return;
    current.delete(listener);
    if (current.size === 0) listenersByRoom.delete(id);
  };
}

/** Broadcast to all peers in connected LiveKit rooms for this party room. */
export function publishLiveRoomEvent(
  roomId: string,
  partial: Omit<LiveRoomEnvelope, 'v' | 'id' | 'ts' | 'roomId'> & {
    id?: string;
    ts?: number;
    /** LOSS-TOLERANT lane (likes / ephemeral FX). Default reliable for control/paid. */
    reliable?: boolean;
  },
): boolean {
  const id = roomId.trim();
  const envelope: LiveRoomEnvelope = {
    v: 1,
    id: partial.id ?? `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type: partial.type,
    roomId: id,
    senderId: partial.senderId,
    senderName: partial.senderName,
    ts: partial.ts ?? Date.now(),
    payload: partial.payload,
  };

  const reliable = partial.reliable !== false && partial.type !== 'like';
  // UniLive event-lane mirror (Stage B) — LiveKit remains transport adapter underneath.
  void import('../unilive-rtc/eventLanes')
    .then((lanes) => {
      if (partial.type === 'like') {
        return lanes.publishLikesBatch(envelope as unknown as Record<string, unknown>);
      }
      if (partial.type === 'gift') {
        return lanes.publishAuthoritativeGift(envelope as unknown as Record<string, unknown>);
      }
      return undefined;
    })
    .catch(() => undefined);

  const data = encodeEnvelope(envelope);
  const rooms = roomsById.get(id);
  let sent = false;
  if (rooms) {
    for (const room of rooms) {
      try {
        void room.localParticipant.publishData(data, { reliable });
        sent = true;
      } catch {
        /* try next connection */
      }
    }
  }

  dispatchLiveRoomEvent(id, envelope);
  return sent;
}

/** Inject events from Supabase realtime (deduped by id). */
export function ingestLiveRoomEventFromCloud(event: LiveRoomEnvelope): void {
  dispatchLiveRoomEvent(event.roomId, event);
}
