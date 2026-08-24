import React, { useEffect, useRef, useState } from 'react';
import type { RemoteTrack } from '../../lib/rtc/livekitCompatibilityBoundary';
import { FALLBACK_MEDIA } from '../../lib/safe';
import { connectDiscoveryPreview } from '../../lib/live/liveDiscoveryPreviewKit';
import { SafeMediaImage } from '../common/SafeMediaImage';
import { shouldSkipLiveVideoPreview, warmMediaUrl } from '../../lib/mediaInstant';
import { canAttemptLiveKit } from '../../lib/livekit/liveKitInstant';
import { isLiveKitConfigured } from '../../lib/livekit/livekitConfig';

type LiveDiscoveryVideoPreviewProps = {
  posterUrl: string;
  hostUserId?: string;
  partyRoomId?: string;
  streamId?: string;
  className?: string;
};

/**
 * Live tab discovery cards: sharp poster instantly; LiveKit upgrades when a host
 * publishes camera (any room type). Audio-only rooms show an AUDIO LIVE badge.
 * Tap the card (parent button) to enter as viewer and watch the live stream.
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
  const [videoReady, setVideoReady] = useState(false);

  useEffect(() => {
    warmMediaUrl(posterUrl);
  }, [posterUrl]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(Boolean(entry?.isIntersecting && entry.intersectionRatio >= 0.05)),
      { threshold: [0, 0.05, 0.15, 0.35, 0.6], rootMargin: '120px' },
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
      Boolean(partyRoomId || streamId || hostUserId);

    if (!canConnect) {
      setHasVideo(false);
      setHasAudioLive(false);
      setVideoReady(false);
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
      if (video) {
        video.srcObject = null;
        video.onloadeddata = null;
        video.onplaying = null;
        video.onloadedmetadata = null;
      }
      if (!cancelled) {
        setHasVideo(false);
        setVideoReady(false);
      }
    };

    const attachTrack = (track: RemoteTrack | null) => {
      const video = videoRef.current;
      if (!track || track.kind !== 'video' || !video || cancelled) {
        detachVideo();
        return;
      }
      if (attachedTrackRef.current === track && video.srcObject) {
        setHasVideo(true);
        if (video.readyState >= 2) setVideoReady(true);
        return;
      }
      detachVideo();
      attachedTrackRef.current = track;
      track.attach(video);
      video.muted = true;
      video.playsInline = true;
      video.autoplay = true;
      video.setAttribute('playsinline', 'true');
      video.setAttribute('webkit-playsinline', 'true');
      const markReady = () => {
        if (!cancelled) {
          setHasVideo(true);
          setVideoReady(true);
        }
      };
      video.onloadedmetadata = markReady;
      video.onloadeddata = markReady;
      video.onplaying = markReady;
      // Show live layer as soon as the track is attached — poster covers until frames paint.
      setHasVideo(true);
      void video.play().then(markReady).catch(() => {
        if (video.readyState >= 2) markReady();
        // Fallback: treat attached MediaStream as ready after a beat.
        window.setTimeout(() => {
          if (!cancelled && attachedTrackRef.current === track) markReady();
        }, 400);
      });
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

  // Keep <video> fully opaque under the poster so LiveKit always has a laid-out
  // element to decode into (opacity-0 starved adaptive/frame delivery before).
  const showLiveVideo = hasVideo && videoReady;

  return (
    <div ref={rootRef} className={`absolute inset-0 z-0 overflow-hidden bg-secondary ${className}`}>
      <video
        ref={videoRef}
        muted
        playsInline
        autoPlay
        className="absolute inset-0 z-0 h-full w-full object-cover"
      />
      <SafeMediaImage
        src={posterUrl}
        alt=""
        priority
        fallback={FALLBACK_MEDIA}
        className={`absolute inset-0 z-[1] h-full w-full object-cover transition-opacity duration-300 ${
          showLiveVideo ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
      />
      {!showLiveVideo && hasAudioLive ? (
        <div className="pointer-events-none absolute top-2 right-2 z-[2] flex items-center gap-1 rounded-md bg-black/45 px-1.5 py-0.5">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-[9px] font-bold uppercase tracking-wide text-white">Audio</span>
        </div>
      ) : null}
    </div>
  );
}
