import { lookupUserIdByDisplayName } from './roomUserLookup';

export type RoomGiftEvent = {
  id: string;
  senderName: string;
  receiverName: string;
  giftName: string;
  giftIcon: string;
  starValue: number;
  at: number;
};

export type RoomGiftState = {
  totalStars: number;
  todayStars: number;
  todayDate: string;
  giftCount: number;
  recentGifts: RoomGiftEvent[];
  /** Cumulative gift stars received per display name (persists across seat changes). */
  receiverStars: Record<string, number>;
};

export type RoomGiftSummary = {
  totalStars: number;
  todayStars: number;
  giftCount: number;
};

export type PartyGiftDefinition = {
  name: string;
  icon: string;
  stars: number;
};

export const PARTY_GIFT_CATALOG: PartyGiftDefinition[] = [
  { name: 'Rose', icon: '🌹', stars: 5 },
  { name: 'Heart', icon: '💖', stars: 10 },
  { name: 'Mic', icon: '🎤', stars: 25 },
  { name: 'Star', icon: '⭐', stars: 50 },
  { name: 'Crown', icon: '👑', stars: 100 },
  { name: 'Rocket', icon: '🚀', stars: 250 },
];

const ROOM_GIFTS_PREFIX = 'roomGifts:';
const GLOBAL_RECEIVER_STARS_KEY = 'roomGifts:globalReceiverStars';
const GLOBAL_RECEIVER_STARS_MIGRATED_KEY = 'roomGifts:_globalReceiverStarsMigratedV1';
const MAX_RECENT_GIFTS = 40;

const DEMO_RECEIVER_STARS: Record<string, Record<string, number>> = {
  '1181033': {
    '♡tcsp ツ Ms❀Sanny...': 9,
    Helenal: 0,
    '❅ ✨ C-Captbebs...': 4,
    '➳ᴹᴿ Nikk ℘': 2,
    '♡Tcsp ツ Ms❀Sosina...': 2,
    'G cf ⚜️ Ｍ Ｒ Ｍ Ａ...': 4,
    'captain 🤵 ghe': 2,
    '✨ ➢ Mildred_365...': 0,
    '🥀 🎙️ SUNGIT 🎙️ 🥀': 0,
  },
};

const DEMO_SEEDS: Record<string, Partial<RoomGiftState>> = {
  '1181033': {
    totalStars: 26_479,
    todayStars: 312,
    giftCount: 1842,
    receiverStars: DEMO_RECEIVER_STARS['1181033'],
  },
  '1167298': {
    totalStars: 9_044,
    todayStars: 48,
    giftCount: 620,
  },
};

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function defaultReceiverStars(roomId: string): Record<string, number> {
  return { ...(DEMO_RECEIVER_STARS[roomId] ?? {}) };
}

function defaultState(roomId: string): RoomGiftState {
  const seed = DEMO_SEEDS[roomId];
  const today = todayKey();
  return {
    totalStars: seed?.totalStars ?? 0,
    todayStars: seed?.todayStars ?? 0,
    todayDate: today,
    giftCount: seed?.giftCount ?? 0,
    recentGifts: [],
    receiverStars: seed?.receiverStars ?? defaultReceiverStars(roomId),
  };
}

function resetTodayIfNeeded(state: RoomGiftState): RoomGiftState {
  const today = todayKey();
  if (state.todayDate === today) return state;
  return {
    ...state,
    todayDate: today,
    todayStars: 0,
  };
}

function readRoomGiftState(roomId: string): RoomGiftState {
  try {
    const raw = localStorage.getItem(`${ROOM_GIFTS_PREFIX}${roomId}`);
    if (!raw) return resetTodayIfNeeded(defaultState(roomId));
    const parsed = JSON.parse(raw) as Partial<RoomGiftState>;
    const defaults = defaultState(roomId);
    const parsedReceiverStars =
      parsed.receiverStars && typeof parsed.receiverStars === 'object'
        ? parsed.receiverStars
        : undefined;
    return resetTodayIfNeeded({
      ...defaults,
      ...parsed,
      recentGifts: Array.isArray(parsed.recentGifts) ? parsed.recentGifts : [],
      todayDate: parsed.todayDate ?? todayKey(),
      receiverStars: {
        ...defaults.receiverStars,
        ...(parsedReceiverStars ?? {}),
      },
    });
  } catch {
    return resetTodayIfNeeded(defaultState(roomId));
  }
}

