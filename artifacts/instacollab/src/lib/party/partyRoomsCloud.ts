/**
 * Unified party-room cloud API — routes to Firebase when Supabase is unreachable.
 */
import { shouldUseFirebaseForPartyCloud } from './partyCloud';
import {
  fetchFirebaseActivePartyRooms,
  fetchFirebaseOwnerActivePartyRoom,
  fetchFirebasePartyRoomById,
  isFirebasePartyRoomsAvailable,
  upsertFirebasePartyRoom,
} from '../firebase/partyRooms';
import {
  fetchFirebasePartyRoomMessages,
  insertFirebasePartyRoomMessage,
  isFirebasePartyRoomChatAvailable,
  subscribeFirebasePartyRoomMessages,
} from '../firebase/partyRoomChat';
import {
  fetchRecentFirebasePartyRoomSyncEvents,
  insertFirebasePartyRoomSyncEvent,
  isFirebasePartyRoomLiveSyncAvailable,
  markFirebasePartyRoomSyncEventSeen,
  subscribeFirebasePartyRoomSyncEvents,
} from '../firebase/partyRoomLiveSync';
import {
  endPartyRoom as endSupabasePartyRoom,
  fetchActivePartyRooms as fetchSupabaseActivePartyRooms,
  fetchOwnerActivePartyRoom as fetchSupabaseOwnerActivePartyRoom,
  fetchPartyRoomById as fetchSupabasePartyRoomById,
  isPartyRoomsCloudAvailable as isSupabasePartyRoomsCloudAvailable,
  updatePartyRoomParticipantCount as updateSupabasePartyRoomParticipantCount,
  upsertPartyRoom as upsertSupabasePartyRoom,
  type PartyRoomRow,
  type PartyRoomUpsert,
} from '../supabase/partyRooms';
import {
  fetchPartyRoomMessages as fetchSupabasePartyRoomMessages,
  insertPartyRoomMessage as insertSupabasePartyRoomMessage,
  isPartyRoomChatCloudAvailable as isSupabasePartyRoomChatCloudAvailable,
  subscribePartyRoomMessages as subscribeSupabasePartyRoomMessages,
  unsubscribePartyRoomChannel,
  type PartyRoomLiveChatMessage,
} from '../supabase/partyRoomChat';
import {
  fetchRecentPartyRoomSyncEvents as fetchSupabaseRecentSyncEvents,
  insertPartyRoomSyncEvent as insertSupabasePartyRoomSyncEvent,
  persistAndBroadcastLiveRoomEvent as persistSupabaseLiveRoomEvent,
  subscribePartyRoomSyncEvents as subscribeSupabasePartyRoomSyncEvents,
} from '../supabase/partyRoomLiveSync';
import type { LiveRoomEnvelope, LiveRoomEventType } from '../livekit/liveRoomBus';
import { isPartyCloudAvailable } from './partyCloud';

export type { PartyRoomRow, PartyRoomUpsert, PartyRoomLiveChatMessage };

export function isPartyRoomsCloudAvailable(): boolean {
  return isPartyCloudAvailable();
}

export function isPartyRoomChatCloudAvailable(): boolean {
  return isSupabasePartyRoomChatCloudAvailable() || isFirebasePartyRoomChatAvailable();
}

export function isPartyRoomLiveSyncCloudAvailable(): boolean {
  return isSupabasePartyRoomsCloudAvailable() || isFirebasePartyRoomLiveSyncAvailable();
}

export async function upsertPartyRoom(row: PartyRoomUpsert, ownerId?: string): Promise<PartyRoomRow> {
  if (shouldUseFirebaseForPartyCloud(ownerId ?? row.owner_id) && isFirebasePartyRoomsAvailable()) {
    return upsertFirebasePartyRoom(row);
  }
  return upsertSupabasePartyRoom(row);
}

export async function fetchActivePartyRooms(limit = 40, userId?: string): Promise<PartyRoomRow[]> {
  if (shouldUseFirebaseForPartyCloud(userId) && isFirebasePartyRoomsAvailable()) {
    return fetchFirebaseActivePartyRooms(limit);
  }
  try {
    return await fetchSupabaseActivePartyRooms(limit);
  } catch {
    if (isFirebasePartyRoomsAvailable()) return fetchFirebaseActivePartyRooms(limit);
    return [];
  }
}

