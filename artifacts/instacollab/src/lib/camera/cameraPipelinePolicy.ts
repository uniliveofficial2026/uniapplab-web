/**
 * Unified camera + TRTC policy for every surface (live, calls, capture, karaoke).
 * Goals: one shared device camera via appCameraOwner (no flicker / no dual GUM), lazy TRTC GPU work.
 * Cross-platform: soft-disable beauty when WebGL / secure context is missing.
 */
import { isTencentWebARConfigured } from '../webar/webarConfig';
import {
  WEBAR_CAMERA_FRAME_RATE,
  WEBAR_CAMERA_HEIGHT,
  WEBAR_CAMERA_IDEAL,
  WEBAR_CAMERA_WIDTH,
} from '../webar/webarCameraConfig';
import {
  explainInsecureMediaContext,
  getPlatformRuntime,
  isBeautyRuntimeSupported,
  peekPlatformRuntime,
} from '../platform/runtime';

/** Lightweight lane when TRTC credentials are absent. */
export const LIVE_VIDEO_IDEAL = { width: 640, height: 360 } as const;

/** Mobile-friendly capture — slightly below desktop to keep beauty GPU latency down. */
export const MOBILE_CAMERA_IDEAL = { width: 960, height: 540 } as const;

/** Desktop TRTC capture — match official WebAR 1280×720. */
export const DESKTOP_CAMERA_IDEAL = {
  width: WEBAR_CAMERA_WIDTH,
  height: WEBAR_CAMERA_HEIGHT,
} as const;

export function isMobileCaptureDevice(): boolean {
  const runtime = peekPlatformRuntime();
  if (runtime.form === 'phone' || runtime.form === 'tablet') return true;
  if (runtime.capabilities.isTouchPrimary && runtime.form !== 'desktop') return true;
  return false;
}

export function assertMediaSecureContext(): void {
  const runtime = getPlatformRuntime();
  if (!runtime.capabilities.isSecureContext) {
    throw new Error(explainInsecureMediaContext());
  }
  if (!runtime.capabilities.supportsMediaDevices) {
    throw new Error('Camera is not supported in this browser.');
  }
}

/**
 * Beauty / WebAR may run only when credentials exist AND the device can host WebGL
 * in a secure context. Otherwise callers should fall back to raw LiveKit / CSS beauty.
 */
export function isBeautyPipelineAvailable(): boolean {
  return isTencentWebARConfigured() && isBeautyRuntimeSupported();
}

export function explainBeautyUnavailable(): string | null {
  if (!isTencentWebARConfigured()) return null;
  const runtime = peekPlatformRuntime();
  if (!runtime.capabilities.isSecureContext) return explainInsecureMediaContext();
  if (!runtime.capabilities.supportsWebGl) {
    return 'Beauty effects need WebGL on this device. Continuing without beauty filters.';
  }
  if (!runtime.capabilities.supportsMediaDevices) {
    return 'Camera is not available in this browser. Continuing without beauty filters.';
  }
  return null;
}

/**
 * Pick capture resolution once per camera mount.
 * Never change mid-session — toggling beauty must not restart getUserMedia.
 */
export function getStableCameraIdeal(trtcCapable = isBeautyPipelineAvailable()): {
  width: number;
  height: number;
} {
  if (!trtcCapable) return LIVE_VIDEO_IDEAL;
  return isMobileCaptureDevice() ? MOBILE_CAMERA_IDEAL : DESKTOP_CAMERA_IDEAL;
}

/** Prefer user-facing camera on phones; environment is rare for social live. */
export function getDefaultFacingMode(): 'user' | 'environment' {
  return isMobileCaptureDevice() ? 'user' : 'user';
}

export { WEBAR_CAMERA_FRAME_RATE, WEBAR_CAMERA_IDEAL, WEBAR_CAMERA_WIDTH, WEBAR_CAMERA_HEIGHT };

/** Preload TRTC JS when any camera may open (cheap — no GPU instance). */
export function shouldPreloadTrtcModule(): boolean {
  return isBeautyPipelineAvailable();
}

/** Full TRTC SDK instance — catalogs and/or effect processing. */
export function shouldRunTrtcEngine(opts: {
  trtcCapable: boolean;
  beautySelected: boolean;
  beautyPanelOpen: boolean;
}): boolean {
  if (!opts.trtcCapable || !isBeautyPipelineAvailable()) return false;
  return opts.beautySelected || opts.beautyPanelOpen;
}

/** GPU beauty processing on the output stream. */
export function shouldRunTrtcProcessing(opts: {
  trtcCapable: boolean;
  beautySelected: boolean;
}): boolean {
  return opts.trtcCapable && opts.beautySelected && isBeautyPipelineAvailable();
}
