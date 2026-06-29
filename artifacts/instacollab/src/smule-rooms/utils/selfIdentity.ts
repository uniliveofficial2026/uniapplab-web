import { safeAvatarUrl } from '../../lib/safe';
import type { User } from '../../types';
import { getProfileDisplayName } from '../../lib/profileDisplay';

export type RoomSelfIdentity = {
  id: string;
  /** Stored on seats, requests, and song queue — real display name from app profile. */
  roomName: string;
  /** Short label for chat bubbles ("You"). */
  chatLabel: string;
  avatarUrl: string;
};

const LEGACY_SELF_NAMES = new Set(['You', 'You (Host)']);

export function userToRoomSelfIdentity(user: User): RoomSelfIdentity {
  const roomName = getProfileDisplayName(user, 'Guest');
  return {
    id: user.id,
    roomName,
    chatLabel: 'You',
    avatarUrl: safeAvatarUrl(user.avatarUrl),
  };
}

export function isRoomSelfName(name: string | undefined | null, self: RoomSelfIdentity): boolean {
  if (!name) return false;
  const trimmed = name.trim();
  return trimmed === self.roomName || LEGACY_SELF_NAMES.has(trimmed);
}

export function isRoomSelfGuest(
  guest: { userId?: string; name?: string | null } | null | undefined,
  self: RoomSelfIdentity,
): boolean {
  if (!guest) return false;
  const userId = guest.userId?.trim();
  if (userId && userId === self.id) return true;
  return isRoomSelfName(guest.name, self);
}

export function formatRoomSelfLabel(name: string | undefined | null, self: RoomSelfIdentity): string {
  if (!name) return '';
  return isRoomSelfName(name, self) ? self.chatLabel : name;
}
