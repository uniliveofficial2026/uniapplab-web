/**
 * LiveKit remote audio attach/detach helpers (Phase 11).
 * Ensures TrackUnsubscribed / disconnect cleans attached elements.
 */
import { Room, RoomEvent, Track, type RemoteTrack } from '../rtc/livekitCompatibilityBoundary';

type BoundRemoteAudio = {
  detach: () => void;
};

/**
 * Subscribe to remote audio tracks and attach HTML audio elements.
 * Returns a disposer that removes listeners and detaches all attached elements.
 */
export function bindLiveKitRemoteAudioPlayback(room: Room): BoundRemoteAudio {
  const attached = new Set<RemoteTrack>();

  const onSubscribed = (track: RemoteTrack) => {
    if (track.kind !== Track.Kind.Audio) return;
    const el = track.attach();
    attached.add(track);
    void el.play().catch(() => {});
  };

  const onUnsubscribed = (track: RemoteTrack) => {
    if (track.kind !== Track.Kind.Audio) return;
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
    attached.delete(track);
  };

  room.on(RoomEvent.TrackSubscribed, onSubscribed);
  room.on(RoomEvent.TrackUnsubscribed, onUnsubscribed);

  return {
    detach: () => {
      room.off(RoomEvent.TrackSubscribed, onSubscribed);
      room.off(RoomEvent.TrackUnsubscribed, onUnsubscribed);
      for (const track of attached) {
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
      }
      attached.clear();
    },
  };
}
