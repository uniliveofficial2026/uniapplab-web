export type RoomExpSource = 'free-empty' | 'free-seated' | 'gold';

export type RoomExpState = {
  totalExp: number;
  todayExp: number;
  todayDate: string;
  /** Free EXP while the room is live with nobody seated (max 500/day). */
  todayEmptyRoomFreeExp: number;
  /** Free EXP while at least one guest is seated (max 1000/day). */
  todaySeatedFreeExp: number;
  todayGoldExp: number;
};

/** Daily EXP target shown in UI (1500 free + 3500 gold under normal play). */
export const DAILY_ROOM_EXP_CAP = 5000;

/** Total free EXP cap (empty + seated). */
export const DAILY_FREE_EXP_CAP = 1500;

/** Free EXP while nobody is seated in the room. */
export const DAILY_EMPTY_ROOM_FREE_CAP = 500;

/** Free EXP while guests are seated in the room. */
export const DAILY_SEATED_FREE_CAP = 1000;

/** Gift EXP target for the day; gifts can push total EXP beyond this and the 5000 target. */
export const DAILY_GOLD_EXP_CAP = 3500;

/** Live party grants 1 EXP per second while the room is active. */
export const FREE_EXP_PER_SECOND = 1;

/** Cumulative total EXP required to reach each level (index 0 = level 1 start). */
export const LEVEL_START_TOTAL_EXP = [
  0,
  5_000,
  15_000,
  50_000,
  200_000,
  450_000,
  750_000,
  1_150_000,
] as const;

export type RoomExpProgress = {
  level: number;
  totalExp: number;
  expInLevel: number;
  expToNextLevel: number;
  nextLevel: number;
  levelProgressPercent: number;
  todayExp: number;
  todayFreeExp: number;
  todayEmptyRoomFreeExp: number;
  todaySeatedFreeExp: number;
  todayGoldExp: number;
  dailyCap: number;
  dailyFreeCap: number;
  dailyEmptyRoomFreeCap: number;
  dailySeatedFreeCap: number;
  dailyGoldCap: number;
  todayRemaining: number;
  todayFreeRemaining: number;
  todayEmptyRoomFreeRemaining: number;
  todaySeatedFreeRemaining: number;
  todayGoldRemaining: number;
  /** True when gift activity pushed today's EXP past the 5000 daily target. */
  todayOverDailyTarget: boolean;
  /** EXP earned today beyond the 5000 daily target (from extra gifts). */
  todayBonusExp: number;
};

const ROOM_EXP_PREFIX = 'roomExp:';

const DEMO_SEEDS: Record<string, Partial<RoomExpState>> = {
  '1181033': {
    totalExp: 65_137,
    todayExp: 22,
    todayEmptyRoomFreeExp: 22,
    todaySeatedFreeExp: 0,
    todayGoldExp: 0,
  },
  '1167298': {
    totalExp: 33_500,
    todayEmptyRoomFreeExp: 500,
    todaySeatedFreeExp: 1000,
    todayGoldExp: 0,
  },
};

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function migrateLegacyFreeBuckets(
  parsed: Partial<RoomExpState> & { todayFreeExp?: number },
): Pick<
  RoomExpState,
  'todayEmptyRoomFreeExp' | 'todaySeatedFreeExp'
> {
  if (
    parsed.todayEmptyRoomFreeExp !== undefined ||
    parsed.todaySeatedFreeExp !== undefined
  ) {
    return {
      todayEmptyRoomFreeExp: parsed.todayEmptyRoomFreeExp ?? 0,
      todaySeatedFreeExp: parsed.todaySeatedFreeExp ?? 0,
    };
  }

  const legacyFree = parsed.todayFreeExp ?? 0;
  const seated = Math.min(legacyFree, DAILY_SEATED_FREE_CAP);
  const empty = Math.min(Math.max(0, legacyFree - seated), DAILY_EMPTY_ROOM_FREE_CAP);
  return { todayEmptyRoomFreeExp: empty, todaySeatedFreeExp: seated };
}

