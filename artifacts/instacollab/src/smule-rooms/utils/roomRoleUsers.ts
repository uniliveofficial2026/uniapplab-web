import { db } from '../../lib/db/localDb';
import { findUserById } from '../../lib/safe';
import type { User } from '../../types';
import { getProfileDisplayName } from '../../lib/profileDisplay';
import { displaySettingValue, parseMemberList } from './roomMedia';
import { seedDemoRoomFollowGraph } from './roomFollowSeed';
import { DEMO_ROOM_OWNER_USER_IDS, DEMO_ROOM_ADMIN_USER_IDS, DEMO_ROOM_SINGER_USER_IDS } from './roomDemoConstants';
import {
  ensureRoomSettingsSeeded,
  getRoomSettings,
  saveRoomSettings,
  type RoomSettings,
} from './storage';
import type { RoomMemberRole } from './roles';
import { isSimulatedRoomUserId, lookupUserIdByDisplayName } from './roomUserLookup';

export { DEMO_ROOM_OWNER_USER_IDS } from './roomDemoConstants';
export { isSimulatedRoomUserId, lookupUserIdByDisplayName } from './roomUserLookup';

export type ResolvedRoomMember = {
  userId?: string;
  name: string;
};

function resolveUserLabel(userId: string | undefined, fallback: string): string {
  if (!userId) return fallback;
  const user = findUserById(db.users, userId);
  if (user.id === 'unknown') return fallback;
  return getProfileDisplayName(user, fallback);
}

export function resolveOwnerUserId(settings: Pick<RoomSettings, 'roomId' | 'owner' | 'ownerUserId'>): string | null {
  const explicit = settings.ownerUserId?.trim();
  if (explicit) return explicit;
  const demo = DEMO_ROOM_OWNER_USER_IDS[settings.roomId];
  if (demo) return demo;
  return lookupUserIdByDisplayName(settings.owner) ?? null;
}

export function resolveOwnerDisplayName(
  settings: RoomSettings,
  fallback = 'Owner',
): string {
  const ownerId = resolveOwnerUserId(settings);
  if (ownerId) {
    return resolveUserLabel(ownerId, displaySettingValue(settings.owner, fallback));
  }
  const raw = displaySettingValue(settings.owner, fallback);
  const stripped = raw.replace(/\s*\(Host\)\s*$/i, '').trim();
  const matchedId = lookupUserIdByDisplayName(stripped);
  if (matchedId) {
    return resolveUserLabel(matchedId, stripped || fallback);
  }
  return stripped || raw || fallback;
}

export function resolveCoOwnerDisplayName(settings: RoomSettings): string | null {
  const id = settings.coOwnerUserId?.trim();
  if (id) return resolveUserLabel(id, settings.coOwner.trim());
  const name = settings.coOwner?.trim();
  if (!name || name === 'Edit') return null;
  return name;
}

export function resolveCoOwnerUserId(settings: RoomSettings): string | null {
  const explicit = settings.coOwnerUserId?.trim();
  if (explicit) return explicit;
  const name = resolveCoOwnerDisplayName(settings);
  if (!name) return null;
  return lookupUserIdByDisplayName(name) ?? null;
}

export function isRoomCoOwnerUser(
  settings: RoomSettings,
  userId: string | null | undefined,
): boolean {
  const id = userId?.trim();
  if (!id) return false;
  return resolveCoOwnerUserId(settings) === id;
}

export function assignRoomCoOwner(
  roomId: string,
  userId: string,
  displayName: string,
): void {
  saveRoomSettings(roomId, {
    coOwner: displayName.trim(),
    coOwnerUserId: userId.trim(),
  });
}

export function clearRoomCoOwner(roomId: string): void {
  saveRoomSettings(roomId, {
    coOwner: '',
    coOwnerUserId: '',
  });
}

export function resolveRoleMemberEntries(
  settings: RoomSettings,
  field: 'admin' | 'leadSinger',
): ResolvedRoomMember[] {
  const names = parseMemberList(settings[field]);
  const ids =
    field === 'admin' ? settings.adminUserIds : settings.leadSingerUserIds;
  return names.map((name, index) => {
    const demoIds =
      field === 'admin'
        ? DEMO_ROOM_ADMIN_USER_IDS[settings.roomId]
        : DEMO_ROOM_SINGER_USER_IDS[settings.roomId];
    const userId =
      ids?.[index]?.trim() ||
      lookupUserIdByDisplayName(name) ||
      demoIds?.[index];
    return {
      userId,
      name,
    };
  });
}

export function resolveMemberRoleForUser(
  settings: RoomSettings,
  userId: string | null | undefined,
): RoomMemberRole {
  const id = userId?.trim();
  if (!id) return 'user';

  if (isSimulatedRoomUserId(id)) return 'user';

  const ownerId = resolveOwnerUserId(settings);
  if (ownerId && ownerId === id) return 'owner';

  const hostId = settings.hostUserId?.trim();
  if (hostId && hostId === id) return 'owner';

  const coOwnerId = resolveCoOwnerUserId(settings);
  if (coOwnerId && coOwnerId === id) return 'co-owner';

  if (settings.adminUserIds?.includes(id)) return 'admin';

  return 'user';
}

export type ChatRoleFlags = {
  isOwner: boolean;
  isCoOwner: boolean;
  isAdmin: boolean;
};

export function roleToChatFlags(role: RoomMemberRole): ChatRoleFlags {
  return {
    isOwner: role === 'owner',
    isCoOwner: role === 'co-owner',
    isAdmin: role === 'admin',
  };
}

