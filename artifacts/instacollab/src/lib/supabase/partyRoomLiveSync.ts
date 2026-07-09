import type { RealtimeChannel } from '@supabase/supabase-js';
import {
  ingestLiveRoomEventFromCloud,
  type LiveRoomEnvelope,
  type LiveRoomEventType,
} from '../livekit/liveRoomBus';
import { getSupabaseClient } from './client';
import { isSupabaseConfigured } from './config';

export type PartyRoomSyncRow = {
  id: string;
  room_id: string;
  sender_id: string;
  event_type: LiveRoomEventType;
  payload: Record<string, unknown>;
  created_at: string;
};

function rowToEnvelope(row: PartyRoomSyncRow): LiveRoomEnvelope {
  const payload = row.payload ?? {};
  return {
    v: 1,
    id: row.id,
    type: row.event_type,
    roomId: row.room_id,
    senderId: row.sender_id,
    senderName: typeof payload.senderName === 'string' ? payload.senderName : undefined,
    ts: new Date(row.created_at).getTime(),
    payload,
  };
}

export async function insertPartyRoomSyncEvent(input: {
  roomId: string;
  senderId: string;
  senderName?: string;
  type: LiveRoomEventType;
  payload: Record<string, unknown>;
}): Promise<PartyRoomSyncRow | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const body = {
    ...input.payload,
    ...(input.senderName ? { senderName: input.senderName } : {}),
  };

  const { data, error } = await supabase
    .from('party_room_sync_events')
    .insert({
      room_id: input.roomId,
      sender_id: input.senderId,
      event_type: input.type,
      payload: body,
    })
    .select('*')
    .single();

  if (error || !data) return null;
  return data as PartyRoomSyncRow;
}

export async function fetchRecentPartyRoomSyncEvents(
  roomId: string,
  limit = 50,
): Promise<LiveRoomEnvelope[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('party_room_sync_events')
    .select('*')
    .eq('room_id', roomId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return (data as PartyRoomSyncRow[]).map(rowToEnvelope).reverse();
}

const seenCloudIds = new Map<string, Set<string>>();

export function subscribePartyRoomSyncEvents(
  roomId: string,
  onEvent?: (event: LiveRoomEnvelope) => void,
): () => void {
  if (!isSupabaseConfigured()) return () => {};
  const supabase = getSupabaseClient();
  if (!supabase) return () => {};

  const seen = seenCloudIds.get(roomId) ?? new Set<string>();
  seenCloudIds.set(roomId, seen);

  const channel: RealtimeChannel = supabase
    .channel(`party-sync:${roomId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'party_room_sync_events',
        filter: `room_id=eq.${roomId}`,
      },
      (payload) => {
        const row = payload.new as PartyRoomSyncRow;
        if (!row?.id || seen.has(row.id)) return;
        seen.add(row.id);
        const envelope = rowToEnvelope(row);
        ingestLiveRoomEventFromCloud(envelope);
        onEvent?.(envelope);
      },
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
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
  const row = await insertPartyRoomSyncEvent({
    roomId,
    senderId: partial.senderId,
    senderName: partial.senderName,
    type: partial.type,
    payload: partial.payload,
  });

  const envelope: LiveRoomEnvelope = row
    ? rowToEnvelope(row)
    : {
        v: 1,
        id: `local_${Date.now()}`,
        type: partial.type,
        roomId,
        senderId: partial.senderId,
        senderName: partial.senderName,
        ts: Date.now(),
        payload: partial.payload,
      };

  publish({
    id: envelope.id,
    type: envelope.type,
    roomId: envelope.roomId,
    senderId: envelope.senderId,
    senderName: envelope.senderName,
    ts: envelope.ts,
    payload: envelope.payload,
  });

  return envelope;
}