function defaultState(roomId: string): RoomExpState {
  const seed = DEMO_SEEDS[roomId];
  const today = todayKey();
  return normalizeTodayBuckets({
    totalExp: seed?.totalExp ?? 0,
    todayExp: seed?.todayExp ?? 0,
    todayDate: today,
    todayEmptyRoomFreeExp: seed?.todayEmptyRoomFreeExp ?? 0,
    todaySeatedFreeExp: seed?.todaySeatedFreeExp ?? 0,
    todayGoldExp: seed?.todayGoldExp ?? 0,
  });
}

function normalizeTodayBuckets(state: RoomExpState): RoomExpState {
  const todayEmptyRoomFreeExp = Math.min(
    Math.max(0, state.todayEmptyRoomFreeExp),
    DAILY_EMPTY_ROOM_FREE_CAP,
  );
  const todaySeatedFreeExp = Math.min(
    Math.max(0, state.todaySeatedFreeExp),
    DAILY_SEATED_FREE_CAP,
  );
  const todayGoldExp = Math.max(0, state.todayGoldExp);
  const todayExp = todayEmptyRoomFreeExp + todaySeatedFreeExp + todayGoldExp;
  return {
    ...state,
    todayEmptyRoomFreeExp,
    todaySeatedFreeExp,
    todayGoldExp,
    todayExp,
  };
}

function resetTodayIfNeeded(state: RoomExpState): RoomExpState {
  const today = todayKey();
  if (state.todayDate === today) return normalizeTodayBuckets(state);
  return normalizeTodayBuckets({
    ...state,
    todayDate: today,
    todayExp: 0,
    todayEmptyRoomFreeExp: 0,
    todaySeatedFreeExp: 0,
    todayGoldExp: 0,
  });
}

function readRoomExpState(roomId: string): RoomExpState {
  try {
    const raw = localStorage.getItem(`${ROOM_EXP_PREFIX}${roomId}`);
    if (!raw) return resetTodayIfNeeded(defaultState(roomId));
    const parsed = JSON.parse(raw) as Partial<RoomExpState> & { todayFreeExp?: number };
    const migratedFree = migrateLegacyFreeBuckets(parsed);
    return resetTodayIfNeeded(
      normalizeTodayBuckets({
        ...defaultState(roomId),
        ...parsed,
        ...migratedFree,
        todayDate: parsed.todayDate ?? todayKey(),
      }),
    );
  } catch {
    return resetTodayIfNeeded(defaultState(roomId));
  }
}

function writeRoomExpState(roomId: string, state: RoomExpState): void {
  localStorage.setItem(`${ROOM_EXP_PREFIX}${roomId}`, JSON.stringify(normalizeTodayBuckets(state)));
  window.dispatchEvent(new CustomEvent('room-exp-updated', { detail: { roomId } }));
}

export function getRoomExpState(roomId: string): RoomExpState {
  return readRoomExpState(roomId);
}

export function getRoomLevel(totalExp: number): number {
  let level = 1;
  for (let i = LEVEL_START_TOTAL_EXP.length - 1; i >= 0; i--) {
    if (totalExp >= LEVEL_START_TOTAL_EXP[i]) {
      level = i + 1;
      break;
    }
  }
  return level;
}

export function getRoomExpProgress(roomId: string): RoomExpProgress {
  const state = readRoomExpState(roomId);
  const level = getRoomLevel(state.totalExp);
  const levelStart = LEVEL_START_TOTAL_EXP[level - 1] ?? 0;
  const nextStart = LEVEL_START_TOTAL_EXP[level] ?? levelStart + 150_000;
  const expInLevel = state.totalExp - levelStart;
  const expToNextLevel = nextStart - levelStart;
  const levelProgressPercent =
    expToNextLevel > 0 ? Math.min(100, (expInLevel / expToNextLevel) * 100) : 100;
  const todayFreeExp = state.todayEmptyRoomFreeExp + state.todaySeatedFreeExp;

  return {
    level,
    totalExp: state.totalExp,
    expInLevel,
    expToNextLevel,
    nextLevel: level + 1,
    levelProgressPercent,
    todayExp: state.todayExp,
    todayFreeExp,
    todayEmptyRoomFreeExp: state.todayEmptyRoomFreeExp,
    todaySeatedFreeExp: state.todaySeatedFreeExp,
    todayGoldExp: state.todayGoldExp,
    dailyCap: DAILY_ROOM_EXP_CAP,
    dailyFreeCap: DAILY_FREE_EXP_CAP,
    dailyEmptyRoomFreeCap: DAILY_EMPTY_ROOM_FREE_CAP,
    dailySeatedFreeCap: DAILY_SEATED_FREE_CAP,
    dailyGoldCap: DAILY_GOLD_EXP_CAP,
    todayRemaining: Math.max(0, DAILY_ROOM_EXP_CAP - Math.min(state.todayExp, DAILY_ROOM_EXP_CAP)),
    todayFreeRemaining: Math.max(0, DAILY_FREE_EXP_CAP - todayFreeExp),
    todayEmptyRoomFreeRemaining: Math.max(
      0,
      DAILY_EMPTY_ROOM_FREE_CAP - state.todayEmptyRoomFreeExp,
    ),
    todaySeatedFreeRemaining: Math.max(0, DAILY_SEATED_FREE_CAP - state.todaySeatedFreeExp),
    todayGoldRemaining: Math.max(0, DAILY_GOLD_EXP_CAP - state.todayGoldExp),
    todayOverDailyTarget: state.todayExp > DAILY_ROOM_EXP_CAP,
    todayBonusExp: Math.max(0, state.todayExp - DAILY_ROOM_EXP_CAP),
  };
}

