import { resolveRoomCoverUrl } from './roomMedia';
import { getRoomSettings, saveRoomSettings, type RoomSettings } from './storage';
import {
  deleteWatchTogetherUpload,
  loadWatchTogetherUpload,
  saveWatchTogetherUpload,
} from './watchTogetherMediaStorage';

/** Short public-domain sample used when the room has no custom stream URL yet. */
export const WATCH_TOGETHER_DEMO_STREAM =
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';

/** Persisted settings value when playback comes from an uploaded file in IndexedDB. */
export const WATCH_TOGETHER_UPLOAD_MARKER = '__watch_together_upload__';

export type WatchTogetherMediaKind = 'video' | 'audio';

export type WatchTogetherMedia = {
  posterUrl: string;
  streamUrl: string;
  kind: WatchTogetherMediaKind;
  isCustom: boolean;
  fileName?: string;
  isHydrating?: boolean;
};

const AUDIO_EXTENSIONS = /\.(mp3|m4a|aac|ogg|wav|flac|opus|webm)(\?|$)/i;
const VIDEO_EXTENSIONS = /\.(mp4|webm|mov|m4v|ogv|mkv|avi)(\?|$)/i;

type BlobPlaybackCache = {
  objectUrl: string;
  kind: WatchTogetherMediaKind;
  fileName?: string;
};

const blobPlaybackCache = new Map<string, BlobPlaybackCache>();

export function inferWatchTogetherMediaKind(url: string): WatchTogetherMediaKind {
  if (url.startsWith('data:audio/')) return 'audio';
  if (url.startsWith('data:video/')) return 'video';
  if (AUDIO_EXTENSIONS.test(url)) return 'audio';
  if (VIDEO_EXTENSIONS.test(url)) return 'video';
  return 'video';
}

export function inferWatchTogetherMediaKindFromFile(file: File): WatchTogetherMediaKind {
  if (file.type.startsWith('audio/')) return 'audio';
  if (file.type.startsWith('video/')) return 'video';
  return inferWatchTogetherMediaKind(file.name);
}

export function normalizeWatchTogetherMediaUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return trimmed;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return trimmed;
    }
  } catch {
    return null;
  }
  return null;
}

function revokeBlobPlaybackUrl(roomId: string): void {
  const cached = blobPlaybackCache.get(roomId);
  if (cached) {
    URL.revokeObjectURL(cached.objectUrl);
    blobPlaybackCache.delete(roomId);
  }
}

function cacheBlobPlaybackUrl(
  roomId: string,
  file: Blob,
  kind: WatchTogetherMediaKind,
  fileName?: string,
): string {
  revokeBlobPlaybackUrl(roomId);
  const objectUrl = URL.createObjectURL(file);
  blobPlaybackCache.set(roomId, { objectUrl, kind, fileName });
  return objectUrl;
}

function getCachedBlobPlayback(roomId: string): BlobPlaybackCache | null {
  return blobPlaybackCache.get(roomId) ?? null;
}

export function isWatchTogetherUploadMarker(value: string | undefined): boolean {
  return value?.trim() === WATCH_TOGETHER_UPLOAD_MARKER;
}

export function resolveWatchTogetherStreamUrl(
  settings: Pick<RoomSettings, 'watchTogetherMediaUrl' | 'watchTogetherMediaFileName'>,
  roomId: string,
): { streamUrl: string; isCustom: boolean; kind?: WatchTogetherMediaKind; fileName?: string; isHydrating?: boolean } {
  const custom = settings.watchTogetherMediaUrl?.trim();

  if (isWatchTogetherUploadMarker(custom)) {
    const cached = getCachedBlobPlayback(roomId);
    if (cached) {
      return {
        streamUrl: cached.objectUrl,
        isCustom: true,
        kind: cached.kind,
        fileName: cached.fileName ?? settings.watchTogetherMediaFileName,
      };
    }
    return {
      streamUrl: '',
      isCustom: true,
      isHydrating: true,
      fileName: settings.watchTogetherMediaFileName,
    };
  }

  if (custom) {
    return {
      streamUrl: custom,
      isCustom: true,
      kind: inferWatchTogetherMediaKind(custom),
    };
  }

  return { streamUrl: WATCH_TOGETHER_DEMO_STREAM, isCustom: false };
}

export function resolveWatchTogetherMedia(
  settings: Pick<RoomSettings, 'coverPhoto' | 'roomName' | 'watchTogetherMediaUrl' | 'watchTogetherMediaFileName'>,
  roomId: string,
): WatchTogetherMedia {
  const resolved = resolveWatchTogetherStreamUrl(settings, roomId);
  const kind = resolved.kind ?? inferWatchTogetherMediaKind(resolved.streamUrl || WATCH_TOGETHER_DEMO_STREAM);
  const streamUrl = resolved.streamUrl || (resolved.isHydrating ? '' : WATCH_TOGETHER_DEMO_STREAM);

  return {
    posterUrl: resolveRoomCoverUrl(settings.coverPhoto, roomId, settings.roomName),
    streamUrl,
    kind,
    isCustom: resolved.isCustom,
    fileName: resolved.fileName,
    isHydrating: resolved.isHydrating,
  };
}

