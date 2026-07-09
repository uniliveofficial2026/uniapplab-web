import { useEffect, useRef, useState } from 'react';
import {
  ConnectionState,
  LocalVideoTrack,
  RemoteTrack,
  Room,
  RoomEvent,
  Track,
} from 'livekit-client';
import { registerLiveKitRoom, unregisterLiveKitRoom } from '../../lib/livekit/liveRoomBus';
import { isLiveKitConfigured } from '../../lib/livekit/livekitConfig';
import { updateLiveKitLocalAudioTrack } from '../../lib/livekit/liveKitAudioPublish';
import { fetchPartyLiveKitToken } from '../../lib/platformApi';
import { resolveRoomMemberIdentity } from '../utils/roomMemberProfile';

type UseMultiGuestLiveKitOptions = {
  roomId: string;
  active: boolean;
  canPublish: boolean;
  publishVideo: boolean;
  publishMic: boolean;
  sessionMode?: string;
  /** Processed mic from Web Audio voice changer — remote listeners hear the effect */
  processedAudioTrack?: MediaStreamTrack | null;
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
    simulcast: true,
  });
}

async function unpublishCameraTrack(room: Room): Promise<void> {
  const publication = room.localParticipant.getTrackPublication(Track.Source.Camera);
  if (publication?.track) {
    await room.localParticipant.unpublishTrack(publication.track);
  }
}

/**
 * LiveKit A/V for Multi-Guest — all viewers subscribe; seated users publish camera (+ mic when unmuted).
 */
export function useMultiGuestLiveKit({
  roomId,
  active,
  canPublish,
  publishVideo,
  publishMic,
  processedAudioTrack = null,
  cameraTrack,
}: UseMultiGuestLiveKitOptions): MultiGuestLiveKitState {
  const configured = isLiveKitConfigured();
  const roomRef = useRef<Room | null>(null);
  const publishedVideoTrackIdRef = useRef<string | null>(null);
  const publishedAudioTrackIdRef = useRef<string | null>(null);
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

    let cancelled = false;
    const room = new Room({ adaptiveStream: true, dynacast: true });
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

    room.on(RoomEvent.Connected, () => {
      registerLiveKitRoom(roomId, room);
      setConnected(true);
      syncRemoteVideos(room);
      const ids = new Set(
        room.activeSpeakers
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

    void (async () => {
      try {
        const { token, url } = await fetchPartyLiveKitToken(roomId, canPublish);
        if (cancelled) return;
        await room.connect(url, token);
      } catch {
        /* local UI still works without LiveKit */
      }
    })();

    return () => {
      cancelled = true;
      setConnected(false);
      setRemoteVideoByUserId(new Map());
      setActiveSpeakerUserIds(new Set());
      publishedVideoTrackIdRef.current = null;
      publishedAudioTrackIdRef.current = null;
      unregisterLiveKitRoom(roomId, room);
      room.disconnect();
      roomRef.current = null;
    };
  }, [active, canPublish, configured, roomId]);

  const processedAudioTrackRef = useRef(processedAudioTrack);
  processedAudioTrackRef.current = processedAudioTrack;

  useEffect(() => {
    const room = roomRef.current;
    if (!configured || !active || !room || !connected) return undefined;

    let cancelled = false;

    const publishTracks = async () => {
      if (room.state !== ConnectionState.Connected || cancelled) return;

      try {
        if (publishVideo && cameraTrack) {
          if (publishedVideoTrackIdRef.current !== cameraTrack.id) {
            await publishOrReplaceCameraTrack(room, cameraTrack);
            publishedVideoTrackIdRef.current = cameraTrack.id;
          }
        } else if (publishedVideoTrackIdRef.current) {
          await unpublishCameraTrack(room);
          publishedVideoTrackIdRef.current = null;
        }

        if (publishMic) {
          const track = processedAudioTrackRef.current;
          if (!track || track.readyState === 'ended' || cancelled) return;
          if (publishedAudioTrackIdRef.current === track.id) return;
          await updateLiveKitLocalAudioTrack(room.localParticipant, track);
          publishedAudioTrackIdRef.current = track.id;
        } else {
          await updateLiveKitLocalAudioTrack(room.localParticipant, null);
          publishedAudioTrackIdRef.current = null;
        }
      } catch {
        /* LiveKit publish errors — local preview still works */
      }
    };

    void publishTracks();

    return () => {
      cancelled = true;
    };
  }, [active, cameraTrack, configured, connected, processedAudioTrack?.id, publishMic, publishVideo]);

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
