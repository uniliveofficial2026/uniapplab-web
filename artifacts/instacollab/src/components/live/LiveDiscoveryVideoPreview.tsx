import React, { useEffect, useRef, useState } from 'react';
import type { RemoteTrack } from 'livekit-client';
import { FALLBACK_MEDIA } from '../../lib/safe';
import { connectDiscoveryPreview } from '../../lib/live/liveDiscoveryPreviewKit';
import { SafeMediaImage } from '../common/SafeMediaImage';
import { shouldSkipLiveVideoPreview, warmMediaUrl } from '../../lib/mediaInstant';
import { canAttemptLiveKit } from '../../lib/livekit/liveKitInstant';
import { isLiveKitConfigured } from '../../lib/livekit/livekitConfig';
import { isPlatformApiAvailable } from '../../lib/platformApi';

type LiveDiscoveryVideoPreviewProps = {
  posterUrl: string;
  hostUserId?: string;
  partyRoomId?: string;
  streamId?: string;
  className?: string;
};

/**
 * Live tab discovery cards: sharp poster instantly; LiveKit upgrades when a host
 * publishes camera (party Solo/Multi-Guest or legacy stream). Audio-only rooms
 * show an AUDIO LIVE badge instead of a blank poster.
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
  const attachedTrackRef = useRef<RemoteTrack | null>(null);
  const [visible, setVisible] = useState(false);
  const [hasVideo, setHasVideo] = useState(false);
  const [hasAudioLive, setHasAudioLive] = useState(false);

  useEffect(() => {
    warmMediaUrl(posterUrl);
  }, [posterUrl]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(Boolean(entry?.isIntersecting && entry.intersectionRatio >= 0.2)),
      { threshold: [0, 0.2, 0.45, 0.7], rootMargin: '48px' },
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
      setHasAudioLive(false);
      return undefined;
    }

    let cancelled = false;
    let disconnect: (() => void) | null = null;

    const detachVideo = () => {
      const video = videoRef.current;
      const attached = attachedTrackRef.current;
      if (attached && video) {
        try {
          attached.detach(video);
        } catch {
          /* ignore */
        }
      }
      attachedTrackRef.current = null;
      if (video) video.srcObject = null;
      if (!cancelled) setHasVideo(false);
    };

    const attachTrack = (track: RemoteTrack | null) => {
      const video = videoRef.current;
      if (!track || track.kind !== 'video' || !video || cancelled) {
        detachVideo();
        return;
      }
      if (attachedTrackRef.current === track) return;
      detachVideo();
      attachedTrackRef.current = track;
      track.attach(video);
      video.muted = true;
      video.playsInline = true;
      void video.play().catch(() => undefined);
      setHasVideo(true);
    };

    void (async () => {
      disconnect = await connectDiscoveryPreview({
        target: { partyRoomId, streamId, hostUserId },
        isCancelled: () => cancelled,
        onVideoTrack: attachTrack,
        onAudioLive: (live) => {
          if (!cancelled) setHasAudioLive(live);
        },
      });
      if (cancelled) {
        disconnect?.();
        disconnect = null;
      }
    })();

    return () => {
      cancelled = true;
      detachVideo();
      disconnect?.();
      disconnect = null;
      setHasAudioLive(false);
    };
  }, [visible, partyRoomId, streamId, hostUserId]);

  return (
    <div ref={rootRef} className={`absolute inset-0 overflow-hidden bg-secondary ${className}`}>
      <SafeMediaImage
        src={posterUrl}
        alt=""
        priority
        fallback={FALLBACK_MEDIA}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
          hasVideo ? 'opacity-0' : 'opacity-100'
        }`}
      />
      <video
        ref={videoRef}
        muted
        playsInline
        autoPlay
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
          hasVideo ? 'opacity-100' : 'opacity-0'
        }`}
      />
      {hasVideo ? (
        <div className="pointer-events-none absolute top-2 left-2 flex items-center gap-1 rounded-md bg-black/45 px-1.5 py-0.5">
          <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[9px] font-bold uppercase tracking-wide text-white">Live</span>
        </div>
      ) : hasAudioLive ? (
        <div className="pointer-events-none absolute top-2 left-2 flex items-center gap-1 rounded-md bg-black/45 px-1.5 py-0.5">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-[9px] font-bold uppercase tracking-wide text-white">Audio</span>
        </div>
      ) : null}
    </div>
  );
}
