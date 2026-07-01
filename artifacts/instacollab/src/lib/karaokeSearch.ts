import { getAppOrigin } from './domains/uniapplab';
import type { KaraokeLibrarySong } from '../components/karaoke/karaokeTypes';
import { metaToLibrarySong, type KaraokeUploadedSongMeta } from './karaokeUploads';
import type { KaraokeCoverRecordingMeta } from './karaokeRecordings';

export type KaraokeSearchKind = 'catalog' | 'upload' | 'cover';

export type KaraokeSearchHit = {
  kind: KaraokeSearchKind;
  id: string;
  songId: string;
  title: string;
  artist: string;
  subtitle?: string;
  img?: string;
  recordingId?: string;
  isMine?: boolean;
  ownerUserId?: string;
  performerHandle?: string;
  catalogSong?: KaraokeLibrarySong;
  uploadMeta?: KaraokeUploadedSongMeta;
  coverMeta?: KaraokeCoverRecordingMeta;
};

export type KaraokeTrackRef = {
  kind: KaraokeSearchKind;
  id: string;
  songId: string;
  recordingId?: string;
};

export type KaraokeProfileTab =
  | 'covers'
  | 'duets'
  | 'playlists'
  | 'drafts'
  | 'rooms'
  | 'manage'
  | 'uploads';

export type KaraokeUrlParams = {
  tab?: string | null;
  profileTab?: KaraokeProfileTab | null;
  user?: string | null;
  track?: string | null;
  recording?: string | null;
};

const KARAOKE_TABS = new Set([
  'sing',
  'feed',
  'live',
  'party',
  'profile',
  'search',
  'challenge',
  'leaderboard',
  'messages',
  'notifications',
  'genres',
  'top100',
]);

const PROFILE_TABS = new Set<KaraokeProfileTab>([
  'covers',
  'duets',
  'playlists',
  'drafts',
  'rooms',
  'manage',
  'uploads',
]);

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

function matchesQuery(query: string, ...parts: (string | undefined)[]): boolean {
  if (!query) return false;
  return parts.some((part) => part?.toLowerCase().includes(query));
}

export function searchKaraokeCatalog(
  query: string,
  trending: KaraokeLibrarySong[],
  library: KaraokeLibrarySong[],
): KaraokeSearchHit[] {
  const q = normalizeQuery(query);
  if (!q) return [];

  const seen = new Set<string>();
  return [...trending, ...library]
    .filter((song) => !song.isUploaded)
    .filter((song) => {
      if (seen.has(song.id)) return false;
      const hit = matchesQuery(q, song.title, song.artist, song.category);
      if (hit) seen.add(song.id);
      return hit;
    })
    .map((song) => ({
      kind: 'catalog' as const,
      id: song.id,
      songId: song.id,
      title: song.title,
      artist: song.artist,
      subtitle: song.category || 'Catalog track',
      img: song.img,
      catalogSong: song,
    }));
}

function isOwnedByUser(ownerId: string | undefined, currentUserId: string): boolean {
  const viewer = currentUserId.trim();
  if (!ownerId || !viewer) return false;
  return ownerId === viewer;
}

export function searchKaraokeUploads(
  query: string,
  uploadMetas: KaraokeUploadedSongMeta[],
  currentUserId: string,
): KaraokeSearchHit[] {
  const q = normalizeQuery(query);
  if (!q) return [];

  return uploadMetas
    .filter((meta) =>
      matchesQuery(q, meta.title, meta.artist, meta.category, meta.tags),
    )
    .sort((a, b) => {
      const aMine = isOwnedByUser(a.ownerUserId, currentUserId) ? 1 : 0;
      const bMine = isOwnedByUser(b.ownerUserId, currentUserId) ? 1 : 0;
      if (aMine !== bMine) return bMine - aMine;
      return b.uploadedAt - a.uploadedAt;
    })
    .map((meta) => {
      const song = metaToLibrarySong(meta);
      const isMine = isOwnedByUser(meta.ownerUserId, currentUserId);
      return {
        kind: 'upload' as const,
        id: meta.id,
        songId: meta.id,
        title: meta.title,
        artist: meta.artist,
        subtitle: isMine ? 'Your upload · backing track' : 'Community upload · backing track',
        img: meta.img,
        isMine,
        ownerUserId: meta.ownerUserId,
        catalogSong: song,
        uploadMeta: meta,
      };
    });
}

