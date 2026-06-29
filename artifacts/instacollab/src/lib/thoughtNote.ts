/** Max characters for avatar thought bubbles / notes. */
export const THOUGHT_NOTE_MAX_LENGTH = 500;

export function patchUserThoughtNote(note: string): { note: string; noteUpdatedAt?: number } {
  const trimmed = note.trim();
  if (!trimmed) {
    return { note: '', noteUpdatedAt: undefined };
  }
  return { note: trimmed, noteUpdatedAt: Date.now() };
}
