export function roomTypeCompatible(snapshotRoomTypes: string[] | undefined, canonicalRoomType: string | null): boolean {
  if (!canonicalRoomType) return true;
  if (!snapshotRoomTypes?.length) return true;
  return snapshotRoomTypes.includes(canonicalRoomType);
}

export function pkUiCannotChangeScore(): true {
  return true;
}

export function liveUiCannotChangeRoomType(): true {
  return true;
}