/** Settings-first role; managed-room session grants co-owner/admin for self when not in settings. */
export function resolveEffectiveMemberRole(
  settings: RoomSettings,
  userId: string | null | undefined,
  options?: { sessionRole?: RoomMemberRole | null; sessionUserId?: string | null },
): RoomMemberRole {
  const fromSettings = resolveMemberRoleForUser(settings, userId);
  if (fromSettings !== 'user') return fromSettings;

  const sessionRole = options?.sessionRole;
  const sessionUserId = options?.sessionUserId?.trim();
  const id = userId?.trim();
  if (sessionRole === 'co-owner' && sessionUserId && id && id === sessionUserId) {
    return 'co-owner';
  }
  if (sessionRole === 'admin' && sessionUserId && id && id === sessionUserId) {
    return 'admin';
  }
  return 'user';
}

/** Owner, co-owner, and admin may edit room settings (including managed-room session grants). */
export function canEditRoomForUser(
  settings: RoomSettings,
  userId: string | null | undefined,
  options?: { sessionRole?: RoomMemberRole | null },
): boolean {
  const role = resolveEffectiveMemberRole(settings, userId, {
    sessionRole: options?.sessionRole ?? null,
    sessionUserId: userId,
  });
  return role === 'owner' || role === 'co-owner' || role === 'admin';
}

export function resolveChatRoleFlags(
  settings: RoomSettings,
  userId: string | null | undefined,
  options?: { sessionRole?: RoomMemberRole | null; sessionUserId?: string | null },
): ChatRoleFlags {
  return roleToChatFlags(
    resolveEffectiveMemberRole(settings, userId, options),
  );
}

export function isRoomStaffUserId(
  settings: RoomSettings,
  userId: string | null | undefined,
): boolean {
  const role = resolveMemberRoleForUser(settings, userId);
  return role === 'owner' || role === 'co-owner' || role === 'admin';
}

/** Chat Lounge boss seat — room admins and co-owners (owner has a separate bypass). */
export function canTakeAdminSeat(
  settings: RoomSettings,
  userId: string | null | undefined,
  options?: { sessionRole?: RoomMemberRole | null; sessionUserId?: string | null },
): boolean {
  const role = resolveEffectiveMemberRole(settings, userId, options);
  return role === 'admin' || role === 'co-owner';
}

export function assignOwnerToSettings(
  settings: Partial<RoomSettings>,
  user: Pick<User, 'id' | 'displayName' | 'username'>,
): Partial<RoomSettings> {
  const label = getProfileDisplayName(user, 'Host');
  return {
    ...settings,
    owner: `${label} (Host)`,
    ownerUserId: user.id,
    hostUserId: user.id,
    host: label,
  };
}

/** Backfill demo / legacy rooms with stable owner + list user ids. */
export function ensureRoomRoleUserIds(roomId: string): RoomSettings {
  const settings = ensureRoomSettingsSeeded(roomId);
  const patch: Partial<RoomSettings> = {};

  if (!settings.ownerUserId?.trim()) {
    patch.ownerUserId =
      DEMO_ROOM_OWNER_USER_IDS[roomId] ??
      lookupUserIdByDisplayName(settings.owner);
  }

  if (!settings.hostUserId?.trim() && patch.ownerUserId) {
    patch.hostUserId = patch.ownerUserId;
  }

  if (!settings.coOwnerUserId?.trim()) {
    const coOwnerName = resolveCoOwnerDisplayName(settings);
    if (coOwnerName) {
      const lookedUp = lookupUserIdByDisplayName(coOwnerName);
      if (lookedUp) patch.coOwnerUserId = lookedUp;
    }
  }

  const adminNames = parseMemberList(settings.admin);
  const demoAdminIds = DEMO_ROOM_ADMIN_USER_IDS[roomId];
  if (adminNames.length > 0) {
    if (!settings.adminUserIds || settings.adminUserIds.length === 0) {
      patch.adminUserIds = adminNames.map(
        (name, index) =>
          lookupUserIdByDisplayName(name) ??
          demoAdminIds?.[index] ??
          `room-admin-${roomId}-${index + 1}`,
      );
    } else if (demoAdminIds) {
      const rebound = settings.adminUserIds.map((id, index) => {
        if (id.startsWith(`room-admin-${roomId}-`) && demoAdminIds[index]) {
          return demoAdminIds[index];
        }
        return id;
      });
      if (rebound.some((id, index) => id !== settings.adminUserIds![index])) {
        patch.adminUserIds = rebound;
      }
    }
  }

  const singerNames = parseMemberList(settings.leadSinger);
  const demoSingerIds = DEMO_ROOM_SINGER_USER_IDS[roomId];
  if (singerNames.length > 0) {
    if (!settings.leadSingerUserIds || settings.leadSingerUserIds.length === 0) {
      patch.leadSingerUserIds = singerNames.map(
        (name, index) =>
          lookupUserIdByDisplayName(name) ??
          demoSingerIds?.[index] ??
          `room-singer-${roomId}-${index + 1}`,
      );
    } else if (demoSingerIds) {
      const rebound = settings.leadSingerUserIds.map((id, index) => {
        if (id.startsWith(`room-singer-${roomId}-`) && demoSingerIds[index]) {
          return demoSingerIds[index];
        }
        return id;
      });
      if (rebound.some((id, index) => id !== settings.leadSingerUserIds![index])) {
        patch.leadSingerUserIds = rebound;
      }
    }
  }

  const nextSettings =
    Object.keys(patch).length > 0
      ? (saveRoomSettings(roomId, patch), getRoomSettings(roomId))
      : settings;

  seedDemoRoomFollowGraph(roomId);

  return nextSettings;
}
