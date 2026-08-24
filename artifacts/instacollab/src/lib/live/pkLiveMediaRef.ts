/** LiveKit token surface. Never confuse with lifecycle roomId. */
export type PkMediaSurface = 'stream' | 'party';

export type PkLiveMediaRef = {
  /** LiveLifecycleService / PK snapshot room id. */
  lifecycleRoomId: string;
  /** LiveKit token target: streams.id or party_rooms.id (no prefix). */
  mediaId: string;
  surface: PkMediaSurface;
};

/**
 * Parse invite/discovery ids into lifecycle vs LiveKit targets.
 * `stream-{id}` / `api-stream-{id}` → stream token (`ic-stream-{id}`).
 * Bare party uuid → party token (`ic-party-{id}`).
 */
export function parsePkLiveMediaRef(raw: string | null | undefined): PkLiveMediaRef {
  const value = String(raw || '').trim();
  if (!value) return { lifecycleRoomId: '', mediaId: '', surface: 'party' };
  if (value.startsWith('api-stream-')) {
    const mediaId = value.slice('api-stream-'.length).trim();
    return { lifecycleRoomId: mediaId, mediaId, surface: 'stream' };
  }
  if (value.startsWith('stream-')) {
    const mediaId = value.slice('stream-'.length).trim();
    return { lifecycleRoomId: mediaId, mediaId, surface: 'stream' };
  }
  return { lifecycleRoomId: value, mediaId: value, surface: 'party' };
}

export function resolvePkMediaId(
  explicitMediaId: string | null | undefined,
  fallbackRoomId: string | null | undefined,
): string {
  const explicit = String(explicitMediaId || '').trim();
  if (explicit) return parsePkLiveMediaRef(explicit).mediaId || explicit;
  return parsePkLiveMediaRef(fallbackRoomId).mediaId;
}

export function resolvePkMediaSurface(
  explicit: PkMediaSurface | null | undefined,
  fallbackRoomId: string | null | undefined,
): PkMediaSurface {
  if (explicit === 'stream' || explicit === 'party') return explicit;
  return parsePkLiveMediaRef(fallbackRoomId).surface;
}
