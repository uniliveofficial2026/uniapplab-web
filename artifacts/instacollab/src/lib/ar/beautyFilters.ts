import type { TencentBeautifyParams } from '../webar/webarTypes';
import type { BodyShapeParams } from './bodyShape';
import { BODY_SHAPE_COMING_SOON, isBodyShapeActive } from './bodyShape';
import { bodyShapeToTencent } from './bodyShapeTencent';

/** CSS fallback when Tencent WebAR credentials are not configured. */
export const BEAUTY_VIDEO_FILTERS: Record<string, string> = {
  'beauty-smooth': 'blur(0.4px) contrast(1.04) brightness(1.08) saturate(1.05)',
  'beauty-soft': 'blur(0.2px) brightness(1.05) saturate(1.02) contrast(1.02)',
  'beauty-glow': 'brightness(1.1) contrast(0.98) saturate(1.08)',
  'beauty-natural': 'brightness(1.04) contrast(1.03) saturate(1.04)',
  'beauty-clear': 'contrast(1.08) brightness(1.06) saturate(1.02)',
};

/** Maps live beauty presets → Tencent WebAR `setBeautify` params (quick-start style). */
export const BEAUTY_TENCENT_PARAMS: Record<string, TencentBeautifyParams> = {
  'beauty-smooth': {
    whiten: 0.35,
    dermabrasion: 0.65,
    lift: 0.2,
    shave: 0,
    eye: 0,
    chin: 0,
  },
  'beauty-soft': {
    whiten: 0.45,
    dermabrasion: 0.35,
    lift: 0.25,
    shave: 0.1,
    eye: 0.1,
    chin: 0,
  },
  'beauty-glow': {
    whiten: 0.55,
    dermabrasion: 0.25,
    lift: 0.15,
    shave: 0,
    eye: 0.15,
    chin: 0.05,
  },
  'beauty-natural': {
    whiten: 0.25,
    dermabrasion: 0.3,
    lift: 0.1,
    shave: 0,
    eye: 0.05,
    chin: 0,
  },
  'beauty-clear': {
    whiten: 0.4,
    dermabrasion: 0.5,
    lift: 0.2,
    shave: 0.1,
    eye: 0.2,
    chin: 0.1,
  },
};

export const BEAUTY_OFF_PARAMS: TencentBeautifyParams = {
  whiten: 0,
  dermabrasion: 0,
  lift: 0,
  shave: 0,
  eye: 0,
  chin: 0,
  cheekbone: 0,
  head: 0,
  eyeBrightness: 0,
  lip: 0,
  forehead: 0,
  nose: 0,
  usm: 0,
};

const SIGNED_BEAUTIFY_KEYS = new Set(['nose', 'lip']);

/** Whether any TRTC beautify slider / distort param is non-neutral. */
export function isTencentBeautifyActive(params: TencentBeautifyParams): boolean {
  if (typeof params.distort1 === 'number' && params.distort1 > 0.01) return true;
  if (typeof params.distort2 === 'number' && params.distort2 > 0.01) return true;
  return Object.entries(params).some(([key, value]) => {
    if (typeof value !== 'number') return false;
    if (SIGNED_BEAUTIFY_KEYS.has(key)) return Math.abs(value) > 0.01;
    return value > 0.01;
  });
}

/**
 * Prepare params for TRTC setBeautify.
 * - OFF: full zeroed payload (SDK partial-merge safe reset).
 * - ON: pass only active keys — do not inject zero sculpt keys over beauty presets.
 */
export function normalizeTencentBeautify(params: TencentBeautifyParams): TencentBeautifyParams {
  const turningOff = !isTencentBeautifyActive(params);
  const merged: TencentBeautifyParams = turningOff
    ? { ...BEAUTY_OFF_PARAMS, ...params }
    : { ...params };
  const out: TencentBeautifyParams = { ...merged };
  if (!out.distort1 || out.distort1 <= 0.01) {
    delete out.distort1;
    delete out.distortCenter1;
    delete out.distortMajorRadius1;
    delete out.distortMinorRadius1;
  }
  if (!out.distort2 || out.distort2 <= 0.01) {
    delete out.distort2;
    delete out.distortCenter2;
    delete out.distortMajorRadius2;
    delete out.distortMinorRadius2;
  }
  return out;
}

export type BeautyPresetId = 'none' | keyof typeof BEAUTY_VIDEO_FILTERS;

export type BeautyPresetOption = {
  id: BeautyPresetId;
  label: string;
  description: string;
  /** Pre-look swatch color for tray buttons. */
  swatch: string;
};

/** Live-room beauty tray options (Off + Tencent-style presets). */
export const LIVE_BEAUTY_PRESETS: BeautyPresetOption[] = [
  { id: 'none', label: 'Off', description: 'No beauty', swatch: '#3f3f46' },
  { id: 'beauty-smooth', label: 'Smooth', description: 'Skin smooth', swatch: '#f9a8d4' },
  { id: 'beauty-soft', label: 'Soft', description: 'Soft light', swatch: '#fda4af' },
  { id: 'beauty-glow', label: 'Glow', description: 'Bright glow', swatch: '#fcd34d' },
  { id: 'beauty-natural', label: 'Natural', description: 'Everyday', swatch: '#fde68a' },
  { id: 'beauty-clear', label: 'Clear', description: 'HD clear', swatch: '#93c5fd' },
];

export function isBeautyEffectId(effectId: string): boolean {
  return effectId in BEAUTY_VIDEO_FILTERS;
}

export function getBeautyVideoFilter(effectId: string): string | null {
  return BEAUTY_VIDEO_FILTERS[effectId] ?? null;
}

/** Pre-body-shape preset path — pass directly to TRTC setBeautify. */
export function getTencentBeautifyParams(effectId: string): TencentBeautifyParams {
  if (effectId === 'none' || !effectId) return { ...BEAUTY_OFF_PARAMS };
  return BEAUTY_TENCENT_PARAMS[effectId] ?? { ...BEAUTY_OFF_PARAMS };
}

/** Body-shape overlay — only when sliders are non-neutral. */
export function mergeBodyShapeBeautify(
  effectId: string,
  bodyShape: BodyShapeParams,
): TencentBeautifyParams {
  const shapeOverlay = bodyShapeToTencent(bodyShape);
  if (effectId === 'none' || !effectId) {
    return normalizeTencentBeautify(shapeOverlay);
  }
  const base = BEAUTY_TENCENT_PARAMS[effectId] ?? {};
  return normalizeTencentBeautify({ ...base, ...shapeOverlay });
}

export function resolveTencentBeautifyParams(
  effectId: string,
  bodyShape?: BodyShapeParams,
): TencentBeautifyParams {
  if (!BODY_SHAPE_COMING_SOON && bodyShape && isBodyShapeActive(bodyShape)) {
    return mergeBodyShapeBeautify(effectId, bodyShape);
  }
  return getTencentBeautifyParams(effectId);
}
