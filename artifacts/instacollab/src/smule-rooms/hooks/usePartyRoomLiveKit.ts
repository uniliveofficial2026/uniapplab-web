import { useEffect, useRef, useState } from 'react';
import { ConnectionState, Room } from 'livekit-client';
import { isLiveKitConfigured } from '../../lib/livekit/livekitConfig';
import { registerLiveKitRoom, unregisterLiveKitRoom } from '../../lib/livekit/liveRoomBus';
import { canAttemptLiveKit, connectWithTokenFetcher } from '../../lib/livekit/liveKitInstant';
import { updateLiveKitLocalAudioTrack } from '../../lib/livekit/liveKitAudioPublish';
import { bindLiveKitRemoteAudioPlayback } from '../../lib/livekit/liveKitRemoteAudio';
import { fetchPartyLiveKitToken } from '../../lib/platformApi';
import { realtimeLifecycleDebug } from '../../lib/realtime/realtimeLifecycleDebug';

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
  /** Platform-admin silent watch — LiveKit hidden grant (invisible to host). */
  hidden?: boolean;
};

const MAX_CONNECT_RETRIES = 5;
const RETRY_BASE_MS = 2_000;

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
  hidden = false,
}: PartyLiveKitOptions) {
  const roomRef = useRef<Room | null>(null);
  const publishedTrackIdRef = useRef<string | null>(null);
  const audioDetachRef = useRef<(() => void) | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!isLiveKitConfigured() || !enabled || !roomId || !canAttemptLiveKit()) {
      setConnected(false);
      return undefined;
    }

    let cancelled = false;
    let retryTimer: number | null = null;
    let retries = 0;

    const clearAudio = () => {
      audioDetachRef.current?.();
      audioDetachRef.current = null;
    };

    const bindRoom = (room: Room) => {
      roomRef.current = room;
      registerLiveKitRoom(roomId, room);
      clearAudio();
      audioDetachRef.current = bindLiveKitRemoteAudioPlayback(room).detach;
      setConnected(true);
      realtimeLifecycleDebug('party-livekit-connected', { roomId });
    };

    const connect = async () => {
      const result = await connectWithTokenFetcher(
        () =>
          fetchPartyLiveKitToken(roomId, hidden ? false : canPublish, {
            hidden,
          }),
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
        if (retries >= MAX_CONNECT_RETRIES) {
          realtimeLifecycleDebug('party-livekit-retry-exhausted', {
            roomId,
            retries,
          });
          return;
        }
        const delay = RETRY_BASE_MS * Math.min(8, 2 ** retries);
        retries += 1;
        retryTimer = window.setTimeout(() => {
          if (!cancelled) void connect();
        }, delay);
        return;
      }
      retries = 0;
      bindRoom(result.room);
    };

    void connect();

    return () => {
      cancelled = true;
      if (retryTimer != null) window.clearTimeout(retryTimer);
      publishedTrackIdRef.current = null;
      clearAudio();
      const room = roomRef.current;
      roomRef.current = null;
      if (room) unregisterLiveKitRoom(roomId, room);
      room?.disconnect();
      setConnected(false);
      realtimeLifecycleDebug('party-livekit-cleanup', { roomId });
    };
  }, [roomId, enabled, canPublish, hidden]);

  const processedTrackRef = useRef(processedAudioTrack);
  processedTrackRef.current = processedAudioTrack;

  useEffect(() => {
    const room = roomRef.current;
    if (!room || !enabled || hidden || room.state !== ConnectionState.Connected) return undefined;

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
  }, [publishMic, enabled, connected, processedAudioTrack?.id, hidden]);

  return { connected };
}
