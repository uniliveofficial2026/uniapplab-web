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

export function resolveRoomPrivacy(
  settings: Pick<RoomSettings, 'privacy' | 'whoCanJoin'>,
): RoomPrivacy {
  if (settings.privacy === 'Public' || settings.privacy === 'Private') {
    return settings.privacy;
  }
  if (settings.whoCanJoin?.trim() === 'Private Key Required') {
    return 'Private';
  }
  return settings.whoCanJoin?.trim() === 'Anyone' ? 'Public' : 'Private';
}

export function isPrivateRoom(
  settings: Pick<RoomSettings, 'privacy' | 'whoCanJoin'>,
): boolean {
  return resolveRoomPrivacy(settings) === 'Private';
}

export function verifyRoomKey(expected: string | undefined, entered: string): boolean {
  const normalizedExpected = expected?.trim() ?? '';
  const normalizedEntered = entered.trim();
  if (!normalizedExpected || !normalizedEntered) return false;
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
  return privacy === 'Private' ? 'Private' : 'Public';
}

export function resolveRoomKey(
  settings: Pick<RoomSettings, 'roomKey'>,
): string {
  return settings.roomKey?.trim() ?? '';
}
