import { useEffect, useRef, useState } from 'react';
import { ConnectionState, Room, RoomEvent, Track } from 'livekit-client';
import { isLiveKitConfigured } from '../../lib/livekit/livekitConfig';
import { registerLiveKitRoom, unregisterLiveKitRoom } from '../../lib/livekit/liveRoomBus';
import { canAttemptLiveKit, connectWithTokenFetcher } from '../../lib/livekit/liveKitInstant';
import { updateLiveKitLocalAudioTrack } from '../../lib/livekit/liveKitAudioPublish';
import { fetchPartyLiveKitToken } from '../../lib/platformApi';

type PartyLiveKitOptions = {
  roomId: string;
  /** User is seated in the party room */
  enabled: boolean;
  /** May publish mic when seated (token grant — reconnects when this flips) */
  canPublish: boolean;
  /** Mic unmuted and not admin-muted */
  publishMic: boolean;
  /** Processed mic from Web Audio voice changer — remote listeners hear the effect */
  processedAudioTrack?: MediaStreamTrack | null;
};

function attachRemoteAudio(room: Room) {
  room.on(RoomEvent.TrackSubscribed, (track) => {
    if (track.kind === Track.Kind.Audio) {
      const el = track.attach();
      void el.play().catch(() => {});
    }
  });
}

/**
 * Voice for every non-camera room mode:
 * Chat, Radio, Karaoke, Party, Chorus, WatchTogether.
 * Room UI is instant; LiveKit subscribe/publish is timed + retried in background.
 */
export function usePartyRoomLiveKit({
  roomId,
  enabled,
  canPublish,
  publishMic,
  processedAudioTrack = null,
}: PartyLiveKitOptions) {
  const roomRef = useRef<Room | null>(null);
  const publishedTrackIdRef = useRef<string | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!isLiveKitConfigured() || !enabled || !roomId || !canAttemptLiveKit()) {
      setConnected(false);
      return undefined;
    }

    let cancelled = false;
    let retryTimer: number | null = null;

    const bindRoom = (room: Room) => {
      roomRef.current = room;
      registerLiveKitRoom(roomId, room);
      attachRemoteAudio(room);
      setConnected(true);
    };

    const connect = async () => {
      const result = await connectWithTokenFetcher(
        () => fetchPartyLiveKitToken(roomId, canPublish),
        {
          onDisconnected: () => {
            if (!cancelled) setConnected(false);
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
      publishedTrackIdRef.current = null;
      const room = roomRef.current;
      roomRef.current = null;
      if (room) unregisterLiveKitRoom(roomId, room);
      room?.disconnect();
      setConnected(false);
    };
  }, [roomId, enabled, canPublish]);

  const processedTrackRef = useRef(processedAudioTrack);
  processedTrackRef.current = processedAudioTrack;

  useEffect(() => {
    const room = roomRef.current;
    if (!room || !enabled || room.state !== ConnectionState.Connected) return undefined;

    let cancelled = false;

    void (async () => {
      try {
        if (publishMic) {
          const track = processedTrackRef.current;
          if (!track || track.readyState === 'ended' || cancelled) return;
          if (publishedTrackIdRef.current === track.id) return;
          await updateLiveKitLocalAudioTrack(room.localParticipant, track);
          publishedTrackIdRef.current = track.id;
        } else {
          await updateLiveKitLocalAudioTrack(room.localParticipant, null);
          publishedTrackIdRef.current = null;
        }
      } catch {
        /* room UI stays up without mic */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [publishMic, enabled, connected, processedAudioTrack?.id]);

  return { connected };
}
