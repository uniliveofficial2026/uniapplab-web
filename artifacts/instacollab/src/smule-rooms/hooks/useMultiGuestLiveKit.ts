import { useEffect, useRef, useState } from 'react';
import {
  ConnectionState,
  RemoteTrack,
  Room,
  RoomEvent,
  Track,
} from '../../lib/rtc/livekitCompatibilityBoundary';
import { registerLiveKitRoom, unregisterLiveKitRoom } from '../../lib/livekit/liveRoomBus';
import { isLiveKitConfigured } from '../../lib/livekit/livekitConfig';
import { updateLiveKitLocalAudioTrack } from '../../lib/livekit/liveKitAudioPublish';
import {
  prepareProcessedVideoTrackForLiveKit,
  updateLiveKitLocalVideoTrack,
} from '../../lib/livekit/liveKitVideoPublish';
import {
  connectHostLiveKitRoom,
  disposeHostLiveKitRoom,
  getOrCreateHostLiveKitRoom,
  reconnectHostLiveKitWithNewGrants,
} from '../../lib/livekit/hostLiveKitRoom';
import { fetchPartyLiveKitToken } from '../../lib/platformApi';
import {
  noteHostPublishing,
  noteHostTrackPublished,
  setHostMediaState,
} from '../../lib/camera/hostMediaSession';
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
  /** Platform-admin silent watch — LiveKit hidden grant. */
  hidden?: boolean;
};

export type MultiGuestLiveKitState = {
  configured: boolean;
  connected: boolean;
  remoteVideoByUserId: ReadonlyMap<string, RemoteTrack>;
  activeSpeakerUserIds: ReadonlySet<string>;
};

/**
 * LiveKit A/V for Multi-Guest — all viewers subscribe; seated users publish camera (+ mic when unmuted).
 * Uses the exclusive host Room instance (prepareConnection + single connect).
 */
