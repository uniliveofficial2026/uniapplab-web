/**
 * Unified camera + TRTC policy for every surface (live, calls, capture, karaoke).
 * Goals: one stable getUserMedia resolution per mount (no flicker), lazy TRTC GPU work.
 */
import { isTencentWebARConfigured } from '../webar/webarConfig';
import {
  WEBAR_CAMERA_FRAME_RATE,
  WEBAR_CAMERA_HEIGHT,
  WEBAR_CAMERA_IDEAL,
  WEBAR_CAMERA_WIDTH,
} from '../webar/webarCameraConfig';

/** Lightweight lane when TRTC credentials are absent. */
export const LIVE_VIDEO_IDEAL = { width: 480, height: 360 } as const;

/** Mobile-friendly TRTC capture — less CPU than full 720p. */
export const MOBILE_CAMERA_IDEAL = { width: 960, height: 540 } as const;

function isMobileCaptureDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const coarse = window.matchMedia?.('(max-width: 768px), (pointer: coarse)')?.matches;
  if (coarse) return true;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

/**
 * Pick capture resolution once per camera mount.
 * Never change mid-session — toggling beauty must not restart getUserMedia.
 */
export function getStableCameraIdeal(trtcCapable = isTencentWebARConfigured()): {
  width: number;
  height: number;
} {
  if (!trtcCapable) return LIVE_VIDEO_IDEAL;
  return isMobileCaptureDevice() ? MOBILE_CAMERA_IDEAL : WEBAR_CAMERA_IDEAL;
}

export { WEBAR_CAMERA_FRAME_RATE, WEBAR_CAMERA_IDEAL, WEBAR_CAMERA_WIDTH, WEBAR_CAMERA_HEIGHT };

/** Preload TRTC JS when any camera may open (cheap — no GPU instance). */
export function shouldPreloadTrtcModule(): boolean {
  return isTencentWebARConfigured();
}

/** Full TRTC SDK instance — catalogs and/or effect processing. */
export function shouldRunTrtcEngine(opts: {
  trtcCapable: boolean;
  beautySelected: boolean;
  beautyPanelOpen: boolean;
}): boolean {
  if (!opts.trtcCapable) return false;
  return opts.beautySelected || opts.beautyPanelOpen;
}

/** GPU beauty processing on the output stream. */
export function shouldRunTrtcProcessing(opts: {
  trtcCapable: boolean;
  beautySelected: boolean;
}): boolean {
  return opts.trtcCapable && opts.beautySelected;
}