function writeRoomGiftState(roomId: string, state: RoomGiftState): void {
  localStorage.setItem(`${ROOM_GIFTS_PREFIX}${roomId}`, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent('room-gifts-updated', { detail: { roomId } }));
}

function normalizeReceiverNameKey(name: string): string {
  return name.trim().toLowerCase();
}

function resolveReceiverKey(receiverName: string, receiverUserId?: string): string | null {
  const userId = receiverUserId?.trim();
  if (userId) return `user:${userId}`;
  const nameKey = normalizeReceiverNameKey(receiverName);
  if (!nameKey) return null;
  return `name:${nameKey}`;
}

function readGlobalReceiverStars(): Record<string, number> {
  try {
    const raw = localStorage.getItem(GLOBAL_RECEIVER_STARS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as Record<string, number>;
  } catch {
    return {};
  }
}

function writeGlobalReceiverStars(state: Record<string, number>): void {
  localStorage.setItem(GLOBAL_RECEIVER_STARS_KEY, JSON.stringify(state));
}

function listPersistedRoomGiftIds(): string[] {
  if (typeof localStorage === 'undefined') return [];
  const roomIds: string[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const storageKey = localStorage.key(index);
    if (!storageKey?.startsWith(ROOM_GIFTS_PREFIX)) continue;
    const roomId = storageKey.slice(ROOM_GIFTS_PREFIX.length);
    if (
      roomId === 'globalReceiverStars' ||
      roomId.startsWith('_')
    ) {
      continue;
    }
    roomIds.push(roomId);
  }
  return roomIds;
}

function readGlobalReceiverStarsForReceiver(
  receiverName: string,
  receiverUserId?: string,
): number {
  const global = readGlobalReceiverStars();
  const userKey = resolveReceiverKey(receiverName, receiverUserId);
  if (userKey && typeof global[userKey] === 'number') {
    return global[userKey];
  }
  const nameKey = resolveReceiverKey(receiverName);
  if (nameKey && typeof global[nameKey] === 'number') {
    return global[nameKey];
  }
  return 0;
}

/**
 * One-time backfill: merge per-room receiver totals into the global receiver store.
 * Safe to call repeatedly — guarded by a migration flag.
 */
export function migrateGlobalReceiverStarsFromRoomHistory(): boolean {
  if (typeof localStorage === 'undefined') return false;
  if (localStorage.getItem(GLOBAL_RECEIVER_STARS_MIGRATED_KEY)) return false;

  const aggregatedByName = new Map<string, number>();
  const roomIds = new Set([
    ...listPersistedRoomGiftIds(),
    ...Object.keys(DEMO_RECEIVER_STARS),
    ...Object.keys(DEMO_SEEDS),
  ]);

  for (const roomId of roomIds) {
    const state = readRoomGiftState(roomId);
    for (const [receiverName, stars] of Object.entries(state.receiverStars)) {
      if (!receiverName || typeof stars !== 'number' || stars <= 0) continue;
      const nameKey = normalizeReceiverNameKey(receiverName);
      if (!nameKey) continue;
      aggregatedByName.set(nameKey, (aggregatedByName.get(nameKey) ?? 0) + stars);
    }
  }

  const global = readGlobalReceiverStars();
  let changed = false;

  for (const [nameKey, localTotal] of aggregatedByName) {
    const globalNameKey = `name:${nameKey}`;
    const nextTotal = Math.max(global[globalNameKey] ?? 0, localTotal);
    if (nextTotal !== (global[globalNameKey] ?? 0)) {
      global[globalNameKey] = nextTotal;
      changed = true;
    }

    const displayName = nameKey;
    const userId = lookupUserIdByDisplayName(displayName);
    if (userId) {
      const userKey = `user:${userId}`;
      const nextUserTotal = Math.max(global[userKey] ?? 0, nextTotal);
      if (nextUserTotal !== (global[userKey] ?? 0)) {
        global[userKey] = nextUserTotal;
        changed = true;
      }
    }
  }

  if (changed) {
    writeGlobalReceiverStars(global);
    window.dispatchEvent(new CustomEvent('room-gifts-updated', { detail: { roomId: '*' } }));
  }

  localStorage.setItem(GLOBAL_RECEIVER_STARS_MIGRATED_KEY, '1');
  return changed;
}

export function ensureGlobalReceiverStarsMigrated(): void {
  migrateGlobalReceiverStarsFromRoomHistory();
}

export function getRoomGiftState(roomId: string): RoomGiftState {
  return readRoomGiftState(roomId);
}

export function getRoomGiftSummary(roomId: string): RoomGiftSummary {
  const state = readRoomGiftState(roomId);
  return {
    totalStars: state.totalStars,
    todayStars: state.todayStars,
    giftCount: state.giftCount,
  };
}

export type RecordRoomGiftInput = {
  senderName: string;
  receiverName: string;
  receiverUserId?: string;
  giftName: string;
  giftIcon: string;
  starValue: number;
};

export type RecordRoomGiftResult = {
  granted: number;
  summary: RoomGiftSummary;
  event: RoomGiftEvent;
  /** Receiver's cumulative gift stars after this grant. */
  receiverStarsTotal: number;
};

export function getReceiverGiftStars(
  roomId: string,
  receiverName: string,
  receiverUserId?: string,
): number {
  if (!receiverName) return 0;
  const globalStars = readGlobalReceiverStarsForReceiver(receiverName, receiverUserId);
  if (globalStars > 0) return globalStars;

  const state = readRoomGiftState(roomId);
  return state.receiverStars[receiverName] ?? 0;
}

export function syncSeatsReceiverStars(
  seats: Record<string, { userId?: string; name: string; stars: number } | null | undefined>,
  roomId: string,
): Record<string, { userId?: string; name: string; stars: number } | null | undefined> {
  const next: Record<string, { userId?: string; name: string; stars: number } | null | undefined> = {
    ...seats,
  };
  for (const key of Object.keys(next)) {
    const guest = next[key];
    if (guest) {
      next[key] = {
        ...guest,
        stars: getReceiverGiftStars(roomId, guest.name, guest.userId),
      };
    }
  }
  return next;
}

export function recordRoomGift(roomId: string, input: RecordRoomGiftInput): RecordRoomGiftResult {
  const starValue = Math.max(0, Math.floor(input.starValue));
  const state = readRoomGiftState(roomId);

  if (starValue <= 0) {
    const emptyEvent: RoomGiftEvent = {
      id: `gift_${Date.now()}`,
      senderName: input.senderName,
      receiverName: input.receiverName,
      giftName: input.giftName,
      giftIcon: input.giftIcon,
      starValue: 0,
      at: Date.now(),
    };
    return {
      granted: 0,
      summary: getRoomGiftSummary(roomId),
      event: emptyEvent,
      receiverStarsTotal: getReceiverGiftStars(roomId, input.receiverName, input.receiverUserId),
    };
  }

  const event: RoomGiftEvent = {
    id: `gift_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    senderName: input.senderName,
    receiverName: input.receiverName,
    giftName: input.giftName,
    giftIcon: input.giftIcon,
    starValue,
    at: Date.now(),
  };

  const receiverStarsTotal = (state.receiverStars[input.receiverName] ?? 0) + starValue;
  const receiverKey = resolveReceiverKey(input.receiverName, input.receiverUserId);
  let globalReceiverStarsTotal = receiverStarsTotal;
  if (receiverKey) {
    const global = readGlobalReceiverStars();
    globalReceiverStarsTotal = (global[receiverKey] ?? 0) + starValue;
    global[receiverKey] = globalReceiverStarsTotal;
    writeGlobalReceiverStars(global);
  }
  const next: RoomGiftState = {
    ...state,
    totalStars: state.totalStars + starValue,
    todayStars: state.todayStars + starValue,
    giftCount: state.giftCount + 1,
    recentGifts: [event, ...state.recentGifts].slice(0, MAX_RECENT_GIFTS),
    receiverStars: {
      ...state.receiverStars,
      [input.receiverName]: receiverStarsTotal,
    },
  };

  writeRoomGiftState(roomId, next);

  return {
    granted: starValue,
    summary: {
      totalStars: next.totalStars,
      todayStars: next.todayStars,
      giftCount: next.giftCount,
    },
    event,
    receiverStarsTotal: receiverKey ? globalReceiverStarsTotal : receiverStarsTotal,
  };
}

export function initRoomGifts(roomId: string, seed?: Partial<RoomGiftState>): void {
  ensureGlobalReceiverStarsMigrated();
  const key = `${ROOM_GIFTS_PREFIX}${roomId}`;
  if (localStorage.getItem(key)) return;
  writeRoomGiftState(roomId, resetTodayIfNeeded({ ...defaultState(roomId), ...seed }));
}
