import { CROSS_ROOM_PK_ENABLED } from './pkCrossRoom';

export type PendingCrossRoomPk = {
  opponentRoomId: string;
  opponentRoomMode: string;
  opponentUserId: string;
  opponentName: string;
  opponentAvatarUrl?: string;
};

const STORAGE_KEY = 'pendingCrossRoomPk';

export function setPendingCrossRoomPk(challenge: PendingCrossRoomPk): void {
  if (!CROSS_ROOM_PK_ENABLED) return;
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(challenge));
}

export function consumePendingCrossRoomPk(): PendingCrossRoomPk | null {
  if (!CROSS_ROOM_PK_ENABLED) return null;
  if (typeof sessionStorage === 'undefined') return null;
  const raw = sessionStorage.getItem(STORAGE_KEY);
  sessionStorage.removeItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PendingCrossRoomPk;
    if (!parsed?.opponentRoomId || !parsed?.opponentUserId) return null;
    return parsed;
  } catch {
    return null;
  }
}
