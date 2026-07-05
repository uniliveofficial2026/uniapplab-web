/** DeepAR Web SDK — https://developer.deepar.ai */
/** DeepAR Beauty — https://docs.deepar.ai/deepar-beauty */

export const DEEPAR_VERSION = '5.6.22';

export type DeepAREffectCategoryId =
  | 'clear'
  | 'makeup'
  | 'beauty'
  | 'mask'
  | 'glasses'
  | 'background'
  | 'animation';

export type DeepAREffectCategory = {
  id: DeepAREffectCategoryId;
  label: string;
};

export type DeepAREffectPreset = {
  id: string;
  label: string;
  category: DeepAREffectCategoryId;
  /**
   * pack/sdk: filename under public/effects or deepar-resources/effects
   * beauty: zip under public/effects/beauty-presets (Beauty plugin importPreset)
   */
  effectPath: string | null;
  source: 'pack' | 'sdk' | 'beauty';
};

export const DEEPAR_EFFECT_CATEGORIES: DeepAREffectCategory[] = [
  { id: 'clear', label: 'None' },
  { id: 'makeup', label: 'Makeup' },
  { id: 'beauty', label: 'Beauty' },
  { id: 'mask', label: 'Mask' },
  { id: 'glasses', label: 'Glasses' },
  { id: 'background', label: 'BG' },
  { id: 'animation', label: 'Animation' },
];

