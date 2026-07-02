import { useEffect, useRef } from 'react';
import { Room, RoomEvent, Track, ConnectionState } from 'livekit-client';
import { isLiveKitConfigured } from '../livekit/livekitConfig';
import { fetchPartyLiveKitToken } from '../platformApi';

type PartyLiveKitOptions = {
  roomId: string;
  /** User is seated in the party room */
  enabled: boolean;
  /** Mic unmuted and not admin-muted */
  publishMic: boolean;
};

/**
 * LiveKit voice for party rooms — connects when seated, publishes audio when mic is on.
 */
export function usePartyRoomLiveKit({ roomId, enabled, publishMic }: PartyLiveKitOptions) {
  const roomRef = useRef<Room | null>(null);
  const micTrackRef = useRef<MediaStreamTrack | null>(null);

  useEffect(() => {
    if (!isLiveKitConfigured() || !enabled || !roomId) return undefined;

    let cancelled = false;
    const room = new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = room;

    room.on(RoomEvent.TrackSubscribed, (track) => {
      if (track.kind === Track.Kind.Audio) {
        const el = track.attach();
        el.play().catch(() => {});
      }
    });

    void (async () => {
      try {
        const { token, url } = await fetchPartyLiveKitToken(roomId, true);
        if (cancelled) return;
        await room.connect(url, token);
      } catch {
        /* silent — local party UI still works */
      }
    })();

    return () => {
      cancelled = true;
      micTrackRef.current?.stop();
      micTrackRef.current = null;
      room.disconnect();
      roomRef.current = null;
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
        /* ignore mic errors */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [publishMic, enabled]);

  return { connected: Boolean(roomRef.current) };
}
