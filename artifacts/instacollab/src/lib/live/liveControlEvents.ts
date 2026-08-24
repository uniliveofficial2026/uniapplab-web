/** Cross-surface live teardown. PK overlay and Room share this instead of a hidden LiveKit data event. */
export const LIVE_ROOM_ENDED_EVENT = 'unilives-live-ended';

export function signalLiveRoomEnded(roomId: string): void {
  const id = roomId.trim();
  if (!id || typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(LIVE_ROOM_ENDED_EVENT, { detail: { roomId: id } }));
}

export function liveRoomEndedDetail(event: Event): string | null {
  const roomId = (event as CustomEvent<{ roomId?: string }>).detail?.roomId;
  return typeof roomId === 'string' && roomId.trim() ? roomId.trim() : null;
}
