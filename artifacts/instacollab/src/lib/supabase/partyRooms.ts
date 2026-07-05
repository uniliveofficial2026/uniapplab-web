import { getSupabaseClient } from './client';
import { isSupabaseConfigured } from './config';

export type PartyRoomRow = {
  id: string;
  owner_id: string;
  room_name: string;
  room_mode: string;
  privacy: string;
  join_policy: string | null;
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
  return data as PartyRoomRow;
}

export async function fetchActivePartyRooms(limit = 40): Promise<PartyRoomRow[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('party_rooms')
    .select('*')
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as PartyRoomRow[];
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
  return (data as PartyRoomRow | null) ?? null;
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
  return (data as PartyRoomRow | null) ?? null;
}

export async function endPartyRoom(roomId: string, ownerId: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  const { error } = await supabase
    .from('party_rooms')
    .update({ status: 'ended', updated_at: new Date().toISOString() })
    .eq('id', roomId)
    .eq('owner_id', ownerId);
  if (error) throw error;
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

export function isPartyRoomsCloudAvailable(): boolean {
  return isSupabaseConfigured();
}
