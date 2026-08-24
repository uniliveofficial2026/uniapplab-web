let localOpenRoomId: string | null = null;

export function setPkLocalSessionOpen(roomId: string | null): void {
  localOpenRoomId = roomId?.trim() || null;
}

export function getPkLocalSessionOpen(): string | null {
  return localOpenRoomId;
}

export function isPkLocalSessionOpen(roomId: string | null | undefined): boolean {
  if (!roomId || !localOpenRoomId) return false;
  return localOpenRoomId === roomId.trim();
}
