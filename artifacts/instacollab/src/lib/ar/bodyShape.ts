import type { TencentBeautifyParams } from '../webar/webarTypes';
import { getDeepAREffectPreviewCandidates } from '../deepar/deeparConfig';

/** Unified body / face sculpt controls (0–100, 50 = neutral). */
export type BodyShapeParams = {
  faceSlim: number;
  faceFull: number;
  jawline: number;
  eyeSize: number;
  chin: number;
  forehead: number;
  nose: number;
  lipFull: number;
  waistSlim: number;
  waistFull: number;
  bodySlim: number;
  bodyFull: number;
  longLegs: number;
  chestEnhance: number;
  hipEnhance: number;
  armSculpt: number;
  shoulderSculpt: number;
  headBodyRatio: number;
  clavicleDefine: number;
  abdomenDefine: number;
};

export const EMPTY_BODY_SHAPE: BodyShapeParams = {
  faceSlim: 50,
  faceFull: 50,
  jawline: 50,
  eyeSize: 50,
  chin: 50,
  forehead: 50,
  nose: 50,
  lipFull: 50,
  waistSlim: 50,
  waistFull: 50,
  bodySlim: 50,
  bodyFull: 50,
  longLegs: 50,
  chestEnhance: 50,
  hipEnhance: 50,
  armSculpt: 50,
  shoulderSculpt: 50,
  headBodyRatio: 50,
  clavicleDefine: 50,
  abdomenDefine: 50,
};

export type BodyShapePreset = {
  id: string;
  label: string;
  previewId: string;
  swatch: string;
  values: BodyShapeParams;
};

export const BODY_SHAPE_PRESETS: BodyShapePreset[] = [
  {
    id: 'shape-natural',
    label: 'Natural',
    previewId: 'shape-natural',
    swatch: '#a8a29e',
    values: { ...EMPTY_BODY_SHAPE },
  },
  {
    id: 'shape-slim-face',
    label: 'Slim Face',
    previewId: 'shape-slim-face',
    swatch: '#f9a8d4',
    values: { ...EMPTY_BODY_SHAPE, faceSlim: 78, jawline: 72, chin: 62 },
  },
  {
    id: 'shape-full-face',
    label: 'Full Face',
    previewId: 'shape-full-face',
    swatch: '#fda4af',
    values: { ...EMPTY_BODY_SHAPE, faceFull: 72, lipFull: 58 },
  },
  {
    id: 'shape-vline',
    label: 'V-Line',
    previewId: 'shape-vline',
    swatch: '#93c5fd',
    values: { ...EMPTY_BODY_SHAPE, faceSlim: 70, jawline: 80, chin: 68 },
  },
  {
    id: 'shape-big-eyes',
    label: 'Big Eyes',
    previewId: 'shape-big-eyes',
    swatch: '#fcd34d',
    values: { ...EMPTY_BODY_SHAPE, eyeSize: 75 },
  },
  {
    id: 'shape-model-waist',
    label: 'Slim Waist',
    previewId: 'shape-model-waist',
    swatch: '#c4b5fd',
    values: { ...EMPTY_BODY_SHAPE, waistSlim: 76, bodySlim: 68, faceSlim: 58 },
  },
  {
    id: 'shape-curvy',
    label: 'Curvy',
    previewId: 'shape-curvy',
    swatch: '#fb7185',
    values: {
      ...EMPTY_BODY_SHAPE,
      hipEnhance: 72,
      chestEnhance: 65,
      waistFull: 55,
      bodyFull: 60,
    },
  },
  {
    id: 'shape-long-legs',
    label: 'Long Legs',
    previewId: 'shape-long-legs',
    swatch: '#86efac',
    values: { ...EMPTY_BODY_SHAPE, longLegs: 78, headBodyRatio: 62, bodySlim: 60 },
  },
  {
    id: 'shape-athletic',
    label: 'Athletic',
    previewId: 'shape-athletic',
    swatch: '#67e8f9',
    values: {
      ...EMPTY_BODY_SHAPE,
      armSculpt: 70,
      shoulderSculpt: 68,
      abdomenDefine: 72,
      clavicleDefine: 65,
      bodySlim: 62,
    },
  },
  {
    id: 'shape-glam',
    label: 'Glam',
    previewId: 'shape-glam',
    swatch: '#f0abfc',
    values: {
      ...EMPTY_BODY_SHAPE,
      faceSlim: 62,
      eyeSize: 68,
      lipFull: 70,
      chestEnhance: 58,
      hipEnhance: 62,
    },
  },
];

/** Pre-look thumb URLs for shape preset tray buttons. */
export function getBodyShapePreviewCandidates(previewId: string): string[] {
  return getDeepAREffectPreviewCandidates(previewId);
}

