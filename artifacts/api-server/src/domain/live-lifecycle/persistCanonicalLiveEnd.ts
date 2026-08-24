/**
 * Durable discovery/presence teardown after live.room.end.
 * Best-effort: missing tables or local env without service role must not block End Live.
 */
import { deleteLiveKitRoom, isLiveKitConfigured, partyRoomName, streamRoomName } from "../../lib/livekit";
import { getSupabaseService } from "../../lib/supabase";

async function deleteLiveKitNames(names: string[]): Promise<void> {
  if (!isLiveKitConfigured()) return;
  await Promise.all(
    [...new Set(names.filter(Boolean))].map((name) => deleteLiveKitRoom(name).catch(() => false)),
  );
}

export async function persistCanonicalLiveEnd(input: {
  roomId: string;
  hostUserId: string;
  endedAt?: string;
}): Promise<{ partyRooms: boolean; streams: boolean; profile: boolean }> {
  const endedAt = input.endedAt ?? new Date().toISOString();
  const result = { partyRooms: false, streams: false, profile: false };
  let sb: ReturnType<typeof getSupabaseService>;
  try {
    sb = getSupabaseService();
  } catch {
    await deleteLiveKitNames([partyRoomName(input.roomId), streamRoomName(input.roomId)]);
    return result;
  }

  const partyIds = new Set<string>(input.roomId ? [input.roomId] : []);
  const streamIds = new Set<string>(input.roomId ? [input.roomId] : []);

  try {
    if (input.hostUserId) {
      const { data } = await sb
        .from("party_rooms")
        .select("id")
        .eq("owner_id", input.hostUserId)
        .eq("status", "active");
      for (const row of data ?? []) {
        if (row?.id) partyIds.add(String(row.id));
      }
    }
    const ids = [...partyIds];
    if (ids.length) {
      const { error } = await sb
        .from("party_rooms")
        .update({ status: "ended", updated_at: endedAt })
        .in("id", ids);
      result.partyRooms = !error;
    } else {
      result.partyRooms = true;
    }
  } catch {
    /* optional table */
  }

  try {
    if (input.hostUserId) {
      const { data } = await sb
        .from("streams")
        .select("id")
        .eq("user_id", input.hostUserId)
        .eq("status", "live");
      for (const row of data ?? []) {
        if (row?.id) streamIds.add(String(row.id));
      }
    }
    const ids = [...streamIds];
    if (ids.length) {
      const { error } = await sb
        .from("streams")
        .update({ status: "ended", ended_at: endedAt })
        .in("id", ids)
        .eq("status", "live");
      result.streams = !error;
    } else {
      result.streams = true;
    }
  } catch {
    /* optional table */
  }

  try {
    const { error } = await sb
      .from("profiles")
      .update({
        live_status: null,
        live_kind: null,
        live_started_at: null,
        updated_at: endedAt,
      })
      .eq("id", input.hostUserId);
    result.profile = !error;
  } catch {
    /* optional columns */
  }

  await deleteLiveKitNames([
    ...[...partyIds].map((id) => partyRoomName(id)),
    ...[...streamIds].map((id) => streamRoomName(id)),
  ]);

  return result;
}