export function searchKaraokeCovers(
  query: string,
  coverMetas: KaraokeCoverRecordingMeta[],
  currentUserId: string,
): KaraokeSearchHit[] {
  const q = normalizeQuery(query);
  if (!q) return [];

  return coverMetas
    .filter((meta) =>
      matchesQuery(
        q,
        meta.songTitle,
        meta.caption,
        meta.performers.map((performer) => performer.name).join(' '),
        meta.performers.map((performer) => performer.handle).join(' '),
      ),
    )
    .sort((a, b) => {
      const aMine = isOwnedByUser(a.performerUserId, currentUserId) ? 1 : 0;
      const bMine = isOwnedByUser(b.performerUserId, currentUserId) ? 1 : 0;
      if (aMine !== bMine) return bMine - aMine;
      return b.recordedAt - a.recordedAt;
    })
    .map((meta) => {
      const isMine = isOwnedByUser(meta.performerUserId, currentUserId);
      const performerHandle = meta.performers[0]?.handle || '@singer';
      return {
        kind: 'cover' as const,
        id: meta.id,
        songId: meta.songId,
        recordingId: meta.id,
        title: meta.songTitle,
        artist: meta.performers.map((performer) => performer.name).join(' & ') || 'Singer',
        subtitle: isMine
          ? meta.caption
            ? `Your cover · ${meta.caption}`
            : 'Your cover recording'
          : meta.caption
            ? `Cover by ${performerHandle} · ${meta.caption}`
            : `Cover by ${performerHandle}`,
        img: meta.img,
        isMine,
        ownerUserId: meta.performerUserId,
        performerHandle,
        coverMeta: meta,
      };
    });
}

export function searchKaraokeAll(
  query: string,
  options: {
    trending: KaraokeLibrarySong[];
    library: KaraokeLibrarySong[];
    uploadMetas: KaraokeUploadedSongMeta[];
    coverMetas: KaraokeCoverRecordingMeta[];
    currentUserId: string;
  },
): { catalog: KaraokeSearchHit[]; uploads: KaraokeSearchHit[]; covers: KaraokeSearchHit[] } {
  return {
    catalog: searchKaraokeCatalog(query, options.trending, options.library),
    uploads: searchKaraokeUploads(query, options.uploadMetas, options.currentUserId),
    covers: searchKaraokeCovers(query, options.coverMetas, options.currentUserId),
  };
}

export function karaokeSearchHitBadgeLabel(hit: KaraokeSearchHit): string {
  if (hit.isMine && hit.kind === 'upload') return 'Your Upload';
  if (hit.isMine && hit.kind === 'cover') return 'Your Cover';
  if (hit.kind === 'upload') return 'Upload';
  if (hit.kind === 'cover') return 'Cover';
  return 'Song';
}

export function resolveKaraokeTrackRef(
  trackId: string,
  options: {
    catalog: KaraokeLibrarySong[];
    uploads: KaraokeLibrarySong[];
    coverMetas: KaraokeCoverRecordingMeta[];
  },
): KaraokeTrackRef | null {
  const id = trackId.trim();
  if (!id) return null;

  const coverMeta = options.coverMetas.find((row) => row.id === id);
  if (coverMeta) {
    return { kind: 'cover', id, songId: coverMeta.songId, recordingId: coverMeta.id };
  }

  const upload = options.uploads.find((song) => song.id === id);
  if (upload) {
    return { kind: 'upload', id, songId: upload.id };
  }

  const catalog = options.catalog.find((song) => song.id === id);
  if (catalog) {
    return { kind: 'catalog', id, songId: catalog.id };
  }

  return null;
}

export function parseKaraokeUrlParams(search: string): KaraokeUrlParams {
  const params = new URLSearchParams(search);
  const profileTab = params.get('profileTab') as KaraokeProfileTab | null;
  return {
    tab: params.get('tab'),
    profileTab: profileTab && PROFILE_TABS.has(profileTab) ? profileTab : undefined,
    user: params.get('user'),
    track: params.get('track'),
    recording: params.get('recording'),
  };
}

export function syncKaraokeUrl(patch: KaraokeUrlParams, mode: 'replace' | 'push' = 'replace'): void {
  if (typeof window === 'undefined') return;

  const url = buildKaraokeShareUrl(patch, window.location.href);
  if (mode === 'push') {
    window.history.pushState({}, '', url);
  } else {
    window.history.replaceState({}, '', url);
  }
}

/** Build a shareable karaoke deep link without mutating browser history. */
export function buildKaraokeShareUrl(
  patch: KaraokeUrlParams,
  baseHref: string = typeof window !== 'undefined' ? window.location.href : `${getAppOrigin()}/karaoke`,
): string {
  const url = new URL(baseHref);
  const entries: [keyof KaraokeUrlParams, string | null | undefined][] = [
    ['tab', patch.tab],
    ['profileTab', patch.profileTab],
    ['user', patch.user],
    ['track', patch.track],
    ['recording', patch.recording],
  ];

  for (const [key, value] of entries) {
    if (value === undefined) continue;
    if (value === null || value === '') {
      url.searchParams.delete(key);
    } else {
      url.searchParams.set(key, value);
    }
  }

  return url.toString();
}

export function isKaraokeTab(value: string | null | undefined): value is string {
  return Boolean(value && KARAOKE_TABS.has(value));
}

const KARAOKE_STUDIO_OPEN_EVENT = 'karaoke-open-studio';

/** Shell Karaoke nav — always land on Studio (sing tab), not the last K-Star sub-tab. */
export function requestKaraokeStudioOpen(): void {
  syncKaraokeUrl({
    tab: 'sing',
    profileTab: null,
    user: null,
    track: null,
    recording: null,
  });

  const dispatch = () => {
    window.dispatchEvent(new CustomEvent(KARAOKE_STUDIO_OPEN_EVENT));
  };
  dispatch();
  requestAnimationFrame(() => requestAnimationFrame(dispatch));
}

export { KARAOKE_STUDIO_OPEN_EVENT };