/** Map gift star value received in-room to gold EXP (not capped; can exceed daily targets). */
export function goldExpFromGiftStars(starValue: number): number {
  return Math.max(1, Math.floor(starValue / 2));
}

export type GrantRoomExpResult = {
  granted: number;
  progress: RoomExpProgress;
};

function freeBucketCap(source: Extract<RoomExpSource, 'free-empty' | 'free-seated'>): number {
  return source === 'free-empty' ? DAILY_EMPTY_ROOM_FREE_CAP : DAILY_SEATED_FREE_CAP;
}

function freeBucketValue(
  state: RoomExpState,
  source: Extract<RoomExpSource, 'free-empty' | 'free-seated'>,
): number {
  return source === 'free-empty' ? state.todayEmptyRoomFreeExp : state.todaySeatedFreeExp;
}

export function grantRoomExp(
  roomId: string,
  amount: number,
  source: RoomExpSource = 'free-empty',
): GrantRoomExpResult {
  if (amount <= 0) {
    return { granted: 0, progress: getRoomExpProgress(roomId) };
  }

  let state = readRoomExpState(roomId);

  let roomDailyGrant = 0;
  if (source === 'free-empty' || source === 'free-seated') {
    const cap = freeBucketCap(source);
    const bucketValue = freeBucketValue(state, source);
    const freeRemaining = cap - bucketValue;
    if (freeRemaining <= 0) {
      return { granted: 0, progress: getRoomExpProgress(roomId) };
    }
    roomDailyGrant = Math.min(amount, freeRemaining);
  } else {
    // Gift EXP has no daily ceiling — heavy gifting can push today past the 5000 target.
    roomDailyGrant = amount;
  }

  if (roomDailyGrant <= 0) {
    return { granted: 0, progress: getRoomExpProgress(roomId) };
  }

  const nextEmpty =
    source === 'free-empty'
      ? state.todayEmptyRoomFreeExp + roomDailyGrant
      : state.todayEmptyRoomFreeExp;
  const nextSeated =
    source === 'free-seated'
      ? state.todaySeatedFreeExp + roomDailyGrant
      : state.todaySeatedFreeExp;
  const nextGold =
    source === 'gold' ? state.todayGoldExp + roomDailyGrant : state.todayGoldExp;

  state = normalizeTodayBuckets({
    ...state,
    totalExp: state.totalExp + roomDailyGrant,
    todayEmptyRoomFreeExp: nextEmpty,
    todaySeatedFreeExp: nextSeated,
    todayGoldExp: nextGold,
  });

  writeRoomExpState(roomId, state);
  return { granted: roomDailyGrant, progress: getRoomExpProgress(roomId) };
}

/** Ensure a room has persisted EXP state (e.g. after create). Does not overwrite existing data. */
export function initRoomExp(roomId: string, seed?: Partial<RoomExpState>): void {
  const key = `${ROOM_EXP_PREFIX}${roomId}`;
  if (localStorage.getItem(key)) return;
  writeRoomExpState(roomId, resetTodayIfNeeded({ ...defaultState(roomId), ...seed }));
}
