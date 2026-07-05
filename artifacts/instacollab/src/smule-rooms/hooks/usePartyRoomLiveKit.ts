import { useEffect, useRef, useState } from 'react';
import { ConnectionState, Room, RoomEvent, Track } from 'livekit-client';
import { isLiveKitConfigured } from '../../lib/livekit/livekitConfig';
import { canAttemptLiveKit, connectWithTokenFetcher } from '../../lib/livekit/liveKitInstant';
import { fetchPartyLiveKitToken } from '../../lib/platformApi';

type PartyLiveKitOptions = {
  roomId: string;
  /** User is seated in the party room */
  enabled: boolean;
  /** Mic unmuted and not admin-muted */
  publishMic: boolean;
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
export function usePartyRoomLiveKit({ roomId, enabled, publishMic }: PartyLiveKitOptions) {
  const roomRef = useRef<Room | null>(null);
  const micTrackRef = useRef<MediaStreamTrack | null>(null);
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
      attachRemoteAudio(room);
      setConnected(true);
    };

    const connect = async () => {
      const result = await connectWithTokenFetcher(
        () => fetchPartyLiveKitToken(roomId, true),
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
      micTrackRef.current?.stop();
      micTrackRef.current = null;
      const room = roomRef.current;
      roomRef.current = null;
      room?.disconnect();
      setConnected(false);
    };
  }, [roomId, enabled]);

  useEffect(() => {
    const room = roomRef.current;
    if (!room || !enabled || room.state !== ConnectionState.Connected) return undefined;

    let cancelled = false;

    void (async () => {
      try {
        if (publishMic) {
          if (room.localParticipant.audioTrackPublications.size > 0) return;
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          const audioTrack = stream.getAudioTracks()[0];
          if (!audioTrack || cancelled) return;
          micTrackRef.current = audioTrack;
          await room.localParticipant.publishTrack(audioTrack);
        } else {
          for (const pub of room.localParticipant.audioTrackPublications.values()) {
            if (pub.track) {
              await room.localParticipant.unpublishTrack(pub.track);
            }
          }
          micTrackRef.current?.stop();
          micTrackRef.current = null;
        }
      } catch {
        /* room UI stays up without mic */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [publishMic, enabled, connected]);

  return { connected };
}
