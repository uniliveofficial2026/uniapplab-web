import { ConnectionQuality, type Room } from '../rtc/livekitCompatibilityBoundary';
import { getActiveHostLiveKitRoom } from './hostLiveKitRoom';
import { ingestNetworkQoESample } from '../rtc/networkQoEGovernor';

export type HostLiveKitTelemetry = {
  connectionState: string;
  connectionQuality: string;
  uploadBitrate: number | null;
  framesPerSecond: number | null;
  packetLoss: number | null;
  roundTripTime: number | null;
};

/** Module-level delta state so cumulative bytesSent is never treated as instantaneous bitrate. */
const bitrateDeltaByTrack = new Map<string, { bytes: number; atMs: number }>();

function qualityLabel(quality: ConnectionQuality): string {
  switch (quality) {
    case ConnectionQuality.Excellent:
      return 'excellent';
    case ConnectionQuality.Good:
      return 'good';
    case ConnectionQuality.Poor:
      return 'poor';
    case ConnectionQuality.Lost:
      return 'lost';
    default:
      return 'unknown';
  }
}

function readNumeric(row: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return null;
}

async function readTrackStats(
  track: { getSenderStats?: () => Promise<unknown> } | null | undefined,
): Promise<Record<string, unknown>[]> {
  if (!track || typeof track.getSenderStats !== 'function') return [];
  try {
    const stats = await track.getSenderStats();
    if (Array.isArray(stats)) return stats as Record<string, unknown>[];
    if (stats && typeof stats === 'object') return [stats as Record<string, unknown>];
  } catch {
    /* sender stats are optional */
  }
  return [];
}

export async function readHostLiveKitTelemetry(roomId?: string): Promise<HostLiveKitTelemetry | null> {
  const room: Room | null = getActiveHostLiveKitRoom(roomId);
  if (!room) return null;
  const participant = room.localParticipant;
  let uploadBitrate: number | null = null;
  let framesPerSecond: number | null = null;
  let packetLoss: number | null = null;
  let roundTripTime: number | null = null;
  let availableBandwidth: number | null = null;

  const publications = [
    ...participant.videoTrackPublications.values(),
    ...participant.audioTrackPublications.values(),
  ];
  const now = Date.now();
  for (const publication of publications) {
    const trackKey = String(publication.trackSid || publication.trackName || publication.track?.sid || 'local');
    const rows = await readTrackStats(publication.track as { getSenderStats?: () => Promise<unknown> } | undefined);
    for (const row of rows) {
      const explicitBitrate = readNumeric(row, ['bitrate', 'targetBitrate', 'availableOutgoingBitrate']);
      if (explicitBitrate != null && explicitBitrate > 0) {
        uploadBitrate = Math.round(explicitBitrate);
      } else {
        const bytesSent = readNumeric(row, ['bytesSent']);
        if (bytesSent != null) {
          const prev = bitrateDeltaByTrack.get(trackKey);
          if (prev && now > prev.atMs) {
            const deltaBytes = Math.max(0, bytesSent - prev.bytes);
            const deltaSec = (now - prev.atMs) / 1000;
            if (deltaSec > 0) {
              uploadBitrate = Math.round((deltaBytes * 8) / deltaSec);
            }
          }
          bitrateDeltaByTrack.set(trackKey, { bytes: bytesSent, atMs: now });
        }
      }
      const bw = readNumeric(row, ['availableOutgoingBitrate']);
      if (bw != null && bw > 0) availableBandwidth = Math.round(bw);
      const fps = readNumeric(row, ['framesPerSecond', 'fps', 'frameRate']);
      if (fps != null) framesPerSecond = Math.round(fps);
      const lost = readNumeric(row, ['packetsLost', 'packetLoss', 'fractionLost']);
      if (lost != null) packetLoss = lost <= 1 ? Math.round(lost * 1000) / 10 : Math.round(lost);
      const rtt = readNumeric(row, ['roundTripTime', 'rtt', 'currentRoundTripTime']);
      if (rtt != null) roundTripTime = rtt < 10 ? Math.round(rtt * 1000) : Math.round(rtt);
    }
  }

  const connectionQuality = qualityLabel(participant.connectionQuality);
  const connectionState = String(room.state || 'unknown');
  ingestNetworkQoESample({
    atMs: now,
    bitrateBps: uploadBitrate,
    availableBandwidthBps: availableBandwidth,
    rttMs: roundTripTime,
    packetLossPct: packetLoss,
    connectionQuality,
    reconnecting: connectionState.toLowerCase().includes('reconnect'),
  });

  return {
    connectionState,
    connectionQuality,
    uploadBitrate,
    framesPerSecond,
    packetLoss,
    roundTripTime,
  };
}
