import { useEffect, useRef, useState } from 'react';
import {
  ConnectionState,
  LocalVideoTrack,
  RemoteTrack,
  Room,
  RoomEvent,
  Track,
  createLocalAudioTrack,
} from 'livekit-client';
import { isLiveKitConfigured } from '../../lib/livekit/livekitConfig';
import { canAttemptLiveKit, connectWithTokenFetcher } from '../../lib/livekit/liveKitInstant';
import { fetchPartyLiveKitToken } from '../../lib/platformApi';
import { resolveRoomMemberIdentity } from '../utils/roomMemberProfile';

type UseMultiGuestLiveKitOptions = {
  roomId: string;
  active: boolean;
  /** When this changes, disconnect and reconnect LiveKit (Solo Live ↔ Multi-Guest). */
  sessionMode?: string;
  canPublish: boolean;
  publishVideo: boolean;
  publishMic: boolean;
  /** Shared camera track from useMultiGuestCameraEffects */
  cameraTrack: MediaStreamTrack | null;
};

export type MultiGuestLiveKitState = {
  configured: boolean;
  connected: boolean;
  remoteVideoByUserId: ReadonlyMap<string, RemoteTrack>;
  activeSpeakerUserIds: ReadonlySet<string>;
};

async function publishOrReplaceCameraTrack(room: Room, track: MediaStreamTrack): Promise<void> {
  const publication = room.localParticipant.getTrackPublication(Track.Source.Camera);
  const localTrack = publication?.track;

  if (localTrack instanceof LocalVideoTrack) {
    if (localTrack.mediaStreamTrack?.id !== track.id) {
      await localTrack.replaceTrack(track);
    }
    return;
  }

  await room.localParticipant.publishTrack(track, {
    source: Track.Source.Camera,
    simulcast: false,
  });
}

async function unpublishCameraTrack(room: Room): Promise<void> {
  const publication = room.localParticipant.getTrackPublication(Track.Source.Camera);
  if (publication?.track) {
    await room.localParticipant.unpublishTrack(publication.track);
  }
}

/**
 * LiveKit A/V for Solo Live + Multi-Guest.
 * Avatars/local camera paint first; all viewers subscribe in background;
 * seated users publish camera (+ mic when unmuted). Timed connect + retry.
 */
