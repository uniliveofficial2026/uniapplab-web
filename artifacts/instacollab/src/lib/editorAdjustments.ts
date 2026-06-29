import type { CSSProperties } from 'react';
import { buildMediaFilterStyle, mediaFilterEffectCss } from './mediaFilters';

export type CropAspectId = 'free' | '1:1' | '4:5' | '9:16' | '16:9';

export type MediaEditorAdjustments = {
  brightness: number;
  contrast: number;
  saturation: number;
  warmth: number;
  sharpen: number;
  vignette: number;
  rotate: 0 | 90 | 180 | 270;
  flipH: boolean;
  flipV: boolean;
  cropAspect: CropAspectId;
  cropZoom: number;
};

export type VideoEditorAdjustments = {
  playbackSpeed: number;
  volume: number;
  coverFrame: number;
};

export type TextEditorExtras = {
  animation: 'none' | 'fade' | 'slide' | 'typewriter' | 'bounce';
  lineHeight: number;
  letterSpacing: number;
};

export const DEFAULT_MEDIA_EDITOR_ADJUSTMENTS: MediaEditorAdjustments = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  warmth: 50,
  sharpen: 100,
  vignette: 0,
  rotate: 0,
  flipH: false,
  flipV: false,
  cropAspect: 'free',
  cropZoom: 100,
};

export const DEFAULT_VIDEO_EDITOR_ADJUSTMENTS: VideoEditorAdjustments = {
  playbackSpeed: 1,
  volume: 100,
  coverFrame: 0,
};

export const DEFAULT_TEXT_EDITOR_EXTRAS: TextEditorExtras = {
  animation: 'none',
  lineHeight: 1.2,
  letterSpacing: 0,
};

export function buildMediaEditorStyle(
  filterId: string | undefined,
  adjustments: Partial<MediaEditorAdjustments> = {},
  options?: { preview?: boolean }
): CSSProperties {
  const a = { ...DEFAULT_MEDIA_EDITOR_ADJUSTMENTS, ...adjustments };
  const effect = mediaFilterEffectCss(filterId, { preview: options?.preview });
  const warmthOffset = a.warmth - 50;
  const warmthCss =
    warmthOffset !== 0
      ? `sepia(${Math.min(40, Math.abs(warmthOffset) * 1.2)}%) hue-rotate(${warmthOffset * -0.8}deg)`
      : '';
  const sharpenCss = a.sharpen !== 100 ? `contrast(${a.sharpen}%)` : '';

  const parts = [
    effect !== 'none' ? effect : '',
    warmthCss,
    sharpenCss,
    `brightness(${a.brightness}%)`,
    `contrast(${a.contrast}%)`,
    `saturate(${a.saturation}%)`,
  ].filter(Boolean);

  const transforms: string[] = [];
  if (a.rotate) transforms.push(`rotate(${a.rotate}deg)`);
  if (a.flipH) transforms.push('scaleX(-1)');
  if (a.flipV) transforms.push('scaleY(-1)');
  if (a.cropZoom !== 100) transforms.push(`scale(${a.cropZoom / 100})`);

  return {
    filter: parts.length ? parts.join(' ') : undefined,
    transform: transforms.length ? transforms.join(' ') : undefined,
  };
}

/** @deprecated use buildMediaEditorStyle — kept for existing call sites */
export function buildMediaFilterStyleWithAdjustments(
  filterId: string | undefined,
  options?: { brightness?: number; contrast?: number; preview?: boolean }
): CSSProperties {
  return buildMediaEditorStyle(
    filterId,
    { brightness: options?.brightness, contrast: options?.contrast },
    { preview: options?.preview }
  );
}

export function cropAspectClass(aspect: CropAspectId): string {
  switch (aspect) {
    case '1:1':
      return 'aspect-square object-cover';
    case '4:5':
      return 'aspect-[4/5] object-cover';
    case '9:16':
      return 'aspect-[9/16] object-cover';
    case '16:9':
      return 'aspect-video object-cover';
    default:
      return 'object-contain';
  }
}

export function textAnimationClass(animation: TextEditorExtras['animation']): string {
  switch (animation) {
    case 'fade':
      return 'editor-text-anim-fade';
    case 'slide':
      return 'editor-text-anim-slide';
    case 'typewriter':
      return 'editor-text-anim-typewriter';
    case 'bounce':
      return 'editor-text-anim-bounce';
    default:
      return '';
  }
}
