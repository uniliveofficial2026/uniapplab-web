import { getReceiverGiftStars, syncSeatsReceiverStars } from './roomGifts';
import { resolveRoomMemberIdentity, resolveCoOwnerMemberIdentity } from './roomMemberProfile';
import { isRoomAdmin, isRoomCoOwner, isRoomOwner } from './roles';
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
  | 'no12'
  | 'no13'
  | 'no14'
  | 'no15'
  | 'no16'
  | 'no17'
  | 'no18'
  | 'no19'
  | 'no20'
  | 'no21'
  | 'no22'
  | 'no23'
  | 'no24'
  | 'no25'
  | 'no26'
  | 'no27'
  | 'no28'
  | 'no29';

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
  'no13',
  'no14',
  'no15',
  'no16',
  'no17',
  'no18',
  'no19',
  'no20',
  'no21',
  'no22',
  'no23',
  'no24',
  'no25',
  'no26',
  'no27',
  'no28',
  'no29',
];

/** Party room stage — 8 guest sofas (no1–no8). */
export const PARTY_GUEST_SEAT_KEYS: RoomSeatKey[] = GUEST_SEAT_KEYS.slice(0, 8);

/** PK split-room side — 5 guest seats per team. */
export const PK_SIDE_GUEST_KEYS: RoomSeatKey[] = GUEST_SEAT_KEYS.slice(0, 5);

/** Chorus / Karaoke stage — 12 guest seats (no1–no12), shown as 2×6. */
export const CHORUS_GUEST_SEAT_KEYS: RoomSeatKey[] = GUEST_SEAT_KEYS.slice(0, 12);

/** Watch Together stage — 9 guest seats around the host (no1–no9). */
export const WATCH_TOGETHER_GUEST_SEAT_KEYS: RoomSeatKey[] = GUEST_SEAT_KEYS.slice(0, 9);

/** Multi-Guest — 12 guest video tiles (5×3 grid with staff). */
export const MULTI_GUEST_GUEST_SEAT_KEYS: RoomSeatKey[] = GUEST_SEAT_KEYS.slice(0, 12);

/** Solo Live — 3 co-host guest tiles stacked vertically on the right of the host stage. */
export const SOLO_LIVE_GUEST_SEAT_KEYS: RoomSeatKey[] = GUEST_SEAT_KEYS.slice(0, 3);

export function isSoloLiveGuestSeat(seatKey: string): boolean {
  return (SOLO_LIVE_GUEST_SEAT_KEYS as readonly string[]).includes(seatKey);
}

export function isSoloLiveActiveSeat(seatKey: string): boolean {
  return seatKey === 'host' || isSoloLiveGuestSeat(seatKey);
}

/** Multi-Guest video grid — 5×3 (15 tiles: host, co-owner, boss + 12 guests). */
export const MULTI_GUEST_GRID_SLOTS: RoomSeatKey[] = [
  'host',
  'coowner',
  'admin',
  ...GUEST_SEAT_KEYS.slice(0, 12),
];

/** Multi-Guest seat capacity options — staff seats always kept; only guest seats are cut. */
export const MULTI_GUEST_SEAT_COUNT_OPTIONS = [2, 7, 12, 15] as const;
export type MultiGuestSeatCount = (typeof MULTI_GUEST_SEAT_COUNT_OPTIONS)[number];

export function resolveMultiGuestSeatCount(value: unknown): MultiGuestSeatCount {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  if (parsed === 2) return 2;
  if (parsed === 7 || parsed === 8) return 7;
  if (parsed === 11 || parsed === 12) return 12;
  return 15;
}

/** Guest seats removed in 7-seat mode (host mega-tile covers their grid cells). */
export const MULTI_GUEST_7_REMOVED_SEAT_KEYS: RoomSeatKey[] = ['no2', 'no5', 'no6', 'no7', 'no8'];

export type MultiGuestVideoLayoutItem = {
  seatKey: RoomSeatKey;
  colSpan?: number;
  rowSpan?: number;
  gridColumn?: string;
  gridRow?: string;
  /** Logical seats rendered on this tile (no separate grid cell). */
  foldedSeatKeys?: RoomSeatKey[];
};

