/** Stable epoch when cloud rows omit note_updated_at — still replays animation per unique text. */
export function thoughtNoteEpoch(note: string | undefined, noteUpdatedAt?: number): number {
  const trimmed = (note ?? '').trim();
  if (!trimmed) return 0;
  if (typeof noteUpdatedAt === 'number' && Number.isFinite(noteUpdatedAt) && noteUpdatedAt > 0) {
    return noteUpdatedAt;
  }
  let hash = 0;
  for (let i = 0; i < trimmed.length; i += 1) {
    hash = (hash * 31 + trimmed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) || 1;
}

export function thoughtAnimationKey(
  userId: string,
  note: string | undefined,
  noteUpdatedAt?: number,
  replayNonce = 0,
): string {
  const epoch = thoughtNoteEpoch(note, noteUpdatedAt);
  const trimmed = (note ?? '').trim();
  return `${userId}:${epoch}:${trimmed.length}:${replayNonce}`;
}
