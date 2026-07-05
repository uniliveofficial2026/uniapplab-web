import React, { useEffect, useRef, useState } from 'react';
import { RoomEvent, Track, type RemoteTrack, type Room } from 'livekit-client';
import { isLiveKitConfigured } from '../../lib/livekit/livekitConfig';
import {
  fetchLiveKitToken,
  fetchPartyLiveKitToken,
  isPlatformApiAvailable,
} from '../../lib/platformApi';
import { FALLBACK_MEDIA } from '../../lib/safe';
import { acquireLivePreviewSlot } from '../../lib/live/liveDiscoveryVideoPool';
import { SafeMediaImage } from '../common/SafeMediaImage';
import { shouldSkipLiveVideoPreview, warmMediaUrl } from '../../lib/mediaInstant';
import { canAttemptLiveKit, connectWithTokenFetcher } from '../../lib/livekit/liveKitInstant';

type LiveDiscoveryVideoPreviewProps = {
  posterUrl: string;
  hostUserId?: string;
  partyRoomId?: string;
  streamId?: string;
  className?: string;
};

function pickHostVideoTrack(room: Room, hostUserId?: string): RemoteTrack | null {
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

/**
 * All live/party discovery cards: sharp poster instantly; LiveKit is a silent upgrade.
 */
export function LiveDiscoveryVideoPreview({
  posterUrl,
  hostUserId,
  partyRoomId,
  streamId,
  className = '',
}: LiveDiscoveryVideoPreviewProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [hasVideo, setHasVideo] = useState(false);

  useEffect(() => {
    warmMediaUrl(posterUrl);
  }, [posterUrl]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(Boolean(entry?.isIntersecting && entry.intersectionRatio >= 0.35)),
      { threshold: [0, 0.35, 0.6], rootMargin: '40px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canConnect =
      visible &&
      canAttemptLiveKit() &&
      !shouldSkipLiveVideoPreview() &&
      isLiveKitConfigured() &&
      isPlatformApiAvailable() &&
      Boolean(partyRoomId || streamId);

    if (!canConnect) {
      setHasVideo(false);
      return undefined;
    }

    let cancelled = false;
    let releaseSlot: (() => void) | null = null;
    let room: Room | null = null;
    let attached: RemoteTrack | null = null;

    const detach = () => {
      const video = videoRef.current;
      if (attached && video) {
        try {
          attached.detach(video);
        } catch {
          /* ignore */
        }
      }
      attached = null;
      if (video) video.srcObject = null;
      if (!cancelled) setHasVideo(false);
    };

    const attachTrack = (track: RemoteTrack | null) => {
      const video = videoRef.current;
      if (!track || !video || cancelled) return;
      if (attached === track) return;
      if (attached && video) {
        try {
          attached.detach(video);
        } catch {
          /* ignore */
        }
      }
      attached = track;
      track.attach(video);
      video.muted = true;
      video.playsInline = true;
      void video.play().catch(() => {});
      setHasVideo(true);
    };

    const syncVideo = (liveRoom: Room) => {
      attachTrack(pickHostVideoTrack(liveRoom, hostUserId));
    };

    void (async () => {
      try {
        releaseSlot = await acquireLivePreviewSlot(() => cancelled);
        if (cancelled || !releaseSlot) {
          releaseSlot?.();
          releaseSlot = null;
          return;
        }

        const result = await connectWithTokenFetcher(
          () =>
            partyRoomId
              ? fetchPartyLiveKitToken(partyRoomId, false)
              : fetchLiveKitToken(streamId!, 'viewer'),
          {
            timeoutMs: 2_500,
            onDisconnected: () => {
              if (!cancelled) setHasVideo(false);
            },
          },
        );

        if (cancelled) {
          if (result.ok) void result.room.disconnect();
          return;
        }
        if (!result.ok) {
          setHasVideo(false);
          return;
        }

        room = result.room;
        room.on(RoomEvent.TrackSubscribed, (track) => {
          if (track.kind !== Track.Kind.Video || cancelled || !room) return;
          syncVideo(room);
        });
        room.on(RoomEvent.TrackUnsubscribed, () => {
          if (room && !cancelled) syncVideo(room);
        });
        room.on(RoomEvent.TrackMuted, () => {
          if (room && !cancelled) syncVideo(room);
        });
        room.on(RoomEvent.TrackUnmuted, () => {
          if (room && !cancelled) syncVideo(room);
        });
        room.on(RoomEvent.ParticipantConnected, () => {
          if (room && !cancelled) syncVideo(room);
        });
        room.on(RoomEvent.ParticipantDisconnected, () => {
          if (room && !cancelled) syncVideo(room);
        });
        syncVideo(room);
      } catch {
        if (!cancelled) setHasVideo(false);
      }
    })();

    return () => {
      cancelled = true;
      detach();
      try {
        room?.disconnect();
      } catch {
        /* ignore */
      }
      room = null;
      releaseSlot?.();
      releaseSlot = null;
    };
  }, [visible, partyRoomId, streamId, hostUserId]);

  return (
    <div ref={rootRef} className={`absolute inset-0 overflow-hidden bg-secondary ${className}`}>
      <SafeMediaImage
        src={posterUrl}
        alt=""
        priority
        fallback={FALLBACK_MEDIA}
        className={`absolute inset-0 h-full w-full object-cover ${
          hasVideo ? 'opacity-0' : 'opacity-100'
        }`}
      />
      <video
        ref={videoRef}
        muted
        playsInline
        autoPlay
        className={`absolute inset-0 h-full w-full object-cover ${
          hasVideo ? 'opacity-100' : 'opacity-0'
        }`}
      />
      {hasVideo ? (
        <div className="pointer-events-none absolute top-2 left-2 flex items-center gap-1 rounded-md bg-black/45 px-1.5 py-0.5">
          <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[9px] font-bold uppercase tracking-wide text-white">Live</span>
        </div>
      ) : null}
    </div>
  );
}
