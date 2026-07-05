import { getAppUserId } from '../../lib/appUserId';
import { isCloudAuthUserId } from '../../lib/auth/cloudProfile';
import { isSupabaseConfigured } from '../../lib/supabase/config';
import { fetchOwnerActivePartyRoom } from '../../lib/supabase/partyRooms';
import { getManagedRooms } from './managedRooms';
import { getRoomSettings } from './storage';

const STORAGE_PREFIX = 'ownerCanonicalPartyRoomId';

/** Stable 7-digit party room id for this owner (same across Chat / Karaoke / Radio / etc.). */
export function getStoredOwnerPartyRoomId(userId?: string): string | null {
  const id = (userId ?? getAppUserId()).trim();
  if (!id || typeof localStorage === 'undefined') return null;
  const stored = localStorage.getItem(`${STORAGE_PREFIX}:${id}`)?.trim();
  return stored && /^\d{7}$/.test(stored) ? stored : null;
}

export function setStoredOwnerPartyRoomId(userId: string, roomId: string): void {
  const ownerId = userId.trim();
  const rid = roomId.trim();
  if (!ownerId || !/^\d{7}$/.test(rid) || typeof localStorage === 'undefined') return;
  localStorage.setItem(`${STORAGE_PREFIX}:${ownerId}`, rid);
}

export function generatePartyRoomId(): string {
  return String(Math.floor(1_000_000 + Math.random() * 9_000_000));
}

/** Room this user owns in managed list (excludes demo co-owner/admin grants). */
export function findOwnedManagedRoomId(userId?: string): string | null {
  const ownerId = (userId ?? getAppUserId()).trim();
  if (!ownerId) return null;
  const owned = getManagedRooms().find((room) => {
    if (room.role !== 'owner') return false;
    return getRoomSettings(room.id).ownerUserId === ownerId;
  });
  return owned?.id ?? null;
}

function activeOwnedRoomId(userId: string): string | null {
  if (typeof localStorage === 'undefined') return null;
  const active = localStorage.getItem('activeRoomId')?.trim();
  if (!active || !/^\d{7}$/.test(active)) return null;
  const settings = getRoomSettings(active);
  if (settings.ownerUserId === userId) return active;
  return null;
}

export type ResolveOwnerPartyRoomOptions = {
  /** When true, allocate and persist a new id if none exists. */
  createIfMissing?: boolean;
};

/**
 * One permanent party room id per owner — reused when switching room type or re-opening Create Room.
 */
export async function resolveOwnerPartyRoomId(
  userId?: string,
  options: ResolveOwnerPartyRoomOptions = {},
): Promise<string | null> {
  const ownerId = (userId ?? getAppUserId()).trim();
  if (!ownerId) return null;

  const candidates = [
    getStoredOwnerPartyRoomId(ownerId),
    findOwnedManagedRoomId(ownerId),
    activeOwnedRoomId(ownerId),
  ].filter((id): id is string => Boolean(id));

  if (isSupabaseConfigured() && isCloudAuthUserId(ownerId)) {
    try {
      const cloud = await fetchOwnerActivePartyRoom(ownerId);
      if (cloud?.id) candidates.unshift(cloud.id);
    } catch {
      /* local fallback */
    }
  }

  const canonical = candidates.find((id) => /^\d{7}$/.test(id));
  if (canonical) {
    setStoredOwnerPartyRoomId(ownerId, canonical);
    return canonical;
  }

  if (!options.createIfMissing) return null;

  const roomId = generatePartyRoomId();
  setStoredOwnerPartyRoomId(ownerId, roomId);
  return roomId;
}
