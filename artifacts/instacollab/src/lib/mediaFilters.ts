import type { CSSProperties } from 'react';

export type MediaFilterId =
  | 'none'
  | 'grayscale'
  | 'sepia'
  | 'blur'
  | 'noir'
  | 'vintage'
  | 'sunset'
  | 'cold'
  | 'chrome';

export const MEDIA_FILTER_PRESETS: ReadonlyArray<{ id: MediaFilterId; name: string }> = [
  { id: 'none', name: 'Normal' },
  { id: 'grayscale', name: 'Grayscale' },
  { id: 'sepia', name: 'Sepia' },
  { id: 'blur', name: 'Soft Blur' },
  { id: 'noir', name: 'Noir Bold' },
  { id: 'vintage', name: 'Vintage' },
  { id: 'sunset', name: 'Sunset Glow' },
  { id: 'cold', name: 'Cyberpunk' },
  { id: 'chrome', name: 'Chrome' },
] as const;

const VALID_FILTER_IDS = new Set<string>(MEDIA_FILTER_PRESETS.map((p) => p.id));

export function normalizeMediaFilterId(value: string | undefined): MediaFilterId {
  if (value && VALID_FILTER_IDS.has(value)) {
    return value as MediaFilterId;
  }
  return 'none';
}

/** CSS filter functions for a preset (no brightness/contrast sliders). */
export function mediaFilterEffectCss(
  filterId: string | undefined,
  options?: { preview?: boolean }
): string {
  const id = normalizeMediaFilterId(filterId);
  const blurAmount = options?.preview ? '2px' : '4px';

  switch (id) {
    case 'grayscale':
      return 'grayscale(100%)';
    case 'sepia':
      return 'sepia(100%)';
    case 'blur':
      return `blur(${blurAmount})`;
    case 'noir':
      return 'grayscale(100%) contrast(140%) brightness(90%)';
    case 'vintage':
      return 'sepia(80%) hue-rotate(-10deg) saturate(120%)';
    case 'sunset':
      return 'saturate(150%) hue-rotate(15deg) sepia(20%)';
    case 'cold':
      return 'hue-rotate(180deg) saturate(110%) contrast(110%)';
    case 'chrome':
      return 'contrast(150%) saturate(140%)';
    case 'none':
    default:
      return 'none';
  }
}

/** Full inline style for images/videos including adjust sliders. */
export function buildMediaFilterStyle(
  filterId: string | undefined,
  options?: { brightness?: number; contrast?: number; preview?: boolean }
): CSSProperties {
  const effect = mediaFilterEffectCss(filterId, { preview: options?.preview });
  const brightness = options?.brightness ?? 100;
  const contrast = options?.contrast ?? 100;
  const parts = [
    effect !== 'none' ? effect : '',
    `brightness(${brightness}%)`,
    `contrast(${contrast}%)`,
  ].filter(Boolean);

  return { filter: parts.join(' ') };
}
