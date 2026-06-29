import { getReceiverGiftStars, syncSeatsReceiverStars } from './roomGifts';
import { resolveRoomMemberIdentity, resolveCoOwnerMemberIdentity } from './roomMemberProfile';
import { isRoomSelfGuest, type RoomSelfIdentity } from './selfIdentity';
import {
  resolveOwnerDisplayName,
  resolveOwnerUserId,
} from './roomRoleUsers';
import type { RoomSettings } from './storage';

export type RoomSeatKey =
  | 'host'
  | 'coowner'
  | 'admin'
  | 'no1'
  | 'no2'
  | 'no3'
  | 'no4'
  | 'no5'
  | 'no6'
  | 'no7'
  | 'no8'
  | 'no9'
  | 'no10'
  | 'no11'
  | 'no12';

export function formatStaffSeatLabel(seatKey: string): string | null {
  if (seatKey === 'host') return 'Host';
  if (seatKey === 'coowner') return 'Co-owner';
  if (seatKey === 'admin') return 'Boss';
  return null;
}

export function formatSeatActionSubtitle(seatKey: string): string {
  const staffLabel = formatStaffSeatLabel(seatKey);
  if (staffLabel) return staffLabel;
  const seatNumber = seatKey.replace(/^no/, '');
  return seatNumber ? `Seat ${seatNumber}` : 'Seat';
}

export function isPartyStaffSeatKey(seatKey: string): boolean {
  return seatKey === 'host' || seatKey === 'coowner' || seatKey === 'admin';
}

export const GUEST_SEAT_KEYS: RoomSeatKey[] = [
  'no1',
  'no2',
  'no3',
  'no4',
  'no5',
  'no6',
  'no7',
  'no8',
  'no9',
  'no10',
  'no11',
  'no12',
];

/** Party room stage — 8 guest sofas (no1–no8). */
export const PARTY_GUEST_SEAT_KEYS: RoomSeatKey[] = GUEST_SEAT_KEYS.slice(0, 8);

/** Chorus / Karaoke stage — 12 guest seats (no1–no12), shown as 2×6. */
export const CHORUS_GUEST_SEAT_KEYS: RoomSeatKey[] = GUEST_SEAT_KEYS.slice(0, 12);

/** Watch Together stage — 9 guest seats around the host (no1–no9). */
export const WATCH_TOGETHER_GUEST_SEAT_KEYS: RoomSeatKey[] = GUEST_SEAT_KEYS.slice(0, 9);

export type RoomLayoutMode = 'Party' | 'Chorus' | 'WatchTogether';

export function getGuestSeatKeysForRoomMode(mode: RoomLayoutMode): RoomSeatKey[] {
  switch (mode) {
    case 'Chorus':
      return CHORUS_GUEST_SEAT_KEYS;
    case 'WatchTogether':
      return WATCH_TOGETHER_GUEST_SEAT_KEYS;
    case 'Party':
    default:
      return PARTY_GUEST_SEAT_KEYS;
  }
}

/** Guest seats for a saved room-mode setting (Chat, Party, Karaoke, Radio, Multi-Guest). */
export function getGuestSeatKeysForSettingsMode(
  settingsMode: string | undefined,
): RoomSeatKey[] {
  switch (settingsMode) {
    case 'Karaoke':
      return CHORUS_GUEST_SEAT_KEYS;
    case 'Radio':
      return WATCH_TOGETHER_GUEST_SEAT_KEYS;
    case 'Multi-Guest':
      return WATCH_TOGETHER_GUEST_SEAT_KEYS;
    case 'Party':
      return PARTY_GUEST_SEAT_KEYS;
    case 'Chat':
    default:
      return PARTY_GUEST_SEAT_KEYS;
  }
}

/** Party-stage seat rows (4-wide grids) for the active settings mode. */
export function splitPartyGuestSeatRows(keys: RoomSeatKey[]): RoomSeatKey[][] {
  if (keys.length <= 4) return [keys];
  if (keys.length === 8) return [keys.slice(0, 4), keys.slice(4, 8)];
  if (keys.length === 9) return [keys.slice(0, 4), keys.slice(4, 8), keys.slice(8)];
  const rows: RoomSeatKey[][] = [];
  for (let index = 0; index < keys.length; index += 4) {
    rows.push(keys.slice(index, index + 4));
  }
  return rows;
}

/** Karaoke / chorus stage — 6 seats per row (e.g. 12 seats → 2 rows). */
export function splitChorusGuestSeatRows(keys: RoomSeatKey[]): RoomSeatKey[][] {
  if (keys.length <= 6) return [keys];
  const rows: RoomSeatKey[][] = [];
  for (let index = 0; index < keys.length; index += 6) {
    rows.push(keys.slice(index, index + 6));
  }
  return rows;
}

export function formatGuestSeatNumber(seatKey: string): string {
  return seatKey.replace(/^no/, '');
}

export function guestSeatGridClass(seatCount: number): string {
  if (seatCount <= 4) return 'grid-cols-4';
  if (seatCount === 6) return 'grid-cols-3';
  if (seatCount === 9) return 'grid-cols-3';
  if (seatCount === 12) return 'grid-cols-6';
  return 'grid-cols-4';
}