export const BODY_SHAPE_SLIDER_GROUPS: Array<{
  title: string;
  sliders: Array<{ key: keyof BodyShapeParams; label: string }>;
}> = [
  {
    title: 'Face',
    sliders: [
      { key: 'faceSlim', label: 'Slim Face' },
      { key: 'faceFull', label: 'Full Face' },
      { key: 'jawline', label: 'Jawline' },
      { key: 'eyeSize', label: 'Eye Size' },
      { key: 'chin', label: 'Chin' },
      { key: 'forehead', label: 'Forehead' },
      { key: 'nose', label: 'Nose' },
      { key: 'lipFull', label: 'Lips' },
    ],
  },
  {
    title: 'Body',
    sliders: [
      { key: 'waistSlim', label: 'Slim Waist' },
      { key: 'waistFull', label: 'Full Waist' },
      { key: 'bodySlim', label: 'Slim Body' },
      { key: 'bodyFull', label: 'Full Body' },
      { key: 'longLegs', label: 'Long Legs' },
      { key: 'chestEnhance', label: 'Chest' },
      { key: 'hipEnhance', label: 'Hips' },
      { key: 'armSculpt', label: 'Arms' },
      { key: 'shoulderSculpt', label: 'Shoulders' },
      { key: 'headBodyRatio', label: 'Head Ratio' },
      { key: 'clavicleDefine', label: 'Clavicle' },
      { key: 'abdomenDefine', label: 'Abs' },
    ],
  },
];

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function sliderToMorph(slider: number, strength = 0.35): number {
  return clamp01(0.5 + ((slider - 50) / 50) * strength);
}

export function bodyShapeToTencent(shape: BodyShapeParams): Partial<TencentBeautifyParams> {
  const slim = (shape.faceSlim - 50) / 50;
  const jaw = (shape.jawline - 50) / 50;
  const eyes = (shape.eyeSize - 50) / 50;
  const chin = (shape.chin - 50) / 50;
  const waist = (shape.waistSlim - shape.waistFull) / 50;
  const body = (shape.bodySlim - shape.bodyFull) / 50;
  const legs = (shape.longLegs - 50) / 50;

  return {
    shave: clamp01(0.5 + slim * 0.45 + jaw * 0.15 + waist * 0.1 + body * 0.08),
    lift: clamp01(0.5 + (shape.forehead - 50) / 120 + waist * 0.12 + body * 0.06),
    eye: clamp01(0.5 + eyes * 0.5),
    chin: clamp01(0.5 + chin * 0.45 - jaw * 0.1 + legs * 0.05),
  };
}

export function isBodyShapeActive(shape: BodyShapeParams): boolean {
  return Object.values(shape).some((value) => Math.abs(value - 50) > 2);
}

export function bodyShapePresetById(id: string): BodyShapePreset | undefined {
  return BODY_SHAPE_PRESETS.find((preset) => preset.id === id);
}

export type DeepARBeautyMorphApi = {
  faceMorphing: {
    disable: (isDisabled: boolean) => Promise<void>;
    faceShape: { set: (n: number) => Promise<void> };
    jawlineShape: { set: (n: number) => Promise<void> };
    eyeSize: { set: (n: number) => Promise<void> };
    chinSize: { set: (n: number) => Promise<void> };
    foreheadSize: { set: (n: number) => Promise<void> };
    noseSize: { set: (n: number) => Promise<void> };
    lipFullness: { set: (n: number) => Promise<void> };
    lipsWidth: { set: (n: number) => Promise<void> };
    mouthPositionVertical: { set: (n: number) => Promise<void> };
    eyebrowsThickness: { set: (n: number) => Promise<void> };
  };
  skinSmoothing: { set: (n: number) => Promise<void> };
  disable: (isDisabled: boolean) => Promise<void>;
};

export async function applyBodyShapeToDeepAR(
  beauty: DeepARBeautyMorphApi,
  shape: BodyShapeParams,
): Promise<void> {
  if (!isBodyShapeActive(shape)) {
    await beauty.faceMorphing.disable(true);
    return;
  }

  const slim = (shape.faceSlim - 50) / 50;
  const full = (shape.faceFull - 50) / 50;
  const waist = (shape.waistSlim - shape.waistFull) / 50;
  const body = (shape.bodySlim - shape.bodyFull) / 50;
  const legs = (shape.longLegs - 50) / 50;
  const headRatio = (shape.headBodyRatio - 50) / 50;
  const lipBoost = (shape.lipFull - 50 + (shape.chestEnhance - 50) * 0.15) / 50;
  const smooth = clamp01(
    0.15 +
      Math.abs(slim) * 0.12 +
      Math.abs(waist) * 0.08 +
      Math.abs(body) * 0.08 +
      (shape.abdomenDefine - 50) / 200,
  );

  await beauty.disable(false);
  await beauty.faceMorphing.disable(false);

  await Promise.all([
    beauty.faceMorphing.faceShape.set(sliderToMorph(shape.faceSlim - full * 20)),
    beauty.faceMorphing.jawlineShape.set(sliderToMorph(shape.jawline)),
    beauty.faceMorphing.eyeSize.set(sliderToMorph(shape.eyeSize)),
    beauty.faceMorphing.chinSize.set(sliderToMorph(shape.chin - legs * 8)),
    beauty.faceMorphing.foreheadSize.set(sliderToMorph(shape.forehead - headRatio * 12)),
    beauty.faceMorphing.noseSize.set(sliderToMorph(shape.nose)),
    beauty.faceMorphing.lipFullness.set(sliderToMorph(50 + lipBoost * 50)),
    beauty.faceMorphing.lipsWidth.set(sliderToMorph(shape.lipFull)),
    beauty.faceMorphing.mouthPositionVertical.set(
      sliderToMorph(50 + (shape.hipEnhance - 50) * 0.12),
    ),
    beauty.faceMorphing.eyebrowsThickness.set(
      sliderToMorph(50 + (shape.shoulderSculpt - 50) * 0.25),
    ),
    beauty.skinSmoothing.set(smooth * 0.45),
  ]);
}
