import type { LiveKind, User } from '../types';
import { safeString } from './safe';
import type { RoomMode } from '../smule-rooms/utils/storage';

const LIVE_KINDS: LiveKind[] = [
  'solo',
  'audio-room',
  'video-multi',
  'pk',
  'party',
  'commerce',
  'game',
];

export const LIVE_KIND_LABELS: Record<LiveKind, string> = {
  solo: 'Solo',
  'audio-room': 'Audio',
  'video-multi': 'Multi',
  pk: 'PK',
  party: 'Party',
  commerce: 'Shop',
  game: 'Game',
};

/**
 * Party room settings mode for each live-ring kind.
 * `pk` is battle overlay on Solo/Shop only — never maps to Party rooms.
 */
export const LIVE_KIND_ROOM_MODE: Record<LiveKind, RoomMode> = {
  solo: 'Solo-Live',
  'audio-room': 'Chat',
  'video-multi': 'Multi-Guest',
  pk: 'Solo-Live',
  party: 'Party',
  commerce: 'Commerce-Live',
  game: 'Game-Live',
};

export function isLiveKind(value: unknown): value is LiveKind {
  return typeof value === 'string' && LIVE_KINDS.includes(value as LiveKind);
}

/** Live-ring kind for a party room settings mode (CreateRoom / Room). */
export function liveKindFromRoomMode(roomMode: string | undefined): LiveKind {
  const mode = String(roomMode || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-');
  switch (mode) {
    case 'solo-live':
    case 'sololive':
      return 'solo';
    case 'commerce-live':
    case 'commercelive':
      return 'commerce';
    case 'chat':
      return 'audio-room';
    case 'multi-guest':
    case 'multiguest':
      return 'video-multi';
    case 'party':
      return 'party';
    case 'radio':
      return 'game';
    case 'game-live':
    case 'gamelive':
      return 'game';
    case 'karaoke':
      return 'audio-room';
    case 'watchtogether':
    case 'watch-together':
      return 'video-multi';
    case 'chorus':
      return 'audio-room';
    default:
      return 'solo';
  }
}

export function roomModeFromLiveKind(liveKind: LiveKind | undefined): RoomMode {
  return LIVE_KIND_ROOM_MODE[liveKind && isLiveKind(liveKind) ? liveKind : 'solo'];
}

function canonicalRoomModeKey(roomMode: string | undefined): string {
  return String(roomMode || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-');
}

/**
 * Canonical storage / filter room mode for Live + karaoke + party lobbies.
 * Maps SoloLive → Solo-Live, WatchTogether → Radio, etc.
 */
export function normalizeStorageRoomMode(roomMode: string | undefined): RoomMode | string {
  const raw = String(roomMode || '').trim();
  if (!raw) return 'Karaoke';
  const lower = canonicalRoomModeKey(raw);
  if (lower === 'chat') return 'Chat';
  if (lower === 'radio' || lower === 'watchtogether' || lower === 'watch-together') return 'Radio';
  if (lower === 'sololive' || lower === 'solo-live') return 'Solo-Live';
  if (lower === 'commercelive' || lower === 'commerce-live') return 'Commerce-Live';
  if (lower === 'gamelive' || lower === 'game-live') return 'Game-Live';
  if (lower === 'multiguest' || lower === 'multi-guest') return 'Multi-Guest';
  if (lower === 'party') return 'Party';
  if (lower === 'chorus' || lower === 'karaoke') return 'Karaoke';
  if (
    raw === 'Solo-Live' ||
    raw === 'Multi-Guest' ||
    raw === 'Commerce-Live' ||
    raw === 'Game-Live' ||
    raw === 'Chat' ||
    raw === 'Party' ||
    raw === 'Radio' ||
    raw === 'Karaoke' ||
    raw === 'WatchTogether' ||
    raw === 'Chorus'
  ) {
    if (raw === 'WatchTogether' || raw === 'Chorus') return 'Karaoke';
    return raw;
  }
  return raw;
}

/** Room modes that show the host on the live ring / Live discovery while active. */
export function isLiveRingRoomMode(roomMode: string | undefined): boolean {
  const mode = canonicalRoomModeKey(roomMode);
  return (
    mode === 'solo-live' ||
    mode === 'sololive' ||
    mode === 'chat' ||
    mode === 'multi-guest' ||
    mode === 'multiguest' ||
    mode === 'party' ||
    mode === 'radio' ||
    mode === 'game-live' ||
    mode === 'gamelive' ||
    mode === 'commerce-live' ||
    mode === 'commercelive' ||
    mode === 'karaoke' ||
    mode === 'watchtogether' ||
    mode === 'watch-together' ||
    mode === 'chorus'
  );
}

/** Any active party room is joinable from Live discovery (viewer watch). */
export function isDiscoverableLiveRoomMode(roomMode: string | undefined): boolean {
  const mode = String(roomMode || '').trim();
  if (!mode) return true;
  return isLiveRingRoomMode(mode);
}

export function resolveLiveKind(
  status: User['status'] | undefined,
  liveKind: User['liveKind'] | undefined
): LiveKind | undefined {
  if (status !== 'live') return undefined;
  return isLiveKind(liveKind) ? liveKind : 'solo';
}

export function getLiveRingClasses(liveKind: LiveKind | undefined): {
  glow: string;
  spinner: string;
} {
  const kind = liveKind ?? 'solo';
  if (kind === 'solo') {
    return {
      glow: 'avatar-ring-glow--live',
      spinner: 'avatar-ring-spinner--live',
    };
  }
  return {
    glow: `avatar-ring-glow--live-${kind}`,
    spinner: `avatar-ring-spinner--live-${kind}`,
  };
}

export function safeLiveKind(
  value: unknown,
  status?: User['status']
): LiveKind | undefined {
  if (status !== 'live') return undefined;
  const s = safeString(value);
  return isLiveKind(s) ? s : 'solo';
}

/**
 * Active PK in the live feed requires both:
 * - a `pk` tag, and
 * - Solo-Live / Commerce-Live room mode (tag or room_mode).
 * Bare profile `live_kind=pk` or Party rooms never qualify.
 */
export function isActivePkFeedSignal(
  tags: readonly string[] | null | undefined,
  roomMode?: string,
): boolean {
  const list = Array.isArray(tags) ? tags : [];
  const hasPkTag = list.some((tag) => String(tag).trim().toLowerCase() === 'pk');
  if (!hasPkTag) return false;

  const modeKey = String(roomMode || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-');
  if (modeKey === 'solo-live' || modeKey === 'sololive' || modeKey === 'commerce-live' || modeKey === 'commercelive') {
    return true;
  }

  return list.some((tag) => {
    const t = String(tag).trim().toLowerCase().replace(/[\s_]+/g, '-');
    return t === 'solo-live' || t === 'commerce-live';
  });
}

/**
 * Discovery live kind from cloud tags + room mode.
 * Party rooms never surface as PK. `pk` only with active Solo/Shop battle signal.
 */
export function discoveryLiveKindFromTags(
  tags: readonly string[] | null | undefined,
  roomMode?: string,
): LiveKind {
  const list = Array.isArray(tags) ? tags : [];
  const fromMode = liveKindFromRoomMode(roomMode);
  if (fromMode === 'party') return 'party';
  if (isActivePkFeedSignal(list, roomMode)) return 'pk';

  for (const tag of list) {
    if (isLiveKind(tag) && tag !== 'pk') return tag;
  }
  // Never promote bare/stale `pk` into the feed.
  return fromMode === 'pk' ? 'solo' : fromMode;
}

/** Live presence kind while an eligible Solo/Shop stream has an *active* PK battle. */
export function liveKindForPkPresence(
  baseRoomMode: string | undefined,
  pkPhase: 'idle' | 'inviting' | 'active' | 'ended' | string | null | undefined,
): LiveKind {
  const base = liveKindFromRoomMode(baseRoomMode);
  // Party and other modes never publish as PK.
  if (base !== 'solo' && base !== 'commerce') return base;
  // Feed only surfaces PK once the battle has started — not invite/connected.
  if (pkPhase === 'active') return 'pk';
  return base;
}
