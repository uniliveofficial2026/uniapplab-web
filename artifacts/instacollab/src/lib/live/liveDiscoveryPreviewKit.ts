import { RoomEvent, Track, type RemoteTrack, type Room } from 'livekit-client';
import { isLiveKitConfigured } from '../livekit/livekitConfig';
import { canAttemptLiveKit, connectWithTokenFetcher } from '../livekit/liveKitInstant';
import {
  fetchLiveKitToken,
  fetchPartyLiveKitToken,
  isPlatformApiAvailable,
} from '../platformApi';
import { acquireLivePreviewSlot } from './liveDiscoveryVideoPool';

export type LiveDiscoveryConnectTarget = {
  partyRoomId?: string;
  streamId?: string;
  hostUserId?: string;
};

export function pickDiscoveryVideoTrack(
  room: Room,
  hostUserId?: string,
): RemoteTrack | null {
  const participants = [...room.remoteParticipants.values()];
  const ordered = hostUserId
    ? [
        ...participants.filter((p) => p.identity?.trim() === hostUserId),
        ...participants.filter((p) => p.identity?.trim() !== hostUserId),
      ]
    : participants;

  for (const participant of ordered) {
    for (const publication of participant.videoTrackPublications.values()) {
      const track = publication.track;
      if (track && track.kind === Track.Kind.Video && !publication.isMuted) {
        return track;
      }
    }
  }
  return null;
}

export function roomHasLiveAudio(room: Room, hostUserId?: string): boolean {
  for (const participant of room.remoteParticipants.values()) {
    if (hostUserId && participant.identity?.trim() !== hostUserId) continue;
    for (const publication of participant.audioTrackPublications.values()) {
      if (publication.track && !publication.isMuted) return true;
    }
  }
  return false;
}

type ConnectDiscoveryPreviewOptions = {
  target: LiveDiscoveryConnectTarget;
  onVideoTrack: (track: RemoteTrack | null) => void;
  onAudioLive?: (live: boolean) => void;
  isCancelled?: () => boolean;
  timeoutMs?: number;
};

/**
 * Subscribe to a party room or legacy stream for discovery grid previews.
 * Retries once; polls for late-published host video (WebAR / camera warm-up).
 */
export async function connectDiscoveryPreview(
  options: ConnectDiscoveryPreviewOptions,
): Promise<(() => void) | null> {
  const { target, onVideoTrack, onAudioLive, isCancelled, timeoutMs = 5_500 } = options;
  const { partyRoomId, streamId, hostUserId } = target;

  if (
    !canAttemptLiveKit() ||
    !isLiveKitConfigured() ||
    !isPlatformApiAvailable() ||
    !partyRoomId && !streamId
  ) {
    return null;
  }

  const releaseSlot = await acquireLivePreviewSlot(isCancelled);
  if (!releaseSlot || isCancelled?.()) {
    releaseSlot?.();
    return null;
  }

  let room: Room | null = null;
  let attached: RemoteTrack | null = null;
  let pollTimer: number | null = null;
  let retryTimer: number | null = null;
  let cancelled = false;

  const cleanup = () => {
    cancelled = true;
    if (pollTimer != null) window.clearInterval(pollTimer);
    if (retryTimer != null) window.clearTimeout(retryTimer);
    pollTimer = null;
    retryTimer = null;
    onVideoTrack(null);
    onAudioLive?.(false);
    try {
      room?.disconnect();
    } catch {
      /* ignore */
    }
    room = null;
    attached = null;
    releaseSlot();
  };

  const sync = (liveRoom: Room) => {
    if (cancelled) return;
    const next = pickDiscoveryVideoTrack(liveRoom, hostUserId);
    if (next !== attached) {
      attached = next;
      onVideoTrack(next);
    }
    onAudioLive?.(roomHasLiveAudio(liveRoom, hostUserId));
  };

  const bindRoom = (liveRoom: Room) => {
    room = liveRoom;
    const onChange = () => sync(liveRoom);
    liveRoom.on(RoomEvent.TrackSubscribed, (track) => {
      if (track.kind === Track.Kind.Video || track.kind === Track.Kind.Audio) onChange();
    });
    liveRoom.on(RoomEvent.TrackUnsubscribed, onChange);
    liveRoom.on(RoomEvent.TrackMuted, onChange);
    liveRoom.on(RoomEvent.TrackUnmuted, onChange);
    liveRoom.on(RoomEvent.ParticipantConnected, onChange);
    liveRoom.on(RoomEvent.ParticipantDisconnected, onChange);
    liveRoom.on(RoomEvent.Disconnected, () => {
      if (!cancelled) {
        onVideoTrack(null);
        onAudioLive?.(false);
      }
    });
    sync(liveRoom);
    pollTimer = window.setInterval(() => sync(liveRoom), 1_200);
  };

  const attemptConnect = async (): Promise<boolean> => {
    const result = await connectWithTokenFetcher(
      () =>
        partyRoomId
          ? fetchPartyLiveKitToken(partyRoomId, false)
          : fetchLiveKitToken(streamId!, 'viewer'),
      {
        timeoutMs,
        onDisconnected: () => {
          if (!cancelled) {
            onVideoTrack(null);
            onAudioLive?.(false);
          }
        },
      },
    );
    if (cancelled) {
      if (result.ok) void result.room.disconnect();
      return false;
    }
    if (!result.ok) return false;
    bindRoom(result.room);
    return true;
  };

  void (async () => {
    const ok = await attemptConnect();
    if (!ok && !cancelled) {
      retryTimer = window.setTimeout(() => {
        void attemptConnect();
      }, 2_000);
    }
  })();

  return cleanup;
}
