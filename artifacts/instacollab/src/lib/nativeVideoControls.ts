import type { VideoHTMLAttributes } from 'react';

/** True when a pointer event landed on the native browser video control bar. */
export function isNativeVideoControlsTarget(
  video: HTMLVideoElement,
  clientY: number,
  insetPx = 72
): boolean {
  const rect = video.getBoundingClientRect();
  return clientY - rect.top > rect.height - insetPx;
}

/** Stop bubbling so parent tap-to-play handlers ignore control-bar clicks. */
export function stopIfNativeVideoControls(
  e: React.MouseEvent | React.PointerEvent,
  insetPx = 72
): boolean {
  const target = e.currentTarget;
  if (!(target instanceof HTMLVideoElement)) return false;
  if (!isNativeVideoControlsTarget(target, e.clientY, insetPx)) return false;
  e.stopPropagation();
  return true;
}

type GuardProps = Pick<
  VideoHTMLAttributes<HTMLVideoElement>,
  'onClick' | 'onPointerDown' | 'onPointerUp'
>;

/** Spread onto any `<video controls>` so mute/volume taps do not bubble to parents. */
export function nativeVideoControlGuardProps(insetPx = 72): GuardProps {
  const guard = (e: React.MouseEvent<HTMLVideoElement> | React.PointerEvent<HTMLVideoElement>) => {
    stopIfNativeVideoControls(e, insetPx);
  };
  return {
    onClick: guard,
    onPointerDown: guard,
    onPointerUp: guard,
  };
}
