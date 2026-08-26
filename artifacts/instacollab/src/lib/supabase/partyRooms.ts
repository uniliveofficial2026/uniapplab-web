import { getSupabaseClient } from './client';
import { isSupabaseConfigured } from './config';

export type PartyRoomRow = {
  id: string;
  owner_id: string;
  room_name: string;
  room_mode: string;
  privacy: string;
  join_policy: string | null;
  room_key_hash: string | null;
  seat_join_mode: string;
  who_can_be_seated: string;
  cover_url: string | null;
  tags: string[];
  max_participants: number;
  participant_count: number;
  status: 'active' | 'ended';
  created_at?: string;
  updated_at?: string;
};

export type PartyRoomUpsert = {
  id: string;
  owner_id: string;
  room_name: string;
  room_mode?: string;
  privacy?: string;
  join_policy?: string | null;
  room_key_hash?: string | null;
  seat_join_mode?: string | null;
  who_can_be_seated?: string | null;
  cover_url?: string | null;
  tags?: string[];
  max_participants?: number;
  participant_count?: number;
  status?: 'active' | 'ended';
};

export async function upsertPartyRoom(row: PartyRoomUpsert): Promise<PartyRoomRow> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase is not configured');

  const payload = {
    id: row.id,
    owner_id: row.owner_id,
    room_name: row.room_name,
    room_mode: row.room_mode ?? 'Karaoke',
    privacy: row.privacy ?? 'Public',
    join_policy: row.join_policy ?? null,
    room_key_hash: row.room_key_hash ?? null,
    seat_join_mode: row.seat_join_mode ?? 'free',
    who_can_be_seated: row.who_can_be_seated ?? 'Anyone',
    cover_url: row.cover_url ?? null,
    tags: row.tags ?? [],
    max_participants: row.max_participants ?? 50,
    participant_count: row.participant_count ?? 0,
    status: row.status ?? 'active',
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('party_rooms')
    .upsert(payload, { onConflict: 'id' })
    .select('*')
    .single();
  if (error) throw error;
  return normalizePartyRoomRow(data as PartyRoomRow);
}

function normalizePartyRoomRow(row: PartyRoomRow): PartyRoomRow {
  return {
    ...row,
    privacy: row.privacy ?? 'Public',
    join_policy: row.join_policy ?? null,
    room_key_hash: row.room_key_hash ?? null,
    seat_join_mode: row.seat_join_mode ?? 'free',
    who_can_be_seated: row.who_can_be_seated ?? 'Anyone',
  };
}

export async function updatePartyRoomParticipantCount(
  roomId: string,
  participantCount: number,
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase || !roomId) return;
  const count = Math.max(0, Math.floor(participantCount));
  const { error } = await supabase
    .from('party_rooms')
    .update({ participant_count: count, updated_at: new Date().toISOString() })
    .eq('id', roomId)
    .eq('status', 'active');
  if (error) throw error;
}

/** Host liveness lease — keeps discoverable Solo rooms fresh while RTC session is alive. */
export async function touchPartyRoomHeartbeat(roomId: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase || !roomId) return;
  const { error } = await supabase
    .from('party_rooms')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', roomId)
    .eq('status', 'active');
  if (error) throw error;
}

/** Rooms with no host heartbeat beyond this window are treated as stale for discovery. */
export const PARTY_ROOM_HOST_LEASE_MS = 4 * 60 * 1000;

export function isPartyRoomHostLeaseFresh(
  row: Pick<PartyRoomRow, 'updated_at' | 'created_at'>,
  nowMs = Date.now(),
): boolean {
  const stamp = Date.parse(row.updated_at || row.created_at || '');
  if (!Number.isFinite(stamp)) return false;
  return nowMs - stamp <= PARTY_ROOM_HOST_LEASE_MS;
}

export async function fetchActivePartyRooms(limit = 40): Promise<PartyRoomRow[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('party_rooms')
    .select('*')
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .limit(Math.max(limit * 2, 40));
  if (error) throw error;
  const now = Date.now();
  return (data ?? [])
    .map((row) => normalizePartyRoomRow(row as PartyRoomRow))
    .filter((row) => isPartyRoomHostLeaseFresh(row, now))
    .slice(0, limit);
}

export async function fetchPartyRoomById(roomId: string): Promise<PartyRoomRow | null> {
  const supabase = getSupabaseClient();
  if (!supabase || !roomId) return null;
  const { data, error } = await supabase
    .from('party_rooms')
    .select('*')
    .eq('id', roomId)
    .maybeSingle();
  if (error) throw error;
  return data ? normalizePartyRoomRow(data as PartyRoomRow) : null;
}

/** Active cloud room owned by this user (canonical id for discovery). */
export async function fetchOwnerActivePartyRoom(ownerId: string): Promise<PartyRoomRow | null> {
  const supabase = getSupabaseClient();
  if (!supabase || !ownerId) return null;
  const { data, error } = await supabase
    .from('party_rooms')
    .select('*')
    .eq('owner_id', ownerId)
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  const row = data ? normalizePartyRoomRow(data as PartyRoomRow) : null;
  if (!row) return null;
  // Owner rehydrate must still see their own active row even if lease is stale,
  // so the host client can reconnect/publish or explicitly end it.
  return row;
}

export async function endPartyRoom(roomId: string, ownerId: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  const endedAt = new Date().toISOString();
  const { error: byIdError } = await supabase
    .from('party_rooms')
    .update({ status: 'ended', updated_at: endedAt })
    .eq('id', roomId);
  let byOwnerError = null;
  if (ownerId) {
    const owned = await supabase
      .from('party_rooms')
      .update({ status: 'ended', updated_at: endedAt })
      .eq('owner_id', ownerId)
      .eq('status', 'active');
    byOwnerError = owned.error;
  }
  if (byIdError && byOwnerError) throw byIdError;
}

export function isPartyRoomsCloudAvailable(): boolean {
  return isSupabaseConfigured();
}