const MULTI_GUEST_12_HOST_PLACEMENT = {
  gridColumn: '1 / 3',
  gridRow: '1 / 3',
} as const;

/** 7-seat host — spans cols 1–3, rows 1–3 (co-owner + NO.2 + NO.5–NO.7 cells). */
const MULTI_GUEST_7_HOST_PLACEMENT = {
  gridColumn: '1 / 4',
  gridRow: '1 / 4',
} as const;

/** Fixed 5×3 positions — host 2×2 top-left; used for 12-seat mode. */
const MULTI_GUEST_12_VIDEO_LAYOUT: MultiGuestVideoLayoutItem[] = [
  { seatKey: 'host', colSpan: 2, rowSpan: 2, ...MULTI_GUEST_12_HOST_PLACEMENT },
  { seatKey: 'coowner', gridColumn: '3', gridRow: '1' },
  { seatKey: 'admin', gridColumn: '4', gridRow: '1' },
  { seatKey: 'no1', gridColumn: '5', gridRow: '1' },
  { seatKey: 'no2', gridColumn: '3', gridRow: '2' },
  { seatKey: 'no3', gridColumn: '4', gridRow: '2' },
  { seatKey: 'no4', gridColumn: '5', gridRow: '2' },
  { seatKey: 'no5', gridColumn: '1', gridRow: '3' },
  { seatKey: 'no6', gridColumn: '2', gridRow: '3' },
  { seatKey: 'no7', gridColumn: '3', gridRow: '3' },
  { seatKey: 'no8', gridColumn: '4', gridRow: '3' },
  { seatKey: 'no9', gridColumn: '5', gridRow: '3' },
];

/** 7-seat — host mega-tile; right column shifts up: co-owner→boss cell, boss→no1 cell, guests follow. */
const MULTI_GUEST_7_VIDEO_LAYOUT: MultiGuestVideoLayoutItem[] = [
  { seatKey: 'host', colSpan: 3, rowSpan: 3, ...MULTI_GUEST_7_HOST_PLACEMENT },
  { seatKey: 'coowner', gridColumn: '4', gridRow: '1' },
  { seatKey: 'admin', gridColumn: '5', gridRow: '1' },
  { seatKey: 'no1', gridColumn: '4', gridRow: '2' },
  { seatKey: 'no3', gridColumn: '5', gridRow: '2' },
  { seatKey: 'no4', gridColumn: '4', gridRow: '3' },
  { seatKey: 'no9', gridColumn: '5', gridRow: '3' },
];

/** 2-seat — host and co-owner fill the stage edge to edge (50/50, full height). */
const MULTI_GUEST_2_VIDEO_LAYOUT: MultiGuestVideoLayoutItem[] = [
  { seatKey: 'host', gridColumn: '1', gridRow: '1 / 4' },
  { seatKey: 'coowner', gridColumn: '2', gridRow: '1 / 4' },
];

function collectMultiGuestLayoutSeatKeys(layout: MultiGuestVideoLayoutItem[]): RoomSeatKey[] {
  const keys: RoomSeatKey[] = [];
  for (const item of layout) {
    keys.push(item.seatKey);
    if (item.foldedSeatKeys) {
      for (const foldedKey of item.foldedSeatKeys) {
        keys.push(foldedKey);
      }
    }
  }
  return keys;
}

/** Join / lock seats — host + co-owner + boss + 4 guests at 7 seats. */
export function getMultiGuestActiveSeatKeys(count: MultiGuestSeatCount = 15): RoomSeatKey[] {
  switch (count) {
    case 2:
    case 7:
    case 12:
      return collectMultiGuestLayoutSeatKeys(getMultiGuestVideoLayout(count));
    case 15:
    default:
      return [...MULTI_GUEST_GRID_SLOTS];
  }
}

