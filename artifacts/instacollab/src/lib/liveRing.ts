import type { LiveKind, User } from '../types';
import { safeString } from './safe';
import type { RoomMode } from '../smule-rooms/utils/storage';

const LIVE_KINDS: LiveKind[] = [
  'solo',
  'audio-room',
  'video-multi',
  'pk',
  'commerce',
  'game',
];

export const LIVE_KIND_LABELS: Record<LiveKind, string> = {
  solo: 'Solo',
  'audio-room': 'Audio',
  'video-multi': 'Multi',
  pk: 'PK',
  commerce: 'Shop',
  game: 'Game',
};

/** Party room settings mode for each live-ring kind. */
export const LIVE_KIND_ROOM_MODE: Record<LiveKind, RoomMode> = {
  solo: 'Solo-Live',
  'audio-room': 'Chat',
  'video-multi': 'Multi-Guest',
  pk: 'Party',
  commerce: 'Commerce-Live',
  game: 'Game-Live',
};

export function isLiveKind(value: unknown): value is LiveKind {
  return typeof value === 'string' && LIVE_KINDS.includes(value as LiveKind);
}

/** Live-ring kind for a party room settings mode (CreateRoom / Room). */
export function liveKindFromRoomMode(roomMode: string | undefined): LiveKind {
  switch (String(roomMode || '').trim()) {
    case 'Solo-Live':
      return 'solo';
    case 'Commerce-Live':
      return 'commerce';
    case 'Chat':
      return 'audio-room';
    case 'Multi-Guest':
      return 'video-multi';
    case 'Party':
      return 'pk';
    case 'Radio':
      return 'game';
    case 'Game-Live':
      return 'game';
    case 'Karaoke':
      return 'audio-room';
    case 'WatchTogether':
      return 'video-multi';
    case 'Chorus':
      return 'audio-room';
    default:
      return 'solo';
  }
}

export function roomModeFromLiveKind(liveKind: LiveKind | undefined): RoomMode {
  return LIVE_KIND_ROOM_MODE[liveKind && isLiveKind(liveKind) ? liveKind : 'solo'];
}

/** Room modes that show the host on the live ring / Live discovery while active. */
export function isLiveRingRoomMode(roomMode: string | undefined): boolean {
  const mode = String(roomMode || '').trim();
  return (
    mode === 'Solo-Live' ||
    mode === 'Chat' ||
    mode === 'Multi-Guest' ||
    mode === 'Party' ||
    mode === 'Radio' ||
    mode === 'Game-Live' ||
    mode === 'Commerce-Live' ||
    mode === 'Karaoke' ||
    mode === 'WatchTogether' ||
    mode === 'Chorus'
  );
}

/** Any active party room is joinable from Live discovery (viewer watch). */
export function isDiscoverableLiveRoomMode(roomMode: string | undefined): boolean {
  const mode = String(roomMode || '').trim();
  if (!mode) return true;
  return isLiveRingRoomMode(mode) || mode === 'Karaoke' || mode === 'WatchTogether' || mode === 'Chorus';
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
