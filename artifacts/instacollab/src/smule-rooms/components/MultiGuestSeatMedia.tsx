import React, { useEffect, useRef } from 'react';
import type { RemoteTrack } from '../../lib/rtc/livekitCompatibilityBoundary';
import { Track } from '../../lib/rtc/livekitCompatibilityBoundary';
import { safeAvatarUrl } from '../../lib/safe';

type MultiGuestSeatMediaProps = {
  guestUserId: string | null;
  guestName: string;
  guestAvatar: string;
  isSelf: boolean;
  cameraOn?: boolean;
  remoteVideoByUserId: ReadonlyMap<string, RemoteTrack>;
  /** Transparent hole in the self seat tile — stable media renders in MultiGuestSelfMediaHost */
  selfTileAnchorRef?: React.RefObject<HTMLDivElement | null>;
};

function playVideoElement(element: HTMLVideoElement) {
  element.muted = true;
  element.playsInline = true;
  void element.play().catch(() => {});
}

/**
 * Avatar paints instantly; remote LiveKit video upgrades on top when ready.
 */
export const MultiGuestSeatMedia: React.FC<MultiGuestSeatMediaProps> = ({
  guestUserId,
  guestName,
  guestAvatar,
  isSelf,
  cameraOn = true,
  remoteVideoByUserId,
  selfTileAnchorRef,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  const remoteTrack =
    guestUserId && !isSelf ? remoteVideoByUserId.get(guestUserId) ?? null : null;

  const hasRemoteVideo = Boolean(remoteTrack);

  useEffect(() => {
    if (isSelf || !hasRemoteVideo) return undefined;
    const element = videoRef.current;
    if (!element || !remoteTrack || remoteTrack.kind !== Track.Kind.Video) return undefined;

    remoteTrack.attach(element);
    playVideoElement(element);
    return () => {
      remoteTrack.detach(element);
    };
  }, [hasRemoteVideo, isSelf, remoteTrack]);

  if (isSelf && cameraOn && selfTileAnchorRef) {
    return (
      <div
        ref={selfTileAnchorRef}
        className="multi-guest-video-tile-self-anchor"
        aria-hidden
      />
    );
  }

  return (
    <>
      <img
        src={safeAvatarUrl(guestAvatar)}
        alt={guestName}
        className="multi-guest-video-tile-media"
      />
      {hasRemoteVideo ? (
        <video
          ref={videoRef}
          muted
          playsInline
          autoPlay
          className="multi-guest-video-tile-media"
        />
      ) : null}
    </>
  );
};