export function useMultiGuestLiveKit({
  roomId,
  active,
  sessionMode = 'default',
  canPublish,
  publishVideo,
  publishMic,
  cameraTrack,
}: UseMultiGuestLiveKitOptions): MultiGuestLiveKitState {
  const configured = isLiveKitConfigured();
  const roomRef = useRef<Room | null>(null);
  const publishedVideoTrackIdRef = useRef<string | null>(null);
  const localAudioTrackRef = useRef<Awaited<ReturnType<typeof createLocalAudioTrack>> | null>(null);
  const [connected, setConnected] = useState(false);
  const [remoteVideoByUserId, setRemoteVideoByUserId] = useState<Map<string, RemoteTrack>>(new Map());
  const [activeSpeakerUserIds, setActiveSpeakerUserIds] = useState<Set<string>>(new Set());

  const syncRemoteVideos = (room: Room) => {
    const next = new Map<string, RemoteTrack>();
    for (const participant of room.remoteParticipants.values()) {
      const identity = participant.identity?.trim();
      if (!identity) continue;
      const publication = Array.from(participant.videoTrackPublications.values()).find(
        (entry) => entry.track && !entry.isMuted,
      );
      const track = publication?.track;
      if (track && track.kind === Track.Kind.Video) {
        next.set(identity, track);
      }
    }
    setRemoteVideoByUserId(next);
  };

  useEffect(() => {
    if (!configured || !active || !roomId) {
      setConnected(false);
      setRemoteVideoByUserId(new Map());
      setActiveSpeakerUserIds(new Set());
      return undefined;
    }

    if (!canAttemptLiveKit()) {
      setConnected(false);
      return undefined;
    }

    let cancelled = false;
    let retryTimer: number | null = null;

    const bindRoom = (room: Room) => {
      roomRef.current = room;

      const onVideoChange = () => syncRemoteVideos(room);

      room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        if (track.kind === Track.Kind.Audio) {
          const el = track.attach();
          void el.play().catch(() => {});
          void publication;
          void participant;
          return;
        }
        if (track.kind !== Track.Kind.Video) return;
        const identity = participant.identity?.trim();
        if (!identity) return;
        setRemoteVideoByUserId((prev) => {
          const next = new Map(prev);
          next.set(identity, track);
          return next;
        });
        void publication;
      });

      room.on(RoomEvent.TrackUnsubscribed, (track, _publication, participant) => {
        if (track.kind !== Track.Kind.Video) return;
        const identity = participant.identity?.trim();
        if (!identity) return;
        setRemoteVideoByUserId((prev) => {
          if (!prev.has(identity)) return prev;
          const next = new Map(prev);
          next.delete(identity);
          return next;
        });
      });

      room.on(RoomEvent.ParticipantDisconnected, onVideoChange);
      room.on(RoomEvent.TrackMuted, onVideoChange);
      room.on(RoomEvent.TrackUnmuted, onVideoChange);
      room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        const ids = new Set(
          speakers
            .map((participant) => participant.identity?.trim())
            .filter((identity): identity is string => Boolean(identity)),
        );
        setActiveSpeakerUserIds(ids);
      });

      room.on(RoomEvent.Disconnected, () => {
        setConnected(false);
        setRemoteVideoByUserId(new Map());
        setActiveSpeakerUserIds(new Set());
      });

      setConnected(true);
      syncRemoteVideos(room);
      const ids = new Set(
        room.activeSpeakers
          .map((participant) => participant.identity?.trim())
          .filter((identity): identity is string => Boolean(identity)),
      );
      setActiveSpeakerUserIds(ids);
    };

    const connect = async () => {
      // Local camera already shown via cameraTrack — LiveKit is a silent upgrade.
      const result = await connectWithTokenFetcher(
        () => fetchPartyLiveKitToken(roomId, canPublish),
        {
          onDisconnected: () => {
            if (!cancelled) {
              setConnected(false);
              setRemoteVideoByUserId(new Map());
              setActiveSpeakerUserIds(new Set());
            }
          },
        },
      );
      if (cancelled) {
        if (result.ok) void result.room.disconnect();
        return;
      }
      if (!result.ok) {
        setConnected(false);
        retryTimer = window.setTimeout(() => {
          if (!cancelled) void connect();
        }, 2_000);
        return;
      }
      bindRoom(result.room);
    };

    void connect();

    return () => {
      cancelled = true;
      if (retryTimer != null) window.clearTimeout(retryTimer);
      setConnected(false);
      setRemoteVideoByUserId(new Map());
      setActiveSpeakerUserIds(new Set());
      publishedVideoTrackIdRef.current = null;
      localAudioTrackRef.current?.stop();
      localAudioTrackRef.current = null;
      const room = roomRef.current;
      roomRef.current = null;
      room?.disconnect();
    };
  }, [active, canPublish, configured, roomId, sessionMode]);

  const cameraTrackRef = useRef(cameraTrack);
  cameraTrackRef.current = cameraTrack;

  useEffect(() => {
    const room = roomRef.current;
    if (!configured || !active || !room || !connected) return undefined;

    let cancelled = false;

    const publishTracks = async () => {
      if (room.state !== ConnectionState.Connected || cancelled) return;

      const track = cameraTrackRef.current;

      try {
        if (publishVideo && track) {
          if (publishedVideoTrackIdRef.current !== track.id) {
            await publishOrReplaceCameraTrack(room, track);
            publishedVideoTrackIdRef.current = track.id;
          }
        } else if (publishedVideoTrackIdRef.current) {
          await unpublishCameraTrack(room);
          publishedVideoTrackIdRef.current = null;
        }

        if (publishMic) {
          if (!localAudioTrackRef.current) {
            const audioTrack = await createLocalAudioTrack();
            if (cancelled) {
              audioTrack.stop();
              return;
            }
            localAudioTrackRef.current = audioTrack;
            await room.localParticipant.publishTrack(audioTrack, { source: Track.Source.Microphone });
          }
        } else if (localAudioTrackRef.current) {
          await room.localParticipant.unpublishTrack(localAudioTrackRef.current);
          localAudioTrackRef.current.stop();
          localAudioTrackRef.current = null;
        }
      } catch {
        /* LiveKit publish errors — local preview still works */
      }
    };

    void publishTracks();

    return () => {
      cancelled = true;
    };
  }, [active, cameraTrack?.id, configured, connected, publishMic, publishVideo]);

  return {
    configured,
    connected,
    remoteVideoByUserId,
    activeSpeakerUserIds,
  };
}

export function resolveSeatVideoUserId(
  guest: { userId?: string; name: string },
  roomId: string,
): string | null {
  const direct = guest.userId?.trim();
  if (direct) return direct;
  const resolved = resolveRoomMemberIdentity(undefined, guest.name, roomId).userId?.trim();
  return resolved || null;
}