export async function fetchPartyRoomById(roomId: string, userId?: string): Promise<PartyRoomRow | null> {
  if (shouldUseFirebaseForPartyCloud(userId) && isFirebasePartyRoomsAvailable()) {
    return fetchFirebasePartyRoomById(roomId);
  }
  try {
    return await fetchSupabasePartyRoomById(roomId);
  } catch {
    if (isFirebasePartyRoomsAvailable()) return fetchFirebasePartyRoomById(roomId);
    return null;
  }
}

export async function fetchOwnerActivePartyRoom(ownerId: string): Promise<PartyRoomRow | null> {
  if (shouldUseFirebaseForPartyCloud(ownerId) && isFirebasePartyRoomsAvailable()) {
    return fetchFirebaseOwnerActivePartyRoom(ownerId);
  }
  try {
    return await fetchSupabaseOwnerActivePartyRoom(ownerId);
  } catch {
    if (isFirebasePartyRoomsAvailable()) return fetchFirebaseOwnerActivePartyRoom(ownerId);
    return null;
  }
}

export async function endPartyRoom(roomId: string, ownerId: string): Promise<void> {
  if (shouldUseFirebaseForPartyCloud(ownerId) && isFirebasePartyRoomsAvailable()) {
    await upsertFirebasePartyRoom({ id: roomId, owner_id: ownerId, room_name: '', status: 'ended' });
    return;
  }
  await endSupabasePartyRoom(roomId, ownerId);
}

export async function updatePartyRoomParticipantCount(
  roomId: string,
  participantCount: number,
  userId?: string,
): Promise<void> {
  if (shouldUseFirebaseForPartyCloud(userId) && isFirebasePartyRoomsAvailable()) {
    const existing = await fetchFirebasePartyRoomById(roomId);
    if (!existing) return;
    await upsertFirebasePartyRoom({
      ...existing,
      participant_count: Math.max(0, Math.floor(participantCount)),
    });
    return;
  }
  await updateSupabasePartyRoomParticipantCount(roomId, participantCount);
}

export async function fetchPartyRoomMessages(
  roomId: string,
  limit = 50,
  userId?: string,
): Promise<PartyRoomLiveChatMessage[]> {
  if (shouldUseFirebaseForPartyCloud(userId) && isFirebasePartyRoomChatAvailable()) {
    return fetchFirebasePartyRoomMessages(roomId, limit);
  }
  try {
    return await fetchSupabasePartyRoomMessages(roomId, limit);
  } catch {
    if (isFirebasePartyRoomChatAvailable()) return fetchFirebasePartyRoomMessages(roomId, limit);
    return [];
  }
}

export async function insertPartyRoomMessage(
  roomId: string,
  senderId: string,
  senderName: string,
  message: PartyRoomLiveChatMessage,
): Promise<unknown> {
  if (shouldUseFirebaseForPartyCloud(senderId) && isFirebasePartyRoomChatAvailable()) {
    return insertFirebasePartyRoomMessage(roomId, senderId, senderName, message);
  }
  try {
    return await insertSupabasePartyRoomMessage(roomId, senderId, senderName, message);
  } catch {
    if (isFirebasePartyRoomChatAvailable()) {
      return insertFirebasePartyRoomMessage(roomId, senderId, senderName, message);
    }
    return null;
  }
}

export function subscribePartyRoomMessages(
  roomId: string,
  onInsert: (message: PartyRoomLiveChatMessage) => void,
  userId?: string,
): (() => void) | null {
  if (shouldUseFirebaseForPartyCloud(userId) && isFirebasePartyRoomChatAvailable()) {
    return subscribeFirebasePartyRoomMessages(roomId, onInsert);
  }
  const channel = subscribeSupabasePartyRoomMessages(roomId, onInsert);
  if (!channel) {
    if (isFirebasePartyRoomChatAvailable()) {
      return subscribeFirebasePartyRoomMessages(roomId, onInsert);
    }
    return null;
  }
  return () => unsubscribePartyRoomChannel(channel);
}

