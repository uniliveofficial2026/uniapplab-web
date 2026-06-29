import { db } from '../../lib/db/localDb';
import type { RoomSelfIdentity } from './selfIdentity';
import { isRoomSelfGuest } from './selfIdentity';
import { viewerFollowsRoomOwner } from './roomFollowContext';
import { resolveRoomMemberIdentity } from './roomMemberProfile';
import {
  resolveMemberRoleForUser,
  resolveCoOwnerDisplayName,
  resolveCoOwnerUserId,
  resolveOwnerDisplayName,
  resolveOwnerUserId,
} from './roomRoleUsers';
import { ALL_SEAT_KEYS, type PartySeatMap, type RoomGuest } from './roomSeats';
import type { RoomSettings } from './storage';

export type RoomViewerEntry = {
  id: string;
  name: string;
  avatar: string;
  isFollowing: boolean;
  isAdmin: boolean;
  isCoOwner: boolean;
  isOwner: boolean;
  joinedAt?: number;
};

function followStateForUser(
  settings: RoomSettings,
  selfUserId: string,
  targetUserId: string | undefined,
  targetRole: ReturnType<typeof resolveMemberRoleForUser>,
): boolean {
  if (!targetUserId || targetUserId === selfUserId) return false;
  if (targetRole === 'owner') {
    return db.isFollowingUser(targetUserId) || viewerFollowsRoomOwner(settings, selfUserId);
  }
  return db.isFollowingUser(targetUserId);
}

function guestToViewer(
  guest: RoomGuest,
  settings: RoomSettings,
  roomId: string,
  selfUserId: string,
  seatKey: string,
): RoomViewerEntry {
  const identity = resolveRoomMemberIdentity(guest.userId, guest.name, roomId);
  const userId = identity.userId ?? guest.userId ?? seatKey;
  const role = resolveMemberRoleForUser(settings, userId);
  return {
    id: userId,
    name: identity.name,
    avatar: identity.avatarUrl,
    isFollowing: followStateForUser(settings, selfUserId, userId, role),
    isAdmin: role === 'admin',
    isCoOwner: role === 'co-owner',
    isOwner: role === 'owner',
  };
}

/** Build viewer list from seated guests, room owner, and the current user. */
export function buildViewersFromPartyState(
  settings: RoomSettings,
  seats: PartySeatMap,
  self: RoomSelfIdentity,
  roomId: string,
): RoomViewerEntry[] {
  const byId = new Map<string, RoomViewerEntry>();

  const upsert = (entry: RoomViewerEntry) => {
    const existing = byId.get(entry.id);
    if (!existing) {
      byId.set(entry.id, entry);
      return;
    }
    byId.set(entry.id, {
      ...existing,
      ...entry,
      joinedAt: existing.joinedAt ?? entry.joinedAt,
    });
  };

  const selfIdentity = resolveRoomMemberIdentity(self.id, self.roomName, roomId);
  const selfRole = resolveMemberRoleForUser(settings, self.id);
  upsert({
    id: self.id,
    name: selfIdentity.name,
    avatar: selfIdentity.avatarUrl,
    isFollowing: viewerFollowsRoomOwner(settings, self.id),
    isAdmin: selfRole === 'admin',
    isCoOwner: selfRole === 'co-owner',
    isOwner: selfRole === 'owner',
    joinedAt: Date.now(),
  });

  for (const seatKey of ALL_SEAT_KEYS) {
    const guest = seats[seatKey];
    if (!guest) continue;
    if (isRoomSelfGuest(guest, self)) continue;
    upsert(guestToViewer(guest, settings, roomId, self.id, seatKey));
  }

  const ownerId = resolveOwnerUserId(settings);
  if (ownerId && !byId.has(ownerId)) {
    const ownerName = resolveOwnerDisplayName(settings, 'Host');
    const identity = resolveRoomMemberIdentity(ownerId, ownerName, roomId);
    const role = resolveMemberRoleForUser(settings, ownerId);
    upsert({
      id: ownerId,
      name: identity.name,
      avatar: identity.avatarUrl,
      isFollowing: followStateForUser(settings, self.id, ownerId, role),
      isAdmin: false,
      isCoOwner: false,
      isOwner: true,
    });
  }

  const coOwnerId = resolveCoOwnerUserId(settings);
  if (coOwnerId && !byId.has(coOwnerId)) {
    const coOwnerName = resolveCoOwnerDisplayName(settings) ?? 'Co-owner';
    const identity = resolveRoomMemberIdentity(coOwnerId, coOwnerName, roomId);
    const role = resolveMemberRoleForUser(settings, coOwnerId);
    upsert({
      id: coOwnerId,
      name: identity.name,
      avatar: identity.avatarUrl,
      isFollowing: followStateForUser(settings, self.id, coOwnerId, role),
      isAdmin: false,
      isCoOwner: true,
      isOwner: false,
    });
  }

  return Array.from(byId.values()).sort((a, b) => {
    if (a.id === self.id) return -1;
    if (b.id === self.id) return 1;
    return (b.joinedAt ?? 0) - (a.joinedAt ?? 0);
  });
}

export function mergeViewerJoinTimestamps(
  next: RoomViewerEntry[],
  previous: RoomViewerEntry[],
): RoomViewerEntry[] {
  const joinedAtById = new Map(previous.map((viewer) => [viewer.id, viewer.joinedAt]));
  return next.map((viewer) => ({
    ...viewer,
    joinedAt: joinedAtById.get(viewer.id) ?? viewer.joinedAt ?? Date.now(),
  }));
}

export function viewerEntryFromSimulatedUser(
  settings: RoomSettings,
  roomId: string,
  selfUserId: string,
  user: { name: string; userId?: string; isAdmin?: boolean; isOwner?: boolean },
): RoomViewerEntry {
  const userId =
    user.userId?.trim() ||
    (user.isOwner ? resolveOwnerUserId(settings) ?? undefined : undefined) ||
    `sim-${normalizeSimName(user.name)}`;
  const identity = resolveRoomMemberIdentity(userId, user.name, roomId);
  const role = resolveMemberRoleForUser(settings, userId);
  return {
    id: userId,
    name: identity.name,
    avatar: identity.avatarUrl,
    isFollowing: followStateForUser(settings, selfUserId, userId, role),
    isAdmin: role === 'admin',
    isCoOwner: role === 'co-owner',
    isOwner: role === 'owner',
    joinedAt: Date.now(),
  };
}

function normalizeSimName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '-');
}

export function viewerEntryFromDisplayName(
  settings: RoomSettings,
  roomId: string,
  selfUserId: string,
  displayName: string,
): RoomViewerEntry {
  const identity = resolveRoomMemberIdentity(undefined, displayName, roomId);
  const userId = identity.userId ?? `sim-${normalizeSimName(displayName)}-${Date.now()}`;
  const role = resolveMemberRoleForUser(settings, userId);
  return {
    id: userId,
    name: identity.name,
    avatar: identity.avatarUrl,
    isFollowing: followStateForUser(settings, selfUserId, userId, role),
    isAdmin: role === 'admin',
    isCoOwner: role === 'co-owner',
    isOwner: role === 'owner',
    joinedAt: Date.now(),
  };
}
