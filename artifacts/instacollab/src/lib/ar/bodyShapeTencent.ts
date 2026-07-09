import type { TencentBeautifyParams } from '../webar/webarTypes';
import type { BodyShapeParams } from './bodyShape';

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function clamp11(n: number): number {
  return Math.max(-1, Math.min(1, n));
}

/** UI slider 50 → TRTC 0 (no effect). One-sided 0–1 params. */
export function sliderToTrtc01(slider: number, strength = 1): number {
  return clamp01(((slider - 50) / 50) * strength);
}

/** UI slider 50 → TRTC 0. Signed −1–1 params (nose, lip). */
export function sliderToTrtcSigned(slider: number, strength = 1): number {
  return clamp11(((slider - 50) / 50) * strength);
}

/**
 * Map BodyShapeTray sliders → TRTC BeautyKit `setBeautify` params.
 * @see https://www.tencentcloud.com/document/product/1143/50106
 */
export function bodyShapeToTencent(shape: BodyShapeParams): TencentBeautifyParams {
  const faceSlim = sliderToTrtc01(shape.faceSlim, 0.85);
  const faceFull = sliderToTrtc01(shape.faceFull, 0.55);
  const jaw = sliderToTrtc01(shape.jawline, 0.8);
  const eyes = sliderToTrtc01(shape.eyeSize, 0.85);
  const chin = sliderToTrtc01(shape.chin, 0.75);
  const forehead = sliderToTrtc01(shape.forehead, 0.7);
  const nose = sliderToTrtcSigned(shape.nose, 0.85);
  const lip = sliderToTrtcSigned(shape.lipFull, 0.85);
  const head = sliderToTrtc01(shape.headBodyRatio, 0.7);
  const waistSlim = sliderToTrtc01(shape.waistSlim, 0.8);
  const waistFull = sliderToTrtc01(shape.waistFull, 0.5);
  const bodySlim = sliderToTrtc01(shape.bodySlim, 0.75);
  const bodyFull = sliderToTrtc01(shape.bodyFull, 0.5);
  const legs = sliderToTrtc01(shape.longLegs, 0.8);
  const chest = sliderToTrtc01(shape.chestEnhance, 0.55);
  const hips = sliderToTrtc01(shape.hipEnhance, 0.55);
  const arms = sliderToTrtc01(shape.armSculpt, 0.6);
  const shoulders = sliderToTrtc01(shape.shoulderSculpt, 0.55);
  const clavicle = sliderToTrtc01(shape.clavicleDefine, 0.5);
  const abs = sliderToTrtc01(shape.abdomenDefine, 0.45);

  const lift = clamp01(faceSlim * 0.9 + jaw * 0.25 - faceFull * 0.35);
  const shave = clamp01(faceSlim * 0.55 + jaw * 0.65 - faceFull * 0.2);
  const cheekbone = clamp01(jaw * 0.75 + faceSlim * 0.2);
  const torsoSlim = clamp01(waistSlim * 0.85 + bodySlim * 0.7 - waistFull * 0.4 - bodyFull * 0.35);
  const lowerStretch = clamp01(legs * 0.85 + bodySlim * 0.15);
  const upperTone = clamp01(chest * 0.35 + shoulders * 0.45 + clavicle * 0.35 + arms * 0.25);

  const params: TencentBeautifyParams = {
    lift,
    shave,
    eye: eyes,
    chin: clamp01(chin + jaw * 0.15 - legs * 0.05),
    cheekbone,
    head,
    forehead,
    nose,
    lip,
    eyeBrightness: clamp01(eyes * 0.35 + abs * 0.2),
    usm: clamp01(abs * 0.55 + clavicle * 0.25),
  };

  if (torsoSlim > 0.02 || upperTone > 0.02) {
    params.distort1 = clamp01(torsoSlim * 0.9 + upperTone * 0.25);
    params.distortCenter1 = '0.5,0.56';
    params.distortMajorRadius1 = 0.24;
    params.distortMinorRadius1 = 0.2;
  }

  if (lowerStretch > 0.02 || hips > 0.02) {
    params.distort2 = clamp01(lowerStretch * 0.85 + hips * 0.35);
    params.distortCenter2 = '0.5,0.8';
    params.distortMajorRadius2 = 0.22;
    params.distortMinorRadius2 = 0.16;
  }

  return params;
}
