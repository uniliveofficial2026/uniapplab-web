/** True when URL points at uploaded / remote audio bytes (not a display label). */
export function isPlayableAudioUrl(value: unknown): boolean {
  if (typeof value !== 'string' || !value.trim()) return false;
  const url = value.trim();
  if (url.startsWith('data:audio/') || url.startsWith('blob:')) return true;
  if (url.startsWith('app-media:')) return true;
  if (/^https?:\/\//i.test(url) && /\.(mp3|wav|ogg|aac|m4a|flac|webm)(\?|$)/i.test(url)) {
    return true;
  }
  return false;
}

export function isAudioFile(file: File): boolean {
  if (file.type.startsWith('audio/')) return true;
  return /\.(mp3|wav|ogg|aac|m4a|flac|webm)$/i.test(file.name);
}

/** Editor-uploaded soundtrack on image/video/reel (not the primary audio carousel item). */
export function resolveEditorSoundtrackUrl(
  audioUrl: string | undefined,
  primaryMediaType: 'image' | 'video' | 'audio'
): string | undefined {
  if (primaryMediaType === 'audio') return undefined;
  if (!audioUrl) return undefined;
  return isPlayableAudioUrl(audioUrl) ? audioUrl.trim() : undefined;
}