export async function fetchRecentPartyRoomSyncEvents(
  roomId: string,
  limit = 50,
  userId?: string,
): Promise<LiveRoomEnvelope[]> {
  if (shouldUseFirebaseForPartyCloud(userId) && isFirebasePartyRoomLiveSyncAvailable()) {
    return fetchRecentFirebasePartyRoomSyncEvents(roomId, limit);
  }
  try {
    return await fetchSupabaseRecentSyncEvents(roomId, limit);
  } catch {
    if (isFirebasePartyRoomLiveSyncAvailable()) {
      return fetchRecentFirebasePartyRoomSyncEvents(roomId, limit);
    }
    return [];
  }
}

export async function insertPartyRoomSyncEvent(input: {
  roomId: string;
  senderId: string;
  senderName?: string;
  type: LiveRoomEventType;
  payload: Record<string, unknown>;
}): Promise<LiveRoomEnvelope | null> {
  if (shouldUseFirebaseForPartyCloud(input.senderId) && isFirebasePartyRoomLiveSyncAvailable()) {
    const row = await insertFirebasePartyRoomSyncEvent(input);
    if (!row) return null;
    return {
      v: 1,
      id: row.id,
      type: row.event_type,
      roomId: row.room_id,
      senderId: row.sender_id,
      senderName: input.senderName,
      ts: new Date(row.created_at).getTime(),
      payload: row.payload,
    };
  }
  try {
    const row = await insertSupabasePartyRoomSyncEvent(input);
    if (!row) return null;
    return {
      v: 1,
      id: row.id,
      type: row.event_type,
      roomId: row.room_id,
      senderId: row.sender_id,
      senderName: input.senderName,
      ts: new Date(row.created_at).getTime(),
      payload: row.payload,
    };
  } catch {
    if (isFirebasePartyRoomLiveSyncAvailable()) {
      const row = await insertFirebasePartyRoomSyncEvent(input);
      if (!row) return null;
      return {
        v: 1,
        id: row.id,
        type: row.event_type,
        roomId: row.room_id,
        senderId: row.sender_id,
        senderName: input.senderName,
        ts: new Date(row.created_at).getTime(),
        payload: row.payload,
      };
    }
    return null;
  }
}

export function subscribePartyRoomSyncEvents(
  roomId: string,
  onEvent?: (event: LiveRoomEnvelope) => void,
  userId?: string,
): () => void {
  if (shouldUseFirebaseForPartyCloud(userId) && isFirebasePartyRoomLiveSyncAvailable()) {
    return subscribeFirebasePartyRoomSyncEvents(roomId, onEvent);
  }
  const unsub = subscribeSupabasePartyRoomSyncEvents(roomId, onEvent);
  if (isFirebasePartyRoomLiveSyncAvailable()) {
    const unsubFb = subscribeFirebasePartyRoomSyncEvents(roomId, onEvent);
    return () => {
      unsub();
      unsubFb();
    };
  }
  return unsub;
}

export async function persistAndBroadcastLiveRoomEvent(
  roomId: string,
  partial: {
    senderId: string;
    senderName?: string;
    type: LiveRoomEventType;
    payload: Record<string, unknown>;
  },
  publish: (envelope: Omit<LiveRoomEnvelope, 'v'>) => boolean,
): Promise<LiveRoomEnvelope> {
  if (shouldUseFirebaseForPartyCloud(partial.senderId) && isFirebasePartyRoomLiveSyncAvailable()) {
    const id =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `fb_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const ts = Date.now();
    const envelope: LiveRoomEnvelope = {
      v: 1,
      id,
      type: partial.type,
      roomId,
      senderId: partial.senderId,
      senderName: partial.senderName,
      ts,
      payload: partial.payload,
    };
    markFirebasePartyRoomSyncEventSeen(roomId, id);
    publish({
      id: envelope.id,
      type: envelope.type,
      roomId: envelope.roomId,
      senderId: envelope.senderId,
      senderName: envelope.senderName,
      ts: envelope.ts,
      payload: envelope.payload,
    });
    void insertFirebasePartyRoomSyncEvent({
      id,
      roomId,
      senderId: partial.senderId,
      senderName: partial.senderName,
      type: partial.type,
      payload: partial.payload,
    }).catch(() => {
      /* LiveKit already delivered; cloud is durable backup only */
    });
    return envelope;
  }
  return persistSupabaseLiveRoomEvent(roomId, partial, publish);
}
