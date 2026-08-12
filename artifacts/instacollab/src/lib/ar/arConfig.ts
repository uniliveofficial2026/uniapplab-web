/** Open-source face AR — MediaPipe-powered, no license key required. */

export type AREffectCategoryId =
  | 'clear'
  | 'makeup'
  | 'mask'
  | 'glasses'
  | 'background'
  | 'animation';

export type AREffectCategory = {
  id: AREffectCategoryId;
  label: string;
};

export type AREffectPreset = {
  id: string;
  label: string;
  category: AREffectCategoryId;
};

export const AR_EFFECT_CATEGORIES: AREffectCategory[] = [
  { id: 'clear', label: 'None' },
  { id: 'makeup', label: 'Makeup' },
  { id: 'mask', label: 'Mask' },
  { id: 'glasses', label: 'Glasses' },
  { id: 'background', label: 'BG' },
  { id: 'animation', label: 'Animation' },
];

export const AR_EFFECT_PRESETS: AREffectPreset[] = [
  { id: 'none', label: 'None', category: 'clear' },
  { id: 'makeup', label: 'Makeup', category: 'makeup' },
  { id: 'makeup-split', label: 'Split Makeup', category: 'makeup' },
  { id: 'viking', label: 'Viking', category: 'mask' },
  { id: 'flowers', label: 'Flowers', category: 'mask' },
  { id: 'humanoid', label: 'Humanoid', category: 'mask' },
  { id: 'devil-horns', label: 'Devil Horns', category: 'mask' },
  { id: 'stallone', label: 'Stallone', category: 'mask' },
  { id: 'vendetta', label: 'Vendetta', category: 'mask' },
  { id: 'snail', label: 'Snail', category: 'mask' },
  { id: 'elephant', label: 'Elephant', category: 'mask' },
  { id: 'lion', label: 'Lion', category: 'mask' },
  { id: 'dalmatian', label: 'Dalmatian', category: 'mask' },
  { id: 'koala', label: 'Koala', category: 'mask' },
  { id: 'wayfarer', label: 'Wayfarer', category: 'glasses' },
  { id: 'aviators', label: 'Aviators', category: 'glasses' },
  { id: 'galaxy', label: 'Galaxy', category: 'background' },
  { id: 'burning', label: 'Burning', category: 'background' },
  { id: 'background_blur', label: 'BG Blur', category: 'background' },
  { id: 'background_replacement', label: 'BG Replace', category: 'background' },
  { id: 'fire', label: 'Fire', category: 'animation' },
  { id: 'hope', label: 'Hope', category: 'animation' },
  { id: 'emotions', label: 'Emotions', category: 'animation' },
  { id: 'emotion-meter', label: 'Emotion Meter', category: 'animation' },
  { id: 'ping-pong', label: 'Ping Pong', category: 'animation' },
  { id: 'pixel-hearts', label: 'Hearts', category: 'animation' },
];

const EFFECT_CATEGORY_SEARCH_TERMS: Record<AREffectCategoryId, string> = {
  clear: 'none clear off',
  makeup: 'makeup beauty look',
  mask: 'mask face filter costume animal',
  glasses: 'glasses sunglasses eyewear wayfarer aviators',
  background: 'bg background blur replace galaxy burning',
  animation: 'animation fx effect fire emotion hearts ping pong',
};

function normalizedBaseUrl(): string {
  const base = import.meta.env.BASE_URL || '/';
  return base.endsWith('/') ? base : `${base}/`;
}

export function isFaceARAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  if (!navigator.mediaDevices?.getUserMedia) return false;
  if (window.isSecureContext === false) return false;
  return true;
}

export function getAREffectPreviewUrl(effectId: string): string {
  return `${normalizedBaseUrl()}effects/previews/${effectId}.png`;
}

export function getAREffectOverlayUrl(effectId: string): string {
  return getAREffectPreviewUrl(effectId);
}

export function getEffectPresetsByCategory(): Array<{
  category: AREffectCategory;
  presets: AREffectPreset[];
}> {
  return AR_EFFECT_CATEGORIES.map((category) => ({
    category,
    presets: AR_EFFECT_PRESETS.filter((preset) => preset.category === category.id),
  })).filter((group) => group.presets.length > 0);
}

function effectSearchHaystack(preset: AREffectPreset): string {
  const category = AR_EFFECT_CATEGORIES.find((item) => item.id === preset.category);
  return [
    preset.label,
    preset.id,
    preset.id.replace(/-/g, ' '),
    category?.label ?? '',
    preset.category,
    EFFECT_CATEGORY_SEARCH_TERMS[preset.category],
  ]
    .join(' ')
    .toLowerCase();
}

export function searchEffectPresets(query: string): AREffectPreset[] {
  const tokens = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0) return AR_EFFECT_PRESETS;

  return AR_EFFECT_PRESETS.filter((preset) => {
    const haystack = effectSearchHaystack(preset);
    return tokens.every((token) => haystack.includes(token));
  });
}

export function getEffectCategoryId(effectId: string): AREffectCategoryId {
  return AR_EFFECT_PRESETS.find((preset) => preset.id === effectId)?.category ?? 'clear';
}

export function getEffectPresetsForCategory(categoryId: AREffectCategoryId): AREffectPreset[] {
  return AR_EFFECT_PRESETS.filter((preset) => preset.category === categoryId);
}

export function getPresetById(effectId: string): AREffectPreset | undefined {
  return AR_EFFECT_PRESETS.find((preset) => preset.id === effectId);
}

export const AR_DEFAULT_EFFECT_ID = 'none';
