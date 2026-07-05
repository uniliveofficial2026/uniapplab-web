import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { drawSegmentationComposite, drawVideoFrame } from './composite';
import { getEffectProfile } from './effectProfiles';
import { drawProceduralEffect } from './proceduralEffects';

export type RenderFrameInput = {
  ctx: CanvasRenderingContext2D;
  video: HTMLVideoElement;
  width: number;
  height: number;
  mirror: boolean;
  effectId: string;
  landmarks: NormalizedLandmark[] | null;
  mask: Float32Array | null;
  maskWidth: number;
  maskHeight: number;
  timeMs: number;
  smileScore: number;
};

export function renderFrame(input: RenderFrameInput): void {
  const {
    ctx,
    video,
    width,
    height,
    mirror,
    effectId,
    landmarks,
    mask,
    maskWidth,
    maskHeight,
    timeMs,
    smileScore,
  } = input;

  if (effectId === 'none') {
    drawVideoFrame(ctx, video, mirror, width, height);
    return;
  }

  const profile = getEffectProfile(effectId);

  if (profile.kind === 'segment-bg') {
    if (!mask) {
      drawVideoFrame(ctx, video, mirror, width, height);
      return;
    }

    drawSegmentationComposite(ctx, video, mirror, width, height, mask, maskWidth, maskHeight, (bgCtx, w, h) => {
      if (effectId === 'background_blur') {
        bgCtx.filter = 'blur(18px) saturate(1.1)';
        drawVideoFrame(bgCtx, video, mirror, w, h);
        bgCtx.filter = 'none';
        return;
      }
      if (effectId === 'background_replacement') {
        bgCtx.fillStyle = '#ffffff';
        bgCtx.fillRect(0, 0, w, h);
        return;
      }
      if (effectId === 'burning') {
        const gradient = bgCtx.createLinearGradient(0, 0, w, h);
        gradient.addColorStop(0, '#2b0000');
        gradient.addColorStop(0.5, '#ff4500');
        gradient.addColorStop(1, '#ffd27a');
        bgCtx.fillStyle = gradient;
        bgCtx.fillRect(0, 0, w, h);
        return;
      }
      const gradient = bgCtx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w);
      gradient.addColorStop(0, '#4c1d95');
      gradient.addColorStop(0.5, '#312e81');
      gradient.addColorStop(1, '#020617');
      bgCtx.fillStyle = gradient;
      bgCtx.fillRect(0, 0, w, h);
    });
    return;
  }

  drawVideoFrame(ctx, video, mirror, width, height);
  if (!landmarks?.length) return;

  drawProceduralEffect({
    ctx,
    landmarks,
    width,
    height,
    mirror,
    effectId,
    kind: profile.kind,
    timeMs,
    smileScore,
  });
}
