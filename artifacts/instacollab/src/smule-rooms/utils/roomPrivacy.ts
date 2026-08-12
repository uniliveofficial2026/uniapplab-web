import type { RoomSettings } from './storage';

export type RoomPrivacy = 'Public' | 'Private';

export const ROOM_PRIVACY_OPTIONS: RoomPrivacy[] = ['Public', 'Private'];

export const MIN_ROOM_KEY_LENGTH = 4;
export const MAX_ROOM_KEY_LENGTH = 32;

export function validateRoomKeyInput(key: string): { valid: boolean; message?: string } {
  const trimmed = key.trim();
  if (!trimmed) {
    return { valid: false, message: 'Enter a room key for private rooms.' };
  }
  if (trimmed.length < MIN_ROOM_KEY_LENGTH) {
    return {
      valid: false,
      message: `Room key must be at least ${MIN_ROOM_KEY_LENGTH} characters.`,
    };
  }
  if (trimmed.length > MAX_ROOM_KEY_LENGTH) {
    return {
      valid: false,
      message: `Room key must be ${MAX_ROOM_KEY_LENGTH} characters or fewer.`,
    };
  }
  return { valid: true };
}

/** Canonical Public | Private from cloud rows / settings blobs. */
export function normalizeRoomPrivacy(value: string | null | undefined): RoomPrivacy {
  const raw = String(value || '')
    .trim()
    .toLowerCase();
  if (
    raw === 'private' ||
    raw === 'private key required' ||
    raw === 'key' ||
    raw === 'locked'
  ) {
    return 'Private';
  }
  return 'Public';
}

export function resolveRoomPrivacy(
  settings: Pick<RoomSettings, 'privacy' | 'whoCanJoin'>,
): RoomPrivacy {
  if (settings.privacy != null && String(settings.privacy).trim()) {
    return normalizeRoomPrivacy(settings.privacy);
  }
  // Only the key policy maps to Private. Audience filters (Following, etc.)
  // stay Public privacy with a separate join_policy.
  if (settings.whoCanJoin?.trim() === 'Private Key Required') {
    return 'Private';
  }
  return 'Public';
}

export function isPrivateRoom(
  settings: Pick<RoomSettings, 'privacy' | 'whoCanJoin'>,
): boolean {
  return resolveRoomPrivacy(settings) === 'Private';
}

export function isPublicRoomPrivacy(privacy: string | null | undefined): boolean {
  return normalizeRoomPrivacy(privacy) === 'Public';
}

/**
 * Discovery rule: Public and Private rooms both appear in Live / karaoke /
 * party lobbies. Private access is enforced at join time via room key.
 */
export function isPartyRoomVisibleInDiscovery(
  _room?: { privacy?: string | null; owner_id?: string | null; hostUserId?: string | null },
  _viewerUserId?: string | null,
): boolean {
  return true;
}

const ROOM_KEY_HASH_PREFIX = 'sha256:';

export function isHashedRoomKey(value: string | null | undefined): boolean {
  return String(value || '')
    .trim()
    .toLowerCase()
    .startsWith(ROOM_KEY_HASH_PREFIX);
}

export function formatStoredRoomKeyHash(hashHex: string): string {
  const hex = hashHex.trim().toLowerCase().replace(/^sha256:/, '');
  return hex ? `${ROOM_KEY_HASH_PREFIX}${hex}` : '';
}

export async function hashRoomKey(key: string): Promise<string> {
  const normalized = key.trim();
  if (!normalized) return '';
  const data = new TextEncoder().encode(normalized);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function verifyRoomKey(expected: string | undefined, entered: string): boolean {
  const normalizedExpected = expected?.trim() ?? '';
  const normalizedEntered = entered.trim();
  if (!normalizedExpected || !normalizedEntered) return false;
  if (isHashedRoomKey(normalizedExpected)) return false;
  return normalizedExpected === normalizedEntered;
}

/** Plaintext (host local) or sha256:hex (guest hydrated from cloud). */
export async function verifyRoomKeyAccess(
  expected: string | undefined,
  entered: string,
): Promise<boolean> {
  const normalizedExpected = expected?.trim() ?? '';
  const normalizedEntered = entered.trim();
  if (!normalizedExpected || !normalizedEntered) return false;
  if (isHashedRoomKey(normalizedExpected)) {
    const hex = normalizedExpected.slice(ROOM_KEY_HASH_PREFIX.length).trim().toLowerCase();
    if (!hex) return false;
    const enteredHash = await hashRoomKey(normalizedEntered);
    return enteredHash === hex;
  }
  return normalizedExpected === normalizedEntered;
}

export function roomPrivacyPatch(
  privacy: RoomPrivacy,
  roomKey?: string,
): Pick<RoomSettings, 'privacy' | 'whoCanJoin' | 'roomKey'> {
  if (privacy === 'Public') {
    return {
      privacy,
      whoCanJoin: 'Anyone',
      roomKey: '',
    };
  }

  return {
    privacy,
    whoCanJoin: 'Private Key Required',
    roomKey: roomKey?.trim() ?? '',
  };
}

export function formatRoomPrivacyLabel(privacy: RoomPrivacy | string): string {
  return normalizeRoomPrivacy(privacy) === 'Private' ? 'Private' : 'Public';
}

export function resolveRoomKey(
  settings: Pick<RoomSettings, 'roomKey'>,
): string {
  return settings.roomKey?.trim() ?? '';
}
