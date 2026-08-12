import { useEffect, useRef, type CSSProperties } from 'react';
import { keepMediaStreamOnVideo } from '../../lib/camera/bindMediaStreamToVideo';

/** Full-bleed camera / remote video — edge-to-edge behind call chrome. */
export const CALL_VIDEO_FULLSCREEN_CLASS =
  'absolute inset-0 block h-full w-full min-h-full min-w-full object-cover object-center';

/** Fills a `relative` tile parent (PiP self-view, compact grid cells). */
export const CALL_VIDEO_FILL_CLASS =
  'absolute inset-0 block h-full w-full object-cover object-center';

export type CallVideoFraming = 'cover' | 'contain' | 'wide';

const FRAMING_OBJECT_CLASS: Record<CallVideoFraming, string> = {
  cover: 'object-cover',
  contain: 'object-contain',
  /** Same as cover — kept for callers; do not overscan (overscan looked like a zoom jump). */
  wide: 'object-cover',
};

/**
 * Overscan factor for `wide`. Kept at 1 so local preview FOV matches beauty/effects output.
 */
const FRAMING_OVERSCAN: Record<CallVideoFraming, number> = {
  cover: 1,
  contain: 1,
  wide: 1,
};

export function callVideoStreamHasFrames(stream: MediaStream | null | undefined): boolean {
  return Boolean(stream?.getVideoTracks().some((track) => track.readyState === 'live'));
}

function streamHasVideoTrack(stream: MediaStream | null | undefined): boolean {
  return Boolean(stream?.getVideoTracks().length);
}

type CallVideoSurfaceProps = {
  stream: MediaStream | null | undefined;
  mirrored?: boolean;
  className?: string;
  label?: string;
  /** `fullscreen` = stage background; `fill` = inside a sized relative parent. */
  layout?: 'fullscreen' | 'fill';
  /** How the frame is cropped/scaled inside its box. Local self-view defaults to `wide`. */
  framing?: CallVideoFraming;
  /** @deprecated use layout="fullscreen" */
  fullscreen?: boolean;
};

function layoutClass(
  layout: 'fullscreen' | 'fill',
  framing: CallVideoFraming,
  extra: string,
): string {
  if (framing === 'wide') {
    const objectClass = FRAMING_OBJECT_CLASS[framing];
    const merged = `absolute block ${objectClass}`;
    return extra ? `${merged} ${extra}` : merged;
  }

  const base =
    layout === 'fullscreen' ? CALL_VIDEO_FULLSCREEN_CLASS : CALL_VIDEO_FILL_CLASS;
  const objectClass = FRAMING_OBJECT_CLASS[framing];
  const merged = `${base} ${objectClass}`;
  const trimmed = extra.trim();
  if (!trimmed) return merged;
  const existing = new Set(merged.split(/\s+/).filter(Boolean));
  const extras = trimmed.split(/\s+/).filter((token) => token && !existing.has(token));
  return [...merged.split(/\s+/).filter(Boolean), ...extras].join(' ');
}

function videoStyle(mirrored: boolean, framing: CallVideoFraming): CSSProperties {
  const overscan = FRAMING_OVERSCAN[framing];
  const mirror = mirrored ? 'scaleX(-1)' : '';
  const gpu = 'translateZ(0)';

  if (overscan > 1) {
    const size = `${overscan * 100}%`;
    const transform = ['translate(-50%, -50%)', mirror, gpu].filter(Boolean).join(' ');
    return {
      position: 'absolute',
      left: '50%',
      top: '50%',
      width: size,
      height: size,
      transform,
      WebkitTransform: transform,
      transformOrigin: 'center center',
    };
  }

  const transform = [mirror, gpu].filter(Boolean).join(' ');
  return {
    transform,
    WebkitTransform: transform,
    transformOrigin: 'center center',
  };
}

/**
 * Binds a MediaStream to a video element — works with LiveKit tracks and getUserMedia.
 * Always mounts the <video> whenever a video track exists (never blank for "loading" frames).
 */
export function CallVideoSurface({
  stream,
  mirrored = false,
  className = '',
  label,
  layout,
  framing,
  fullscreen = false,
}: CallVideoSurfaceProps) {
  const ref = useRef<HTMLVideoElement>(null);
  const resolvedLayout = layout ?? (fullscreen ? 'fullscreen' : 'fill');
  /** Always cover — never default mirrored local to a different crop than beauty. */
  const resolvedFraming: CallVideoFraming = framing ?? 'cover';

  useEffect(() => {
    const el = ref.current;
    if (!el || !streamHasVideoTrack(stream) || !stream) return undefined;
    return keepMediaStreamOnVideo(el, stream, {
      muted: true,
      keepAlive: true,
      keepAliveMs: 2500,
    });
  }, [stream, mirrored]);

  if (!streamHasVideoTrack(stream)) {
    return null;
  }

  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted
      aria-label={label}
      className={layoutClass(resolvedLayout, resolvedFraming, className.trim())}
      style={videoStyle(mirrored, resolvedFraming)}
    />
  );
}
