import { useEffect, useRef, type RefObject } from 'react';
import { Track, type RemoteTrack } from 'livekit-client';
import { useSeatTileTap } from '../hooks/useSeatTileTap';
import { safeAvatarUrl } from '../../lib/safe';

export type LiveSeatFullscreenTarget = {
  seatKey: string;
  guestName: string;
  guestAvatar: string;
  guestUserId: string | null;
  isSelf: boolean;
};

type LiveSeatFullscreenOverlayProps = {
  target: LiveSeatFullscreenTarget | null;
  onClose: () => void;
  remoteVideoByUserId?: ReadonlyMap<string, RemoteTrack>;
  rawVideoRef?: RefObject<HTMLVideoElement | null>;
  beautyVideoRef?: RefObject<HTMLVideoElement | null>;
  showBeautyPreview?: boolean;
  showDeeparPreview?: boolean;
  deeparPreviewRef?: RefObject<HTMLDivElement | null>;
  /** Mirror self preview (front camera). Frozen when fullscreen opens — no auto flip. */
  mirrorSelf?: boolean;
};

function playVideoElement(element: HTMLVideoElement) {
  element.muted = true;
  element.playsInline = true;
  void element.play().catch(() => {});
}

export function LiveSeatFullscreenOverlay({
  target,
  onClose,
  remoteVideoByUserId,
  rawVideoRef,
  beautyVideoRef,
  showBeautyPreview = false,
  showDeeparPreview = false,
  deeparPreviewRef,
  mirrorSelf = false,
}: LiveSeatFullscreenOverlayProps) {
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const selfVideoRef = useRef<HTMLVideoElement>(null);
  const frozenMirrorRef = useRef(false);
  const frozenTargetKeyRef = useRef<string | null>(null);
  const mirrorSelfRef = useRef(mirrorSelf);
  mirrorSelfRef.current = mirrorSelf;
  const handleSeatTileTap = useSeatTileTap();

  const remoteTrack =
    target && !target.isSelf && target.guestUserId
      ? remoteVideoByUserId?.get(target.guestUserId) ?? null
      : null;
  const hasRemoteVideo = Boolean(remoteTrack);

  useEffect(() => {
    if (!target) {
      frozenMirrorRef.current = false;
      frozenTargetKeyRef.current = null;
      return;
    }
    const key = `${target.seatKey}:${target.guestUserId ?? ''}`;
    if (frozenTargetKeyRef.current !== key) {
      frozenTargetKeyRef.current = key;
      frozenMirrorRef.current = target.isSelf ? mirrorSelfRef.current : false;
    }
  }, [target]);

  useEffect(() => {
    if (!target?.isSelf || !selfVideoRef.current) return undefined;
    const source =
      showBeautyPreview && beautyVideoRef?.current
        ? beautyVideoRef.current
        : rawVideoRef?.current;
    const output = selfVideoRef.current;
    if (!source?.srcObject) {
      output.removeAttribute('src');
      output.srcObject = null;
      return undefined;
    }
    output.srcObject = source.srcObject;
    playVideoElement(output);
    return () => {
      output.srcObject = null;
    };
  }, [beautyVideoRef, rawVideoRef, showBeautyPreview, target]);

  useEffect(() => {
    if (!target || target.isSelf || !hasRemoteVideo) return undefined;
    const element = remoteVideoRef.current;
    if (!element || !remoteTrack || remoteTrack.kind !== Track.Kind.Video) return undefined;
    remoteTrack.attach(element);
    playVideoElement(element);
    return () => {
      remoteTrack.detach(element);
    };
  }, [hasRemoteVideo, remoteTrack, target]);

  if (!target) return null;

  const showSelfDeepar = target.isSelf && showDeeparPreview && deeparPreviewRef?.current;
  const mirrorClass =
    target.isSelf && frozenMirrorRef.current && !showSelfDeepar
      ? ' live-seat-fullscreen-video--mirror'
      : '';

  return (
    <div
      className="live-seat-fullscreen-overlay"
      role="dialog"
      aria-label={`${target.guestName} live fullscreen`}
    >
      <button
        type="button"
        className="live-seat-fullscreen-surface"
        onClick={() =>
          handleSeatTileTap(
            () => {},
            () => onClose(),
          )
        }
        aria-label="Double tap to close fullscreen"
      >
        {target.isSelf ? (
          showSelfDeepar ? (
            <div
              className="live-seat-fullscreen-deepar-host"
              ref={(node) => {
                const source = deeparPreviewRef?.current;
                if (!node || !source) return;
                if (node.firstChild !== source) {
                  node.replaceChildren(source);
                }
                source.style.position = 'absolute';
                source.style.inset = '0';
                source.style.width = '100%';
                source.style.height = '100%';
              }}
            />
          ) : (
            <video
              ref={selfVideoRef}
              muted
              playsInline
              autoPlay
              className={`live-seat-fullscreen-video${mirrorClass}`}
            />
          )
        ) : (
          <>
            <img
              src={safeAvatarUrl(target.guestAvatar)}
              alt=""
              className="live-seat-fullscreen-fallback"
            />
            {hasRemoteVideo ? (
              <video
                ref={remoteVideoRef}
                muted
                playsInline
                autoPlay
                className="live-seat-fullscreen-video"
              />
            ) : null}
          </>
        )}
        <div className="live-seat-fullscreen-caption">
          <p className="truncate text-center text-sm font-black text-white">{target.guestName}</p>
          <p className="mt-1 text-center text-[10px] font-bold uppercase tracking-widest text-white/45">
            Double tap to close
          </p>
        </div>
      </button>
    </div>
  );
}