export function getMultiGuestGuestSeatKeys(count: MultiGuestSeatCount = 15): RoomSeatKey[] {
  return getMultiGuestActiveSeatKeys(count).filter(
    (seatKey) => seatKey !== 'host' && seatKey !== 'coowner' && seatKey !== 'admin',
  );
}

export function isMultiGuestSeatActive(
  seatKey: string,
  count: MultiGuestSeatCount = 15,
): boolean {
  return getMultiGuestActiveSeatKeys(count).includes(seatKey as RoomSeatKey);
}

/** Drop occupants on seats that are not part of the current multi-guest layout. */
export function prunePartySeatsForMultiGuestCount(
  seats: PartySeatMap,
  count: MultiGuestSeatCount,
): PartySeatMap {
  const active = new Set(getMultiGuestActiveSeatKeys(count));
  let changed = false;
  const next = { ...seats };
  for (const seatKey of ALL_SEAT_KEYS) {
    if (!active.has(seatKey) && next[seatKey]) {
      next[seatKey] = null;
      changed = true;
    }
  }
  return changed ? next : seats;
}

export function pruneLockedSeatsForMultiGuestCount(
  locked: Record<string, boolean>,
  count: MultiGuestSeatCount,
): Record<string, boolean> {
  const active = new Set(getMultiGuestActiveSeatKeys(count));
  let changed = false;
  const next = { ...locked };
  for (const seatKey of Object.keys(next)) {
    if (!active.has(seatKey as RoomSeatKey) && next[seatKey]) {
      delete next[seatKey];
      changed = true;
    }
  }
  return changed ? next : locked;
}

/** First open joinable guest seat for request approval (never assigns staff seats). */
export function findOpenMultiGuestSeat(
  seats: PartySeatMap,
  count: MultiGuestSeatCount,
  lockedSeats: Record<string, boolean> = {},
): RoomSeatKey | null {
  const open = getMultiGuestActiveSeatKeys(count).find(
    (seatKey) =>
      seatKey !== 'host' &&
      seatKey !== 'coowner' &&
      seatKey !== 'admin' &&
      seats[seatKey] === null &&
      !lockedSeats[seatKey],
  );
  return open ?? null;
}

function isSeatOpenForJoin(
  seatKey: RoomSeatKey,
  seats: PartySeatMap,
  lockedSeats: Record<string, boolean>,
): boolean {
  if (lockedSeats[seatKey]) return false;
  return seats[seatKey] === null;
}

/** Best open seat for the footer “join seat” action (staff first when allowed). */
export function findPreferredOpenSeat(options: {
  seats: PartySeatMap;
  roomMode: RoomLayoutMode;
  multiGuestSeatCount?: MultiGuestSeatCount;
  lockedSeats?: Record<string, boolean>;
  canTakeHost?: boolean;
  canTakeCoOwner?: boolean;
  canTakeAdmin?: boolean;
}): RoomSeatKey | null {
  const {
    seats,
    roomMode,
    multiGuestSeatCount = 15,
    lockedSeats = {},
    canTakeHost = false,
    canTakeCoOwner = false,
    canTakeAdmin = false,
  } = options;

  if (roomMode === 'SoloLive') {
    // Footer join/leave is guest-seat only (no1–no3). Host is staff/stage flow.
    return (
      SOLO_LIVE_GUEST_SEAT_KEYS.find((seatKey) => isSeatOpenForJoin(seatKey, seats, lockedSeats)) ??
      null
    );
  }

  if (canTakeHost && isSeatOpenForJoin('host', seats, lockedSeats)) return 'host';
  if (canTakeCoOwner && isSeatOpenForJoin('coowner', seats, lockedSeats)) return 'coowner';
  if (canTakeAdmin && isSeatOpenForJoin('admin', seats, lockedSeats)) return 'admin';

  if (roomMode === 'MultiGuest') {
    return findOpenMultiGuestSeat(seats, multiGuestSeatCount, lockedSeats);
  }

  return (
    getGuestSeatKeysForRoomMode(roomMode).find((seatKey) =>
      isSeatOpenForJoin(seatKey, seats, lockedSeats),
    ) ?? null
  );
}