/** Free pack + SDK effects + Beauty plugin looks/presets (makeup + body shaping). */
export const DEEPAR_EFFECT_PRESETS: DeepAREffectPreset[] = [
  { id: 'none', label: 'None', category: 'clear', effectPath: null, source: 'pack' },

  // Free pack makeup
  { id: 'makeup', label: 'Makeup', category: 'makeup', effectPath: 'MakeupLook.deepar', source: 'pack' },
  { id: 'makeup-split', label: 'Split Makeup', category: 'makeup', effectPath: 'Split_View_Look.deepar', source: 'pack' },

  // Beauty plugin — full looks (makeup + face morphing / body shaping)
  { id: 'look-cute', label: 'Cute', category: 'makeup', effectPath: 'cute.zip', source: 'beauty' },
  { id: 'look-after-dark', label: 'After Dark', category: 'makeup', effectPath: 'after-dark.zip', source: 'beauty' },
  { id: 'look-night-out', label: 'Night Out', category: 'makeup', effectPath: 'night-out.zip', source: 'beauty' },
  { id: 'look-kim-classic', label: 'Kim Classic', category: 'makeup', effectPath: 'kim-classic.zip', source: 'beauty' },
  { id: 'look-caramel-kiss', label: 'Caramel Kiss', category: 'makeup', effectPath: 'caramel-kiss.zip', source: 'beauty' },
  { id: 'look-spring-petals', label: 'Spring Petals', category: 'makeup', effectPath: 'spring-petals.zip', source: 'beauty' },
  { id: 'look-midnight-stunner', label: 'Midnight', category: 'makeup', effectPath: 'midnight-stunner.zip', source: 'beauty' },
  { id: 'look-happy-tears', label: 'Happy Tears', category: 'makeup', effectPath: 'happy-tears.zip', source: 'beauty' },
  { id: 'look-starry-night', label: 'Starry Night', category: 'makeup', effectPath: 'starry-night-seduction.zip', source: 'beauty' },
  { id: 'look-lash-delight', label: 'Lash Delight', category: 'makeup', effectPath: 'lash-delight.zip', source: 'beauty' },
  { id: 'look-black-hearts', label: 'Black Hearts', category: 'makeup', effectPath: 'black-hearts.zip', source: 'beauty' },
  { id: 'look-cateye-maple', label: 'Cateye Maple', category: 'makeup', effectPath: 'cateye-maple.zip', source: 'beauty' },
  { id: 'look-gelid-breeze', label: 'Gelid Breeze', category: 'makeup', effectPath: 'gelid-breeze.zip', source: 'beauty' },
  { id: 'look-twilight-hues', label: 'Twilight', category: 'makeup', effectPath: 'twilight-hues.zip', source: 'beauty' },
  { id: 'look-misty-enchantment', label: 'Misty', category: 'makeup', effectPath: 'misty-enchantment.zip', source: 'beauty' },
  { id: 'look-skyline-glamour', label: 'Skyline', category: 'makeup', effectPath: 'skyline-glamour-stripes.zip', source: 'beauty' },

  // Beauty plugin — skin + body shaping (face morphing)
  { id: 'beauty-light-touchup', label: 'Light Touchup', category: 'beauty', effectPath: 'light-touchup-fair-skin.zip', source: 'beauty' },
  { id: 'beauty-rosy', label: 'Rosy', category: 'beauty', effectPath: 'rosy.zip', source: 'beauty' },
  { id: 'beauty-glowing', label: 'Glowing', category: 'beauty', effectPath: 'glowing.zip', source: 'beauty' },
  { id: 'beauty-light-blush', label: 'Light Blush', category: 'beauty', effectPath: 'light-blush.zip', source: 'beauty' },
  { id: 'beauty-gelid', label: 'Gelid', category: 'beauty', effectPath: 'gelid.zip', source: 'beauty' },

  // Free pack masks / glasses / bg / animation
  { id: 'viking', label: 'Viking', category: 'mask', effectPath: 'viking_helmet.deepar', source: 'pack' },
  { id: 'flowers', label: 'Flowers', category: 'mask', effectPath: 'flower_face.deepar', source: 'pack' },
  { id: 'humanoid', label: 'Humanoid', category: 'mask', effectPath: 'Humanoid.deepar', source: 'pack' },
  { id: 'devil-horns', label: 'Devil Horns', category: 'mask', effectPath: 'Neon_Devil_Horns.deepar', source: 'pack' },
  { id: 'stallone', label: 'Stallone', category: 'mask', effectPath: 'Stallone.deepar', source: 'pack' },
  { id: 'vendetta', label: 'Vendetta', category: 'mask', effectPath: 'Vendetta_Mask.deepar', source: 'pack' },
  { id: 'snail', label: 'Snail', category: 'mask', effectPath: 'Snail.deepar', source: 'pack' },
  { id: 'elephant', label: 'Elephant', category: 'mask', effectPath: 'Elephant_Trunk.deepar', source: 'pack' },
  { id: 'lion', label: 'Lion', category: 'mask', effectPath: 'lion', source: 'sdk' },
  { id: 'dalmatian', label: 'Dalmatian', category: 'mask', effectPath: 'dalmatian', source: 'sdk' },
  { id: 'koala', label: 'Koala', category: 'mask', effectPath: 'koala', source: 'sdk' },
  { id: 'wayfarer', label: 'Wayfarer', category: 'glasses', effectPath: 'ray-ban-wayfarer.deepar', source: 'pack' },
  { id: 'aviators', label: 'Aviators', category: 'glasses', effectPath: 'aviators', source: 'sdk' },
  { id: 'galaxy', label: 'Galaxy', category: 'background', effectPath: 'galaxy_background.deepar', source: 'pack' },
  { id: 'burning', label: 'Burning', category: 'background', effectPath: 'burning_effect.deepar', source: 'pack' },
  { id: 'background_blur', label: 'BG Blur', category: 'background', effectPath: 'background_blur.deepar', source: 'sdk' },
  { id: 'background_replacement', label: 'BG Replace', category: 'background', effectPath: 'background_replacement.deepar', source: 'sdk' },
  { id: 'fire', label: 'Fire', category: 'animation', effectPath: 'Fire_Effect.deepar', source: 'pack' },
  { id: 'hope', label: 'Hope', category: 'animation', effectPath: 'Hope.deepar', source: 'pack' },
  { id: 'emotions', label: 'Emotions', category: 'animation', effectPath: 'Emotions_Exaggerator.deepar', source: 'pack' },
  { id: 'emotion-meter', label: 'Emotion Meter', category: 'animation', effectPath: 'Emotion_Meter.deepar', source: 'pack' },
  { id: 'ping-pong', label: 'Ping Pong', category: 'animation', effectPath: 'Ping_Pong.deepar', source: 'pack' },
  { id: 'pixel-hearts', label: 'Hearts', category: 'animation', effectPath: '8bitHearts.deepar', source: 'pack' },
];