export const ALL_SEAT_KEYS: RoomSeatKey[] = ['host', 'coowner', 'admin', ...GUEST_SEAT_KEYS];

export type RoomGuest = {
  userId?: string;
  name: string;
  avatar: string;
  stars: number;
  isSpeaking: boolean;
  frameStyle: string;
  customBadge?: string;
  joinedText?: string;
  isAdmin?: boolean;
  isOwner?: boolean;
  isAdminMuted?: boolean;
};

export interface PartySeatMap {
  host: RoomGuest | null;
  coowner: RoomGuest | null;
  admin: RoomGuest | null;
  no1: RoomGuest | null;
  no2: RoomGuest | null;
  no3: RoomGuest | null;
  no4: RoomGuest | null;
  no5: RoomGuest | null;
  no6: RoomGuest | null;
  no7: RoomGuest | null;
  no8: RoomGuest | null;
  no9: RoomGuest | null;
  no10: RoomGuest | null;
  no11: RoomGuest | null;
  no12: RoomGuest | null;
  [key: string]: RoomGuest | null;
}

export function asRoomSeatKey(seatKey: string): RoomSeatKey | null {
  return (ALL_SEAT_KEYS as readonly string[]).includes(seatKey)
    ? (seatKey as RoomSeatKey)
    : null;
}

export type SeatGuestRequest = {
  id: string;
  userId?: string;
  name: string;
  avatar: string;
  isElite?: boolean;
};

const PARTY_SEATS_STORAGE_PREFIX = 'room_party_seats_v2:';

/** Legacy Smule screenshot placeholders — discard persisted seats that still use them. */
const LEGACY_MOCK_SEAT_NAMES = new Set([
  '♡tcsp ツ ms❀sanny...',
  'helenal',
  '❅ ✨ c-captbebs...',
  '➳ᴹᴿ nikk ℘',
  '♡tcsp ツ ms❀sosina...',
  'g cf ⚜️ Ｍ Ｒ Ｍ Ａ...',
  'captain 🤵 ghe',
  '✨ ➢ mildred_365...',
  '🥀 🎙️ sungit 🎙️ 🥀',
]);

function normalizeNameKey(name: string): string {
  return name.trim().toLowerCase();
}

export function createEmptyPartySeats(): PartySeatMap {
  return {
    host: null,
    coowner: null,
    admin: null,
    no1: null,
    no2: null,
    no3: null,
    no4: null,
    no5: null,
    no6: null,
    no7: null,
    no8: null,
    no9: null,
    no10: null,
    no11: null,
    no12: null,
  };
}

export function resolveSeatGuestDisplay(guest: RoomGuest, roomId: string): RoomGuest {
  const identity = resolveRoomMemberIdentity(guest.userId, guest.name, roomId);
  return {
    ...guest,
    userId: identity.userId ?? guest.userId,
    name: identity.name,
    avatar: identity.avatarUrl,
    stars: getReceiverGiftStars(roomId, identity.name, identity.userId ?? undefined),
  };
}

export function buildOwnerHostGuest(
  settings: RoomSettings,
  roomId: string,
): RoomGuest | null {
  const ownerId = resolveOwnerUserId(settings);
  const ownerName = resolveOwnerDisplayName(settings, 'Host').trim();
  if (!ownerName && !ownerId) return null;

  const identity = resolveRoomMemberIdentity(ownerId, ownerName, roomId);
  return {
    userId: identity.userId ?? ownerId ?? undefined,
    name: identity.name,
    avatar: identity.avatarUrl,
    stars: getReceiverGiftStars(roomId, identity.name, identity.userId ?? undefined),
    isSpeaking: false,
    frameStyle: 'cyan-crown',
    isOwner: true,
  };
}

function reconcileHostSeat(
  settings: RoomSettings,
  roomId: string,
  existing: RoomGuest | null | undefined,
): RoomGuest | null {
  const ownerGuest = buildOwnerHostGuest(settings, roomId);
  if (!ownerGuest) return existing ?? null;
  if (!existing) return null;

  const sameOccupant =
    (ownerGuest.userId && existing.userId === ownerGuest.userId) ||
    normalizeNameKey(existing.name) === normalizeNameKey(ownerGuest.name);

  if (!sameOccupant) {
    return existing;
  }

  return {
    ...ownerGuest,
    isSpeaking: existing.isSpeaking,
    isAdminMuted: existing.isAdminMuted,
    stars: existing.stars ?? ownerGuest.stars,
    frameStyle: existing.frameStyle || ownerGuest.frameStyle,
  };
}

