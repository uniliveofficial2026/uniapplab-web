import type { LiveKind, User } from '../types';
import { safeString } from './safe';

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

export function isLiveKind(value: unknown): value is LiveKind {
  return typeof value === 'string' && LIVE_KINDS.includes(value as LiveKind);
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