export function getEffectPresetsByCategory(): Array<{
  category: DeepAREffectCategory;
  presets: DeepAREffectPreset[];
}> {
  return DEEPAR_EFFECT_CATEGORIES.map((category) => ({
    category,
    presets: DEEPAR_EFFECT_PRESETS.filter((preset) => preset.category === category.id),
  })).filter((group) => group.presets.length > 0);
}

const EFFECT_CATEGORY_SEARCH_TERMS: Record<DeepAREffectCategoryId, string> = {
  clear: 'none clear off',
  makeup: 'makeup lipstick eyeshadow look',
  beauty: 'beauty smooth soft glow skin filter morph shape body',
  mask: 'mask face filter costume animal',
  glasses: 'glasses sunglasses eyewear wayfarer aviators',
  background: 'bg background blur replace galaxy burning',
  animation: 'animation fx effect fire emotion hearts ping pong',
};

function effectSearchHaystack(preset: DeepAREffectPreset): string {
  const category = DEEPAR_EFFECT_CATEGORIES.find((item) => item.id === preset.category);
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

export function searchEffectPresets(query: string): DeepAREffectPreset[] {
  const tokens = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0) return DEEPAR_EFFECT_PRESETS;

  return DEEPAR_EFFECT_PRESETS.filter((preset) => {
    const haystack = effectSearchHaystack(preset);
    return tokens.every((token) => haystack.includes(token));
  });
}

export function getEffectPresetsByCategoryFiltered(query: string): Array<{
  category: DeepAREffectCategory;
  presets: DeepAREffectPreset[];
}> {
  const tokens = query.trim();
  if (!tokens) return getEffectPresetsByCategory();

  const matchingIds = new Set(searchEffectPresets(query).map((preset) => preset.id));
  return DEEPAR_EFFECT_CATEGORIES.map((category) => ({
    category,
    presets: DEEPAR_EFFECT_PRESETS.filter(
      (preset) => preset.category === category.id && matchingIds.has(preset.id),
    ),
  })).filter((group) => group.presets.length > 0);
}

export function getEffectCategoryId(effectId: string): DeepAREffectCategoryId {
  return DEEPAR_EFFECT_PRESETS.find((preset) => preset.id === effectId)?.category ?? 'clear';
}

export function getEffectPresetsForCategory(categoryId: DeepAREffectCategoryId): DeepAREffectPreset[] {
  return DEEPAR_EFFECT_PRESETS.filter((preset) => preset.category === categoryId);
}

export function getEffectPreset(effectId: string): DeepAREffectPreset | undefined {
  return DEEPAR_EFFECT_PRESETS.find((preset) => preset.id === effectId);
}

export function isDeepARBeautyPreset(effectId: string): boolean {
  return getEffectPreset(effectId)?.source === 'beauty';
}

function normalizedBaseUrl(): string {
  const base = import.meta.env.BASE_URL || '/';
  return base.endsWith('/') ? base : `${base}/`;
}

/** Local SDK root from DeepAR-Web-v5.6.22.zip → public/deepar-resources/ */
export function getDeepARRootPath(): string {
  return `${normalizedBaseUrl()}deepar-resources/`;
}

/** DeepAR Beauty plugin assets (copied from @deepar/beauty/dist). */
export function getDeepARBeautyRootPath(): string {
  return `${normalizedBaseUrl()}deepar-beauty/`;
}

export function getDeepARLicenseKey(): string {
  return (import.meta.env.VITE_DEEPAR_LICENSE_KEY as string | undefined)?.trim() ?? '';
}

export function isDeepARConfigured(): boolean {
  const key = getDeepARLicenseKey();
  return Boolean(key && !/your|xxxx|placeholder/i.test(key));
}