export function formatWatchTogetherDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function describeWatchTogetherMediaSource(
  streamUrl: string,
  isCustom: boolean,
  fileName?: string,
): string {
  if (!isCustom) return 'Demo stream';
  if (fileName) return fileName;
  if (!streamUrl) return 'Uploaded file';
  if (streamUrl.startsWith('blob:')) return 'Uploaded file';
  if (streamUrl.startsWith('data:')) return 'Uploaded file';
  try {
    const host = new URL(streamUrl).hostname;
    return host || 'Custom URL';
  } catch {
    return 'Custom media';
  }
}

export type WatchTogetherMediaUpdateDetail = {
  roomId: string;
  media: WatchTogetherMedia;
};

/** Read resolved playback payload for a room from persisted settings. */
export function getWatchTogetherMediaForRoom(roomId: string): WatchTogetherMedia {
  return resolveWatchTogetherMedia(getRoomSettings(roomId), roomId);
}

function emitWatchTogetherMediaUpdated(roomId: string, media: WatchTogetherMedia): void {
  window.dispatchEvent(
    new CustomEvent<WatchTogetherMediaUpdateDetail>('watch-together-media-updated', {
      detail: { roomId, media },
    }),
  );
}

function buildAndEmitRoomMedia(roomId: string): WatchTogetherMedia {
  const media = resolveWatchTogetherMedia(getRoomSettings(roomId), roomId);
  emitWatchTogetherMediaUpdated(roomId, media);
  return media;
}

/** Load uploaded media from IndexedDB into an in-memory blob URL for playback. */
export async function hydrateWatchTogetherMedia(roomId: string): Promise<WatchTogetherMedia | null> {
  const settings = getRoomSettings(roomId);
  if (!isWatchTogetherUploadMarker(settings.watchTogetherMediaUrl)) {
    return null;
  }

  if (getCachedBlobPlayback(roomId)) {
    const media = resolveWatchTogetherMedia(settings, roomId);
    emitWatchTogetherMediaUpdated(roomId, media);
    return media;
  }

  const stored = await loadWatchTogetherUpload(roomId);
  if (!stored) {
    saveRoomSettings(roomId, { watchTogetherMediaUrl: '', watchTogetherMediaFileName: undefined });
    const media = resolveWatchTogetherMedia(getRoomSettings(roomId), roomId);
    emitWatchTogetherMediaUpdated(roomId, media);
    return media;
  }

  cacheBlobPlaybackUrl(roomId, stored.blob, stored.kind, stored.fileName);
  saveRoomSettings(roomId, { watchTogetherMediaFileName: stored.fileName });
  const media = resolveWatchTogetherMedia(getRoomSettings(roomId), roomId);
  emitWatchTogetherMediaUpdated(roomId, media);
  return media;
}

/** Persist a hosted URL and broadcast to all room listeners. */
export function setWatchTogetherMediaUrl(roomId: string, url: string): WatchTogetherMedia {
  const normalized = normalizeWatchTogetherMediaUrl(url);
  if (!normalized) {
    throw new Error('Invalid media URL');
  }

  void deleteWatchTogetherUpload(roomId);
  revokeBlobPlaybackUrl(roomId);

  saveRoomSettings(roomId, {
    watchTogetherMediaUrl: normalized,
    watchTogetherMediaFileName: undefined,
  });
  return buildAndEmitRoomMedia(roomId);
}

/** Persist an uploaded file (any size) and broadcast to all room listeners. */
export async function setWatchTogetherMediaFile(
  roomId: string,
  file: File,
): Promise<WatchTogetherMedia> {
  const kind = inferWatchTogetherMediaKindFromFile(file);
  await saveWatchTogetherUpload(roomId, file, kind);
  cacheBlobPlaybackUrl(roomId, file, kind, file.name);

  saveRoomSettings(roomId, {
    watchTogetherMediaUrl: WATCH_TOGETHER_UPLOAD_MARKER,
    watchTogetherMediaFileName: file.name,
  });
  return buildAndEmitRoomMedia(roomId);
}

/** Clear custom media and fall back to the demo stream. */
export function clearWatchTogetherMediaUrl(roomId: string): WatchTogetherMedia {
  void deleteWatchTogetherUpload(roomId);
  revokeBlobPlaybackUrl(roomId);
  saveRoomSettings(roomId, {
    watchTogetherMediaUrl: '',
    watchTogetherMediaFileName: undefined,
  });
  return buildAndEmitRoomMedia(roomId);
}
