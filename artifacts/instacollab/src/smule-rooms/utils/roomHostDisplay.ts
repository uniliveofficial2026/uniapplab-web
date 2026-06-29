import { db } from '../../lib/db/localDb';
import { findUserById } from '../../lib/safe';
import {
  formatProfileHandle,
  getProfileDisplayName,
  shouldShowProfileHandle,
} from '../../lib/profileDisplay';
import { DEMO_ROOM_PERSONAS } from './roomDemoConstants';
import { getRoomSettings } from './storage';
import { resolveOwnerDisplayName, resolveOwnerUserId } from './roomRoleUsers';
import { lookupUserIdByDisplayName } from './roomUserLookup';

export type RoomHostDisplay = {
  displayName: string;
  handle?: string;
};

function hostDisplayFromUserId(
  userId: string | null | undefined,
  fallback: string,
): RoomHostDisplay | null {
  const id = userId?.trim();
  if (!id) return null;

  const user = findUserById(db.users, id);
  if (user.id !== 'unknown') {
    return {
      displayName: getProfileDisplayName(user, fallback),
      handle: shouldShowProfileHandle(user) ? formatProfileHandle(user) : undefined,
    };
  }

  const persona = DEMO_ROOM_PERSONAS[id];
  if (persona?.displayName?.trim()) {
    return { displayName: persona.displayName.trim() };
  }

  return null;
}

function hostDisplayFromLabel(label: string): RoomHostDisplay | null {
  const trimmed = label.trim();
  if (!trimmed) return null;

  const matchedId = lookupUserIdByDisplayName(trimmed);
  if (matchedId) {
    return hostDisplayFromUserId(matchedId, trimmed);
  }

  return null;
}

/** Canonical host label for party room lists — prefers owner user id, then db lookup by stored name. */
export function resolveRoomHostDisplay(
  roomId: string,
  storedHostName?: string | null,
): RoomHostDisplay {
  const settings = getRoomSettings(roomId);
  const ownerId = resolveOwnerUserId(settings);

  const fromOwnerId = hostDisplayFromUserId(ownerId, '');
  if (fromOwnerId?.displayName) return fromOwnerId;

  const stored = storedHostName?.trim();
  if (stored) {
    const fromStored = hostDisplayFromLabel(stored);
    if (fromStored) return fromStored;
  }

  const ownerLabel = resolveOwnerDisplayName(settings, '')
    .replace(/\s*\(Host\)\s*$/i, '')
    .trim();
  if (ownerLabel) {
    const fromOwnerLabel = hostDisplayFromLabel(ownerLabel);
    if (fromOwnerLabel) return fromOwnerLabel;
    return { displayName: ownerLabel };
  }

  const hostLabel = settings.host?.trim();
  if (hostLabel && hostLabel !== 'Edit') {
    const fromHost = hostDisplayFromLabel(hostLabel);
    if (fromHost) return fromHost;
    return { displayName: hostLabel };
  }

  return { displayName: stored || 'Host' };
}

export function formatRoomHostMeta(host: RoomHostDisplay): string {
  return host.handle ? `${host.displayName} · ${host.handle}` : host.displayName;
}
