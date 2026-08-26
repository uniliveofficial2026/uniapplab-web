/**
 * DEBUG-only Mac/viewer remote camera diagnostics.
 * Safe metadata + WebRTC/LiveKit receiver stats — no frames or secrets.
 */
import type { RemoteTrack, Room } from '../rtc/livekitCompatibilityBoundary';
import { Track } from '../rtc/livekitCompatibilityBoundary';
import { hashId } from '../camera/cameraSwitchTrace';

export type RemoteCameraViewerDiag = {
  at: number;
  roomIdHash?: string;
  hostIdentityHash?: string;
  publicationSid?: string;
  remoteTrackIdHash?: string;
  remoteReadyState?: string;
  remoteMuted?: boolean;
  framesDecoded?: number;
  framesReceived?: number;
  frameWidth?: number;
  frameHeight?: number;
  packetsReceived?: number;
  bytesReceived?: number;
  audioBytesReceived?: number;
  audioPacketsReceived?: number;
  audioMuted?: boolean;
};

type RemoteDiagWindow = Window & {
  __UNILIVE_REMOTE_CAMERA_DEBUG__?: RemoteCameraViewerDiag;
  __UNILIVE_REMOTE_CAMERA_HISTORY__?: RemoteCameraViewerDiag[];
};

function readNumeric(row: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return undefined;
}

async function readReceiverStats(
  track: { getReceiverStats?: () => Promise<unknown> } | null | undefined,
): Promise<Record<string, unknown> | null> {
  if (!track || typeof track.getReceiverStats !== 'function') return null;
  try {
    const stats = await track.getReceiverStats();
    if (stats && typeof stats === 'object') return stats as Record<string, unknown>;
  } catch {
    /* optional */
  }
  return null;
}

function publishDiag(diag: RemoteCameraViewerDiag): void {
  if (typeof window === 'undefined') return;
  try {
    const w = window as RemoteDiagWindow;
    w.__UNILIVE_REMOTE_CAMERA_DEBUG__ = diag;
    const hist = Array.isArray(w.__UNILIVE_REMOTE_CAMERA_HISTORY__)
      ? w.__UNILIVE_REMOTE_CAMERA_HISTORY__
      : [];
    hist.push(diag);
    while (hist.length > 60) hist.shift();
    w.__UNILIVE_REMOTE_CAMERA_HISTORY__ = hist;
    console.info('[RemoteCamera]', diag);
  } catch {
    /* ignore */
  }
}

/**
 * Snapshot remote host video (+ optional audio) stats for the active LiveKit room.
 */
export async function snapshotRemoteCameraDiagnostics(options: {
  room: Room | null | undefined;
  roomId?: string;
  preferIdentity?: string;
}): Promise<RemoteCameraViewerDiag | null> {
  const room = options.room;
  if (!room) return null;

  let chosen: {
    identity: string;
    track: RemoteTrack;
    publicationSid?: string;
  } | null = null;

  for (const participant of room.remoteParticipants.values()) {
    const identity = participant.identity?.trim();
    if (!identity) continue;
    if (options.preferIdentity && identity !== options.preferIdentity) continue;
    const publication = Array.from(participant.videoTrackPublications.values()).find(
      (entry) => entry.track && entry.track.kind === Track.Kind.Video,
    );
    const track = publication?.track;
    if (!track) continue;
    chosen = {
      identity,
      track,
      publicationSid:
        typeof publication?.trackSid === 'string' ? publication.trackSid : undefined,
    };
    if (!options.preferIdentity) break;
  }

  if (!chosen && options.preferIdentity) {
    // Fallback: any remote video if preferred host not found yet
    return snapshotRemoteCameraDiagnostics({ room, roomId: options.roomId });
  }
  if (!chosen) {
    const empty: RemoteCameraViewerDiag = {
      at: Date.now(),
      roomIdHash: hashId(options.roomId),
    };
    publishDiag(empty);
    return empty;
  }

  const media = chosen.track.mediaStreamTrack;
  const videoStats = await readReceiverStats(
    chosen.track as { getReceiverStats?: () => Promise<unknown> },
  );

  let audioBytesReceived: number | undefined;
  let audioPacketsReceived: number | undefined;
  let audioMuted: boolean | undefined;
  for (const participant of room.remoteParticipants.values()) {
    if (participant.identity?.trim() !== chosen.identity) continue;
    const audioPub = Array.from(participant.audioTrackPublications.values()).find(
      (entry) => entry.track,
    );
    if (!audioPub?.track) continue;
    audioMuted = Boolean(audioPub.isMuted);
    const audioStats = await readReceiverStats(
      audioPub.track as { getReceiverStats?: () => Promise<unknown> },
    );
    if (audioStats) {
      audioBytesReceived = readNumeric(audioStats, ['bytesReceived']);
      audioPacketsReceived = readNumeric(audioStats, ['packetsReceived']);
    }
  }

  const diag: RemoteCameraViewerDiag = {
    at: Date.now(),
    roomIdHash: hashId(options.roomId),
    hostIdentityHash: hashId(chosen.identity),
    publicationSid: chosen.publicationSid,
    remoteTrackIdHash: hashId(media?.id),
    remoteReadyState: media?.readyState,
    remoteMuted: media?.muted,
    framesDecoded: videoStats ? readNumeric(videoStats, ['framesDecoded']) : undefined,
    framesReceived: videoStats ? readNumeric(videoStats, ['framesReceived']) : undefined,
    frameWidth: videoStats ? readNumeric(videoStats, ['frameWidth', 'width']) : undefined,
    frameHeight: videoStats ? readNumeric(videoStats, ['frameHeight', 'height']) : undefined,
    packetsReceived: videoStats ? readNumeric(videoStats, ['packetsReceived']) : undefined,
    bytesReceived: videoStats ? readNumeric(videoStats, ['bytesReceived']) : undefined,
    audioBytesReceived,
    audioPacketsReceived,
    audioMuted,
  };
  publishDiag(diag);
  return diag;
}

/** Poll remote diagnostics while a viewer is connected. */
export function startRemoteCameraDiagnosticsPolling(options: {
  getRoom: () => Room | null | undefined;
  roomId?: string;
  intervalMs?: number;
}): () => void {
  const intervalMs = options.intervalMs ?? 1500;
  let cancelled = false;
  const tick = () => {
    if (cancelled) return;
    void snapshotRemoteCameraDiagnostics({
      room: options.getRoom(),
      roomId: options.roomId,
    }).finally(() => {
      if (!cancelled) {
        timer = setTimeout(tick, intervalMs);
      }
    });
  };
  let timer: ReturnType<typeof setTimeout> | null = setTimeout(tick, 400);
  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
    timer = null;
  };
}