export function useMultiGuestLiveKit({
  roomId,
  active,
  canPublish,
  publishVideo,
  publishMic,
  processedAudioTrack = null,
  cameraTrack,
  hidden = false,
}: UseMultiGuestLiveKitOptions): MultiGuestLiveKitState {
  const configured = isLiveKitConfigured();
  const roomRef = useRef<Room | null>(null);
  const publishedVideoTrackIdRef = useRef<string | null>(null);
  const publishedAudioTrackIdRef = useRef<string | null>(null);
  const grantKeyRef = useRef(`${canPublish}:${hidden}`);
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
    const room = getOrCreateHostLiveKitRoom(roomId);
    roomRef.current = room;

    const onVideoChange = () => syncRemoteVideos(room);

    const onTrackSubscribed = (track: RemoteTrack, publication: unknown, participant: { identity?: string }) => {
      if (track.kind === Track.Kind.Audio) {
        const el = track.attach();
        void el.play().catch(() => {});
        void publication;
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
    };

    const onTrackUnsubscribed = (track: RemoteTrack, _publication: unknown, participant: { identity?: string }) => {
      if (track.kind === Track.Kind.Audio) {
        try {
          track.detach().forEach((el) => {
            try {
              el.remove();
            } catch {
              /* ignore */
            }
          });
        } catch {
          /* ignore */
        }
        return;
      }
      if (track.kind !== Track.Kind.Video) return;
      const identity = participant.identity?.trim();
      if (!identity) return;
      setRemoteVideoByUserId((prev) => {
        if (!prev.has(identity)) return prev;
        const next = new Map(prev);
        next.delete(identity);
        return next;
      });
    };

    const onActiveSpeakers = (speakers: Array<{ identity?: string }>) => {
      const ids = new Set(
        speakers
          .map((participant) => participant.identity?.trim())
          .filter((identity): identity is string => Boolean(identity)),
      );
      setActiveSpeakerUserIds(ids);
    };

    const onConnected = () => {
      registerLiveKitRoom(roomId, room);
      setConnected(true);
      setHostMediaState('connecting');
      syncRemoteVideos(room);
      const ids = new Set(
        room.activeSpeakers
          .map((participant) => participant.identity?.trim())
          .filter((identity): identity is string => Boolean(identity)),
      );
      setActiveSpeakerUserIds(ids);
    };

    const onDisconnected = () => {
      setConnected(false);
      setRemoteVideoByUserId(new Map());
      setActiveSpeakerUserIds(new Set());
    };

    room.on(RoomEvent.TrackSubscribed, onTrackSubscribed);
    room.on(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed);
    room.on(RoomEvent.ParticipantDisconnected, onVideoChange);
    room.on(RoomEvent.TrackMuted, onVideoChange);
    room.on(RoomEvent.TrackUnmuted, onVideoChange);
    room.on(RoomEvent.ActiveSpeakersChanged, onActiveSpeakers);
    room.on(RoomEvent.Connected, onConnected);
    room.on(RoomEvent.Disconnected, onDisconnected);

    const fetchToken = () =>
      fetchPartyLiveKitToken(roomId, hidden ? false : canPublish, { hidden });

    const grantKey = `${canPublish}:${hidden}`;
    const grantChanged = grantKeyRef.current !== grantKey;
    grantKeyRef.current = grantKey;

    void (async () => {
      try {
        if (grantChanged && room.state === ConnectionState.Connected) {
          await reconnectHostLiveKitWithNewGrants(roomId, fetchToken);
        } else {
          setHostMediaState('connecting');
          await connectHostLiveKitRoom(roomId, fetchToken);
        }
        if (cancelled) return;
        if (room.state === ConnectionState.Connected) onConnected();
      } catch {
        /* local UI still works without LiveKit */
      }
    })();

    return () => {
      cancelled = true;
      room.off(RoomEvent.TrackSubscribed, onTrackSubscribed);
      room.off(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed);
      room.off(RoomEvent.ParticipantDisconnected, onVideoChange);
      room.off(RoomEvent.TrackMuted, onVideoChange);
      room.off(RoomEvent.TrackUnmuted, onVideoChange);
      room.off(RoomEvent.ActiveSpeakersChanged, onActiveSpeakers);
      room.off(RoomEvent.Connected, onConnected);
      room.off(RoomEvent.Disconnected, onDisconnected);
      setConnected(false);
      setRemoteVideoByUserId(new Map());
      setActiveSpeakerUserIds(new Set());
      publishedVideoTrackIdRef.current = null;
      publishedAudioTrackIdRef.current = null;
      unregisterLiveKitRoom(roomId, room);
      void disposeHostLiveKitRoom(roomId);
      roomRef.current = null;
    };
  }, [active, canPublish, configured, roomId, hidden]);

  const processedAudioTrackRef = useRef(processedAudioTrack);
  processedAudioTrackRef.current = processedAudioTrack;

  useEffect(() => {
    const room = roomRef.current;
    if (!configured || !active || hidden || !room || !connected) return undefined;

    let cancelled = false;

    const publishTracks = async () => {
      if (room.state !== ConnectionState.Connected || cancelled) return;

      try {
        if (publishVideo && cameraTrack) {
          const prepared = prepareProcessedVideoTrackForLiveKit(cameraTrack);
          if (publishedVideoTrackIdRef.current !== prepared.id) {
            noteHostPublishing();
            await updateLiveKitLocalVideoTrack(room.localParticipant, prepared);
            publishedVideoTrackIdRef.current = prepared.id;
            noteHostTrackPublished();
          }
        } else if (publishedVideoTrackIdRef.current) {
          await updateLiveKitLocalVideoTrack(room.localParticipant, null);
          publishedVideoTrackIdRef.current = null;
        }

        if (publishMic) {
          const track = processedAudioTrackRef.current;
          if (track && track.readyState !== 'ended' && !cancelled) {
            if (publishedAudioTrackIdRef.current !== track.id) {
              await updateLiveKitLocalAudioTrack(room.localParticipant, track);
              publishedAudioTrackIdRef.current = track.id;
            }
          }
        } else if (publishedAudioTrackIdRef.current) {
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
  }, [active, cameraTrack, configured, connected, hidden, processedAudioTrack?.id, publishMic, publishVideo]);

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
