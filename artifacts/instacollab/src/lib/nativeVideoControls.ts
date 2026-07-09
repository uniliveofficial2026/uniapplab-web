import type { VideoHTMLAttributes } from 'react';
import { isAndroidDevice, isIosLikeDevice } from './nativeVideoPlatform';

function controlBarInsetPx(override?: number): number {
  if (override != null) return override;
  return isIosLikeDevice() || isAndroidDevice() ? 96 : 72;
}

/** True when a pointer/touch event landed on the native browser video control bar. */
export function isNativeVideoControlsTarget(
  video: HTMLVideoElement,
  clientY: number,
  insetPx?: number
): boolean {
  const rect = video.getBoundingClientRect();
  return clientY - rect.top > rect.height - controlBarInsetPx(insetPx);
}

function eventClientY(
  e: React.MouseEvent | React.PointerEvent | React.TouchEvent
): number | null {
  if ('touches' in e && e.touches.length > 0) {
    return e.touches[0].clientY;
  }
  if ('changedTouches' in e && e.changedTouches.length > 0) {
    return e.changedTouches[0].clientY;
  }
  if ('clientY' in e && typeof e.clientY === 'number') {
    return e.clientY;
  }
  return null;
}

/** Stop bubbling so parent handlers ignore native control-bar taps (mouse + touch). */
export function stopIfNativeVideoControls(
  e: React.MouseEvent | React.PointerEvent | React.TouchEvent,
  insetPx?: number
): boolean {
  const target = e.currentTarget;
  if (!(target instanceof HTMLVideoElement)) return false;
  const clientY = eventClientY(e);
  if (clientY == null) return false;
  if (!isNativeVideoControlsTarget(target, clientY, insetPx)) return false;
  e.stopPropagation();
  return true;
}

type GuardProps = Pick<
  VideoHTMLAttributes<HTMLVideoElement>,
  'onClick' | 'onPointerDown' | 'onPointerUp' | 'onTouchStart' | 'onTouchEnd'
>;

/** Spread onto any `<video controls>` — iOS/Android safe. */
export function nativeVideoControlGuardProps(insetPx?: number): GuardProps {
  const guard = (
    e: React.MouseEvent<HTMLVideoElement> | React.PointerEvent<HTMLVideoElement> | React.TouchEvent<HTMLVideoElement>
  ) => {
    stopIfNativeVideoControls(e, insetPx);
  };
  return {
    onClick: guard,
    onPointerDown: guard,
    onPointerUp: guard,
    onTouchStart: guard,
    onTouchEnd: guard,
  };
}
