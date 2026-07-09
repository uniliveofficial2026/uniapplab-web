import type { LiveKind } from '../../types';
import type { RoomFlowEntry } from '../../smule-rooms/context/RoomFlowContext';
import type { RoomMode } from '../../smule-rooms/utils/storage';

export type PendingLiveRoomOpen = {
  path: string;
  roomId: string;
  entry: RoomFlowEntry;
  asViewer: boolean;
  hostUserId?: string;
  hostName?: string;
  roomName?: string;
  roomMode?: RoomMode | string;
  liveKind?: LiveKind;
};

const STORAGE_KEY = 'pendingLiveRoomOpen';

export function stashPendingLiveRoomOpen(detail: PendingLiveRoomOpen): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(detail));
  } catch {
    /* ignore */
  }
}

export function peekPendingLiveRoomOpen(): PendingLiveRoomOpen | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PendingLiveRoomOpen;
  } catch {
    return null;
  }
}

export function consumePendingLiveRoomOpen(): PendingLiveRoomOpen | null {
  const detail = peekPendingLiveRoomOpen();
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  return detail;
}

export function dispatchRoomsLiveOpen(detail: PendingLiveRoomOpen): void {
  window.dispatchEvent(
    new CustomEvent('rooms-live-open', {
      detail,
    }),
  );
}
