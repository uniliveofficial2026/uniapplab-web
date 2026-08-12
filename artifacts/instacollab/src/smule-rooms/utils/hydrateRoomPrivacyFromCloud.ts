import { fetchPartyRoomById, type PartyRoomRow } from '../../lib/party/partyRoomsCloud';
import { normalizeStorageRoomMode } from '../../lib/liveRing';
import { getRoomSettings, saveRoomSettings, type RoomSettings } from './storage';
import {
  formatStoredRoomKeyHash,
  isHashedRoomKey,
  normalizeRoomPrivacy,
  roomPrivacyPatch,
  type RoomPrivacy,
} from './roomPrivacy';
import {
  normalizeWhoCanBeSeated,
  resolveSeatJoinMode,
} from './roomJoinPolicy';

export function cloudRowToPrivacySettings(
  row: Pick<
    PartyRoomRow,
    | 'privacy'
    | 'join_policy'
    | 'room_key_hash'
    | 'room_mode'
    | 'room_name'
    | 'owner_id'
    | 'seat_join_mode'
    | 'who_can_be_seated'
  >,
): Partial<RoomSettings> {
  const privacy = normalizeRoomPrivacy(row.privacy);
  const patch = roomPrivacyPatch(privacy);
  const joinPolicy =
    privacy === 'Private'
      ? 'Private Key Required'
      : String(row.join_policy || '').trim() || patch.whoCanJoin;
  const next: Partial<RoomSettings> = {
    privacy,
    whoCanJoin: joinPolicy,
    whoCanBeSeated: normalizeWhoCanBeSeated(row.who_can_be_seated),
    seatJoinMode: resolveSeatJoinMode({
      seatJoinMode: row.seat_join_mode,
      whoCanBeSeated: row.who_can_be_seated,
    }),
    roomMode: normalizeStorageRoomMode(row.room_mode) as RoomSettings['roomMode'],
    ownerUserId: row.owner_id || undefined,
    hostUserId: row.owner_id || undefined,
  };
  if (row.room_name?.trim()) {
    next.roomName = row.room_name.trim();
  }
  if (privacy === 'Private' && row.room_key_hash?.trim()) {
    next.roomKey = formatStoredRoomKeyHash(row.room_key_hash);
  } else if (privacy === 'Public') {
    next.roomKey = '';
  }
  return next;
}

/**
 * Merge cloud privacy / mode / seat policy into local settings for joiners.
 * Owners keep plaintext roomKey locally; guests get sha256: hash for the gate.
 */
export function applyCloudPrivacyToLocalSettings(
  roomId: string,
  row: PartyRoomRow,
  options?: { viewerUserId?: string | null },
): RoomSettings {
  const isOwner =
    Boolean(options?.viewerUserId) &&
    String(options?.viewerUserId) === String(row.owner_id || '');
  const cloudPatch = cloudRowToPrivacySettings(row);

  if (isOwner) {
    saveRoomSettings(roomId, {
      privacy: cloudPatch.privacy,
      whoCanJoin: cloudPatch.whoCanJoin,
      whoCanBeSeated: cloudPatch.whoCanBeSeated,
      seatJoinMode: cloudPatch.seatJoinMode,
      roomMode: cloudPatch.roomMode,
      roomName: cloudPatch.roomName,
      ownerUserId: cloudPatch.ownerUserId,
      hostUserId: cloudPatch.hostUserId,
    });
  } else {
    saveRoomSettings(roomId, cloudPatch);
  }
  return getRoomSettings(roomId);
}

export async function hydrateRoomPrivacyFromCloud(
  roomId: string,
  options?: { viewerUserId?: string | null },
): Promise<RoomSettings | null> {
  const id = roomId.trim();
  if (!id) return null;
  try {
    const row = await fetchPartyRoomById(id, options?.viewerUserId ?? undefined);
    if (!row) return null;
    return applyCloudPrivacyToLocalSettings(id, row, options);
  } catch {
    return null;
  }
}

export async function resolveRoomKeyHashForSync(
  privacy: RoomPrivacy,
  roomKey: string | undefined,
): Promise<string | null> {
  if (privacy !== 'Private') return null;
  const raw = roomKey?.trim() ?? '';
  if (!raw) return null;
  if (isHashedRoomKey(raw)) {
    return raw.replace(/^sha256:/i, '').trim().toLowerCase() || null;
  }
  const { hashRoomKey } = await import('./roomPrivacy');
  const hex = await hashRoomKey(raw);
  return hex || null;
}