/** Video grid layout — 2/12/7 use fixed positions; 15 is full 5×3. */
export function getMultiGuestVideoLayout(count: MultiGuestSeatCount = 15): MultiGuestVideoLayoutItem[] {
  if (count === 2) return MULTI_GUEST_2_VIDEO_LAYOUT;
  if (count === 7) return MULTI_GUEST_7_VIDEO_LAYOUT;
  if (count === 12) return MULTI_GUEST_12_VIDEO_LAYOUT;
  return MULTI_GUEST_GRID_SLOTS.map((seatKey) => ({ seatKey }));
}

export function getMultiGuestVideoGridClass(count: MultiGuestSeatCount = 15): string {
  if (count === 2) return 'multi-guest-video-grid--2';
  if (count === 7) return 'multi-guest-video-grid--7';
  if (count === 12) return 'multi-guest-video-grid--12';
  return 'multi-guest-video-grid--15';
}

export function resolveMergedHostTileSeats(
  foldedKeys: RoomSeatKey[],
  activeSeats: PartySeatMap,
): {
  primaryKey: RoomSeatKey;
  primaryGuest: RoomGuest | null;
  extraGuests: Array<{ seatKey: RoomSeatKey; guest: RoomGuest }>;
} {
  const order: RoomSeatKey[] = ['host', ...foldedKeys];
  const occupied = order
    .map((seatKey) => ({ seatKey, guest: activeSeats[seatKey] }))
    .filter((entry): entry is { seatKey: RoomSeatKey; guest: RoomGuest } => Boolean(entry.guest));

  if (!occupied.length) {
    return { primaryKey: 'host', primaryGuest: null, extraGuests: [] };
  }

  const [primary, ...extraGuests] = occupied;
  return { primaryKey: primary.seatKey, primaryGuest: primary.guest, extraGuests };
}

export type RoomLayoutMode =
  | 'Party'
  | 'Chorus'
  | 'WatchTogether'
  | 'GameLive'
  | 'MultiGuest'
  | 'SoloLive';