function reconcileCoOwnerSeat(
  settings: RoomSettings,
  roomId: string,
  existing: RoomGuest | null | undefined,
): RoomGuest | null {
  const coOwnerGuest = buildCoOwnerHostGuest(settings, roomId);
  if (!coOwnerGuest) return existing ?? null;
  if (!existing) return null;

  const sameOccupant =
    (coOwnerGuest.userId && existing.userId === coOwnerGuest.userId) ||
    normalizeNameKey(existing.name) === normalizeNameKey(coOwnerGuest.name);

  if (!sameOccupant) {
    return existing;
  }

  return {
    ...coOwnerGuest,
    isSpeaking: existing.isSpeaking,
    isAdminMuted: existing.isAdminMuted,
    stars: existing.stars ?? coOwnerGuest.stars,
    frameStyle: existing.frameStyle || coOwnerGuest.frameStyle,
  };
}

export function buildCoOwnerHostGuest(
  settings: RoomSettings,
  roomId: string,
): RoomGuest | null {
  const identity = resolveCoOwnerMemberIdentity(settings);
  if (!identity?.name?.trim()) return null;

  return {
    userId: identity.userId ?? undefined,
    name: identity.name,
    avatar: identity.avatarUrl,
    stars: getReceiverGiftStars(roomId, identity.name, identity.userId ?? undefined),
    isSpeaking: false,
    frameStyle: 'gold-wings',
    isAdmin: true,
  };
}

export function containsLegacyMockSeats(seats: PartySeatMap): boolean {
  return ALL_SEAT_KEYS.some((key) => {
    const guest = seats[key];
    if (!guest?.name) return false;
    return LEGACY_MOCK_SEAT_NAMES.has(normalizeNameKey(guest.name));
  });
}

export function loadPartySeats(roomId: string): PartySeatMap | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`${PARTY_SEATS_STORAGE_PREFIX}${roomId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PartySeatMap>;
    if (!parsed || typeof parsed !== 'object') return null;

    const seats = createEmptyPartySeats();
    for (const key of ALL_SEAT_KEYS) {
      const guest = parsed[key];
      seats[key] = guest && typeof guest === 'object' && guest.name ? (guest as RoomGuest) : null;
    }
    const legacyBoss = (parsed as { boss?: RoomGuest | null }).boss;
    if (!seats.admin && legacyBoss && typeof legacyBoss === 'object' && legacyBoss.name) {
      seats.admin = legacyBoss;
    }
    return seats;
  } catch {
    return null;
  }
}

export function savePartySeats(roomId: string, seats: PartySeatMap): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(`${PARTY_SEATS_STORAGE_PREFIX}${roomId}`, JSON.stringify(seats));
}

/** Remove the current user from persisted seats (e.g. on leave or unmount). */
export function clearSelfFromPartySeats(
  roomId: string,
  seats: PartySeatMap,
  self: RoomSelfIdentity,
): PartySeatMap {
  const next = { ...seats };
  let changed = false;
  for (const key of ALL_SEAT_KEYS) {
    const guest = next[key];
    if (guest && isRoomSelfGuest(guest, self)) {
      next[key] = null;
      changed = true;
    }
  }
  if (changed) {
    savePartySeats(roomId, next);
  }
  return changed ? next : seats;
}

export function hydratePartySeats(
  roomId: string,
  settings: RoomSettings,
  existing?: PartySeatMap | null,
): PartySeatMap {
  const saved = existing ?? loadPartySeats(roomId);
  const base =
    saved && !containsLegacyMockSeats(saved) ? saved : createEmptyPartySeats();

  const next = createEmptyPartySeats();
  next.host = reconcileHostSeat(settings, roomId, base.host);
  next.coowner = reconcileCoOwnerSeat(settings, roomId, base.coowner);

  for (const key of GUEST_SEAT_KEYS) {
    const guest = base[key];
    next[key] = guest ? resolveSeatGuestDisplay(guest, roomId) : null;
  }

  return next;
}

export function hydratePartySeatsWithStars(
  roomId: string,
  settings: RoomSettings,
  existing?: PartySeatMap | null,
): PartySeatMap {
  return syncSeatsReceiverStars(hydratePartySeats(roomId, settings, existing), roomId) as PartySeatMap;
}

export function createGuestFromSelf(input: {
  userId: string;
  name: string;
  avatar: string;
  roomId: string;
  isHost?: boolean;
  isCoOwner?: boolean;
  isAdminSeat?: boolean;
  isAdmin?: boolean;
}): RoomGuest {
  const frameStyle = input.isHost
    ? 'cyan-crown'
    : input.isCoOwner
      ? 'gold-wings'
      : input.isAdminSeat
        ? 'purple-neon'
        : 'gold-wings';

  return resolveSeatGuestDisplay(
    {
      userId: input.userId,
      name: input.name,
      avatar: input.avatar,
      stars: 0,
      isSpeaking: true,
      frameStyle,
      isOwner: Boolean(input.isHost),
      isAdmin: input.isAdmin,
    },
    input.roomId,
  );
}

export function createGuestFromRequest(
  request: SeatGuestRequest,
  roomId: string,
): RoomGuest {
  return resolveSeatGuestDisplay(
    {
      userId: request.userId,
      name: request.name,
      avatar: request.avatar,
      stars: 0,
      isSpeaking: false,
      frameStyle: 'none',
    },
    roomId,
  );
}