/** URL for free-pack / SDK .deepar effects. */
export function getDeepAREffectUrl(effectId: string): string | null {
  const preset = getEffectPreset(effectId);
  if (!preset?.effectPath || preset.source === 'beauty') return null;

  if (preset.source === 'pack') {
    return `${normalizedBaseUrl()}effects/${preset.effectPath}`;
  }

  return `${getDeepARRootPath()}effects/${preset.effectPath}`;
}

/** URL for Beauty plugin look/preset zip (importPreset). */
export function getDeepARBeautyPresetUrl(effectId: string): string | null {
  const preset = getEffectPreset(effectId);
  if (!preset?.effectPath || preset.source !== 'beauty') return null;
  return `${normalizedBaseUrl()}effects/beauty-presets/${preset.effectPath}`;
}

/** Bump when carousel preview PNGs change so clients don't keep stale thumbs. */
const PREVIEW_ASSET_VERSION = '11';

/** Fallback thumbs when a look-specific preview is missing. */
const PREVIEW_FALLBACKS: Record<string, string[]> = {
  'look-cute': ['makeup', 'beauty-soft'],
  'look-after-dark': ['makeup', 'beauty-glow'],
  'look-night-out': ['makeup-split', 'beauty-glow'],
  'look-kim-classic': ['makeup', 'beauty-smooth'],
  'look-caramel-kiss': ['makeup', 'beauty-soft'],
  'look-spring-petals': ['flowers', 'beauty-soft'],
  'look-midnight-stunner': ['makeup-split', 'beauty-glow'],
  'look-happy-tears': ['emotions', 'beauty-soft'],
  'look-starry-night': ['galaxy', 'beauty-glow'],
  'look-lash-delight': ['makeup', 'beauty-smooth'],
  'look-black-hearts': ['pixel-hearts', 'makeup'],
  'look-cateye-maple': ['makeup-split', 'beauty-smooth'],
  'look-gelid-breeze': ['beauty-soft', 'makeup'],
  'look-twilight-hues': ['beauty-glow', 'makeup'],
  'look-misty-enchantment': ['beauty-soft', 'makeup'],
  'look-skyline-glamour': ['makeup-split', 'beauty-glow'],
  'beauty-light-touchup': ['beauty-soft', 'none'],
  'beauty-rosy': ['beauty-smooth', 'none'],
  'beauty-glowing': ['beauty-glow', 'none'],
  'beauty-light-blush': ['beauty-soft', 'none'],
  'beauty-gelid': ['beauty-smooth', 'none'],
  'shape-natural': ['beauty-natural', 'none'],
  'shape-slim-face': ['beauty-smooth', 'makeup'],
  'shape-full-face': ['beauty-soft', 'none'],
  'shape-vline': ['beauty-clear', 'beauty-smooth'],
  'shape-big-eyes': ['beauty-glow', 'makeup'],
  'shape-model-waist': ['beauty-smooth', 'beauty-clear'],
  'shape-curvy': ['beauty-soft', 'beauty-glow'],
  'shape-long-legs': ['beauty-natural', 'beauty-clear'],
  'shape-athletic': ['beauty-clear', 'beauty-natural'],
  'shape-glam': ['beauty-glow', 'makeup-split'],
};

function previewUrlForId(id: string): string {
  return `${normalizedBaseUrl()}effects/previews/${id}.png?v=${PREVIEW_ASSET_VERSION}`;
}

/** Primary demo thumbnail for carousel buttons. */
export function getDeepAREffectPreviewUrl(effectId: string): string {
  return previewUrlForId(effectId);
}

/** Ordered preview URLs (primary + fallbacks) for resilient pre-look buttons. */
export function getDeepAREffectPreviewCandidates(effectId: string): string[] {
  const ids = [effectId, ...(PREVIEW_FALLBACKS[effectId] ?? []), 'none'];
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    urls.push(previewUrlForId(id));
  }
  return urls;
}

export const DEEPAR_DEFAULT_EFFECT_ID = 'makeup';
