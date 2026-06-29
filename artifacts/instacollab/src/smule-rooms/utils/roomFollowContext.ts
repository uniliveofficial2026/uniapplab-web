import { db } from '../../lib/db/localDb';
import { userHasProfilePremium } from '../../lib/premium';
import type { RoomJoinContext } from './roomJoinPolicy';
import { isRoomStaffUserId, resolveOwnerUserId } from './roomRoleUsers';
import type { RoomSettings } from './storage';

export function buildJoinContextFromFollowGraph(
  settings: Pick<RoomSettings, 'roomId' | 'owner' | 'ownerUserId'>,
  userId: string,
): RoomJoinContext {
  const ownerId = resolveOwnerUserId(settings);
  const meId = userId.trim();

  let followsOwner = false;
  let inOwnerCircle = false;

  if (ownerId && meId && ownerId !== meId) {
    followsOwner = db.isFollowingUser(ownerId);
    inOwnerCircle = db.getFollowingIds(ownerId).includes(meId);
  }

  const isElite =
    isRoomStaffUserId(settings as RoomSettings, meId) ||
    userHasProfilePremium(db.currentUser);

  return {
    followsOwner,
    inOwnerCircle,
    isElite,
  };
}

export function applyStaffJoinOverrides(context: RoomJoinContext): RoomJoinContext {
  return {
    followsOwner: true,
    inOwnerCircle: true,
    isElite: true,
  };
}

export function buildSelfRoomJoinContext(
  settings: RoomSettings,
  userId: string,
  isStaff: boolean,
): RoomJoinContext {
  const base = buildJoinContextFromFollowGraph(settings, userId);
  return isStaff ? applyStaffJoinOverrides(base) : base;
}

/** Whether the logged-in user follows the room owner (for viewer UI). */
export function viewerFollowsRoomOwner(
  settings: Pick<RoomSettings, 'roomId' | 'owner' | 'ownerUserId'>,
  viewerUserId?: string | null,
): boolean {
  const ownerId = resolveOwnerUserId(settings);
  const viewerId = viewerUserId?.trim();
  if (!ownerId || !viewerId || ownerId === viewerId) return false;
  if (viewerId === db.currentUserId) return db.isFollowingUser(ownerId);
  return db.getFollowingIds(viewerId).includes(ownerId);
}
