import {
  bodyShapeToTencent,
  EMPTY_BODY_SHAPE,
  isBodyShapeActive,
  type BodyShapeParams,
} from './bodyShape';
import type { TencentBeautifyParams } from '../webar/webarTypes';

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
};

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

export function getTencentBeautifyParams(
  effectId: string,
  bodyShape?: Partial<BodyShapeParams>,
): TencentBeautifyParams {
  const mergedShape = { ...EMPTY_BODY_SHAPE, ...bodyShape };
  const shapeOverlay = isBodyShapeActive(mergedShape) ? bodyShapeToTencent(mergedShape) : {};
  if (effectId === 'none' || !effectId) {
    return { ...BEAUTY_OFF_PARAMS, ...shapeOverlay };
  }
  const base = BEAUTY_TENCENT_PARAMS[effectId] ?? BEAUTY_OFF_PARAMS;
  if (!isBodyShapeActive(mergedShape)) return base;
  return {
    ...base,
    lift: shapeOverlay.lift ?? base.lift,
    shave: shapeOverlay.shave ?? base.shave,
    eye: shapeOverlay.eye ?? base.eye,
    chin: shapeOverlay.chin ?? base.chin,
  };
}