export function getGuestSeatKeysForRoomMode(mode: RoomLayoutMode): RoomSeatKey[] {
  switch (mode) {
    case 'Chorus':
      return CHORUS_GUEST_SEAT_KEYS;
    case 'WatchTogether':
    case 'GameLive':
      return WATCH_TOGETHER_GUEST_SEAT_KEYS;
    case 'MultiGuest':
      return MULTI_GUEST_GUEST_SEAT_KEYS;
    case 'SoloLive':
      return SOLO_LIVE_GUEST_SEAT_KEYS;
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
    case 'Game-Live':
      return WATCH_TOGETHER_GUEST_SEAT_KEYS;
    case 'Multi-Guest':
      return MULTI_GUEST_GUEST_SEAT_KEYS;
    case 'Solo-Live':
      return SOLO_LIVE_GUEST_SEAT_KEYS;
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

/** Display label for seats — matches live room tiles (Host, NO.1, …). */
export function formatSeatDisplayLabel(seatKey: string): string {
  const staff = formatStaffSeatLabel(seatKey);
  if (staff) return staff;
  const seatNumber = formatGuestSeatNumber(seatKey);
  return seatNumber ? `NO.${seatNumber}` : seatKey;
}

/** Guest labels renumbered in video-grid order when capacity is cut (7-seat: NO.1–NO.4). */
export function getMultiGuestSeatLabelMap(
  count: MultiGuestSeatCount,
): Partial<Record<RoomSeatKey, string>> {
  if (count === 15) return {};

  const labels: Partial<Record<RoomSeatKey, string>> = {};
  let guestNumber = 1;

  for (const item of getMultiGuestVideoLayout(count)) {
    const seatKeys: RoomSeatKey[] = item.foldedSeatKeys
      ? [item.seatKey, ...item.foldedSeatKeys]
      : [item.seatKey];

    for (const seatKey of seatKeys) {
      const staff = formatStaffSeatLabel(seatKey);
      if (staff) {
        labels[seatKey] = staff;
        continue;
      }
      if (GUEST_SEAT_KEYS.includes(seatKey)) {
        labels[seatKey] = `NO.${guestNumber}`;
        guestNumber += 1;
      }
    }
  }

  return labels;
}

export function formatMultiGuestSeatLabel(
  seatKey: string,
  count: MultiGuestSeatCount = 15,
  options?: { uppercase?: boolean },
): string {
  const label =
    count === 15
      ? formatSeatDisplayLabel(seatKey)
      : getMultiGuestSeatLabelMap(count)[seatKey as RoomSeatKey] ?? formatSeatDisplayLabel(seatKey);
  if (!options?.uppercase) return label;
  const staff = formatStaffSeatLabel(seatKey);
  return staff ? staff.toUpperCase() : label.toUpperCase();
}

/** Action / toast subtitle — Host, Co-owner, Boss, or Seat N using renumbered guests. */
export function formatMultiGuestSeatActionSubtitle(
  seatKey: string,
  count: MultiGuestSeatCount = 15,
): string {
  const staffLabel = formatStaffSeatLabel(seatKey);
  if (staffLabel) return staffLabel;
  const display = formatMultiGuestSeatLabel(seatKey, count);
  const match = /^NO\.(\d+)$/.exec(display);
  return match ? `Seat ${match[1]}` : display;
}

/** Host seat is always reserved and cannot be locked. */
export function isSeatLockableByPolicy(seatKey: string): boolean {
  return seatKey !== 'host';
}

/** Owner, co-owner, and boss may open the seat-lock controls. */
export function canRoleManageSeatLocks(role: string): boolean {
  return isRoomOwner(role) || isRoomCoOwner(role) || isRoomAdmin(role);
}

/** Owner/co-owner: any seat except host. Boss: guest seats + boss only (not co-owner). */
export function canRoleLockSeat(seatKey: string, role: string): boolean {
  if (!isSeatLockableByPolicy(seatKey)) return false;
  if (isRoomOwner(role) || isRoomCoOwner(role)) return true;
  if (isRoomAdmin(role)) {
    if (seatKey === 'coowner') return false;
    return seatKey === 'admin' || GUEST_SEAT_KEYS.includes(seatKey as RoomSeatKey);
  }
  return false;
}

/** Seats that can be locked in guest management for the active room layout. */
export function getLockableSeatKeysForRoomMode(
  mode: RoomLayoutMode,
  multiGuestSeatCount?: MultiGuestSeatCount | number,
): RoomSeatKey[] {
  if (mode === 'MultiGuest') {
    return getMultiGuestActiveSeatKeys(resolveMultiGuestSeatCount(multiGuestSeatCount));
  }
  return getGuestSeatKeysForRoomMode(mode);
}

export function guestSeatGridClass(seatCount: number): string {
  if (seatCount <= 4) return 'grid-cols-4';
  if (seatCount === 6) return 'grid-cols-3';
  if (seatCount === 8) return 'grid-cols-4 sm:grid-cols-5';
  if (seatCount === 9) return 'grid-cols-3';
  if (seatCount === 12) return 'grid-cols-3 sm:grid-cols-5';
  if (seatCount === 12) return 'grid-cols-6';
  if (seatCount === 15) return 'grid-cols-3 sm:grid-cols-5';
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
  const seats: PartySeatMap = {
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
  for (const key of GUEST_SEAT_KEYS) {
    if (!(key in seats)) {
      seats[key] = null;
    }
  }
  return seats;
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
  const synced = syncSeatsReceiverStars(
    hydratePartySeats(roomId, settings, existing),
    roomId,
  ) as PartySeatMap;
  if (settings.roomMode === 'Multi-Guest') {
    return prunePartySeatsForMultiGuestCount(
      synced,
      resolveMultiGuestSeatCount(settings.multiGuestSeatCount),
    );
  }
  return synced;
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
  isSpeaking?: boolean;
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
      isSpeaking: input.isSpeaking ?? true,
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
