/**
 * Livestream adapter — LiveKit primary; TRTC behind adapter for existing surfaces.
 */
import type { LivestreamProviderId } from '../../types/platform';

export type LivestreamAdapter = {
  id: LivestreamProviderId;
  label: string;
  available: boolean;
  note: string;
};

const ADAPTERS: Record<LivestreamProviderId, LivestreamAdapter> = {
  livekit: {
    id: 'livekit',
    label: 'LiveKit',
    available: true,
    note: 'Canonical A/V transport — Edge livekit tokens + livekit-client.',
  },
  trtc: {
    id: 'trtc',
    label: 'Tencent TRTC',
    available: true,
    note: 'Existing TRTC / WebAR camera pipelines remain available via adapter.',
  },
};

export function listLivestreamAdapters(): LivestreamProviderId[] {
  return Object.keys(ADAPTERS) as LivestreamProviderId[];
}

export function getLivestreamAdapter(id: LivestreamProviderId): LivestreamAdapter {
  return ADAPTERS[id] ?? ADAPTERS.livekit;
}

export function getPrimaryLivestreamAdapter(): LivestreamAdapter {
  return ADAPTERS.livekit;
}
