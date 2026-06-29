import { db } from '../../lib/db/localDb';
import { findUserById, safeAvatarUrl } from '../../lib/safe';
import { getProfileDisplayName } from '../../lib/profileDisplay';
import { DEMO_ROOM_PERSONAS } from './roomDemoConstants';
import { resolveMemberAvatarUrl } from './roomMedia';
import { isSimulatedRoomUserId, lookupUserIdByDisplayName } from './roomUserLookup';
import {
  resolveCoOwnerDisplayName,
  resolveOwnerDisplayName,
  resolveOwnerUserId,
  resolveRoleMemberEntries,
} from './roomRoleUsers';
import type { RoomSettings } from './storage';

export type RoomMemberIdentity = {
  userId?: string;
  name: string;
  avatarUrl: string;
};

/** Canonical name + avatar for a room member — prefers db user, then demo persona, then name registry. */
export function resolveRoomMemberIdentity(
  userId: string | null | undefined,
  displayName: string,
  roomId?: string,
  avatarSize = 120,
): RoomMemberIdentity {
  const id = userId?.trim();
  const fallbackName = displayName?.trim() || 'Guest';

  if (id) {
    const user = findUserById(db.users, id);
    if (user.id !== 'unknown') {
      const name = getProfileDisplayName(user, fallbackName);
      return {
        userId: id,
        name,
        avatarUrl:
          safeAvatarUrl(user.avatarUrl) ||
          resolveMemberAvatarUrl(name, roomId, avatarSize),
      };
    }

    const persona = DEMO_ROOM_PERSONAS[id];
    if (persona) {
      const name = persona.displayName.trim() || fallbackName;
      return {
        userId: id,
        name,
        avatarUrl:
          persona.avatarUrl ||
          resolveMemberAvatarUrl(name, roomId, avatarSize),
      };
    }
  }

  const matchedId = lookupUserIdByDisplayName(fallbackName);
  if (matchedId && matchedId !== id && !isSimulatedRoomUserId(matchedId)) {
    return resolveRoomMemberIdentity(matchedId, fallbackName, roomId, avatarSize);
  }

  return {
    userId: id,
    name: fallbackName,
    avatarUrl: resolveMemberAvatarUrl(fallbackName, roomId, avatarSize),
  };
}

export function resolveRoomMemberAvatar(
  userId: string | null | undefined,
  displayName: string,
  roomId?: string,
  avatarSize = 120,
): string {
  return resolveRoomMemberIdentity(userId, displayName, roomId, avatarSize).avatarUrl;
}

export function resolveRoleMemberIdentities(
  settings: RoomSettings,
  field: 'admin' | 'leadSinger',
  avatarSize = 120,
): RoomMemberIdentity[] {
  return resolveRoleMemberEntries(settings, field).map((entry) => {
    const identity = resolveRoomMemberIdentity(
      entry.userId,
      entry.name,
      settings.roomId,
      avatarSize,
    );
    return {
      userId: identity.userId ?? entry.userId,
      name: identity.name,
      avatarUrl: identity.avatarUrl,
    };
  });
}

export function resolveOwnerMemberIdentity(
  settings: RoomSettings,
  fallbackName = 'Owner',
  avatarSize = 120,
): RoomMemberIdentity {
  const ownerId = resolveOwnerUserId(settings);
  const name = resolveOwnerDisplayName(settings, fallbackName);
  return resolveRoomMemberIdentity(ownerId, name, settings.roomId, avatarSize);
}

export function resolveCoOwnerMemberIdentity(
  settings: RoomSettings,
  avatarSize = 120,
): RoomMemberIdentity | null {
  const name = resolveCoOwnerDisplayName(settings);
  if (!name) return null;
  const userId = settings.coOwnerUserId?.trim() || lookupUserIdByDisplayName(name);
  return resolveRoomMemberIdentity(userId, name, settings.roomId, avatarSize);
}
