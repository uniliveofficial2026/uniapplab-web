/** DeepAR Web SDK — https://developer.deepar.ai */

export const DEEPAR_VERSION = '5.6.22';

export type DeepAREffectPreset = {
  id: string;
  label: string;
  /** Filename under public/effects or folder under deepar-resources/effects */
  effectPath: string | null;
  source: 'pack' | 'sdk';
};

/** Filters from free_package.zip + SDK built-ins (aviators, lion, bg blur). */
export const DEEPAR_EFFECT_PRESETS: DeepAREffectPreset[] = [
  { id: 'none', label: 'None', effectPath: null, source: 'pack' },
  { id: 'makeup', label: 'Makeup', effectPath: 'MakeupLook.deepar', source: 'pack' },
  { id: 'viking', label: 'Viking', effectPath: 'viking_helmet.deepar', source: 'pack' },
  { id: 'flowers', label: 'Flowers', effectPath: 'flower_face.deepar', source: 'pack' },
  { id: 'galaxy', label: 'Galaxy', effectPath: 'galaxy_background.deepar', source: 'pack' },
  { id: 'humanoid', label: 'Humanoid', effectPath: 'Humanoid.deepar', source: 'pack' },
  { id: 'devil-horns', label: 'Devil Horns', effectPath: 'Neon_Devil_Horns.deepar', source: 'pack' },
  { id: 'fire', label: 'Fire', effectPath: 'Fire_Effect.deepar', source: 'pack' },
  { id: 'burning', label: 'Burning', effectPath: 'burning_effect.deepar', source: 'pack' },
  { id: 'stallone', label: 'Stallone', effectPath: 'Stallone.deepar', source: 'pack' },
  { id: 'hope', label: 'Hope', effectPath: 'Hope.deepar', source: 'pack' },
  { id: 'snail', label: 'Snail', effectPath: 'Snail.deepar', source: 'pack' },
  { id: 'vendetta', label: 'Vendetta', effectPath: 'Vendetta_Mask.deepar', source: 'pack' },
  { id: 'makeup-split', label: 'Split Makeup', effectPath: 'Split_View_Look.deepar', source: 'pack' },
  { id: 'ping-pong', label: 'Ping Pong', effectPath: 'Ping_Pong.deepar', source: 'pack' },
  { id: 'pixel-hearts', label: 'Hearts', effectPath: '8bitHearts.deepar', source: 'pack' },
  { id: 'elephant', label: 'Elephant', effectPath: 'Elephant_Trunk.deepar', source: 'pack' },
  { id: 'emotions', label: 'Emotions', effectPath: 'Emotions_Exaggerator.deepar', source: 'pack' },
  { id: 'emotion-meter', label: 'Emotion Meter', effectPath: 'Emotion_Meter.deepar', source: 'pack' },
  { id: 'aviators', label: 'Aviators', effectPath: 'aviators', source: 'sdk' },
  { id: 'lion', label: 'Lion', effectPath: 'lion', source: 'sdk' },
  { id: 'dalmatian', label: 'Dalmatian', effectPath: 'dalmatian', source: 'sdk' },
  { id: 'koala', label: 'Koala', effectPath: 'koala', source: 'sdk' },
  { id: 'background_blur', label: 'BG Blur', effectPath: 'background_blur.deepar', source: 'sdk' },
  { id: 'background_replacement', label: 'BG Replace', effectPath: 'background_replacement.deepar', source: 'sdk' },
];

function normalizedBaseUrl(): string {
  const base = import.meta.env.BASE_URL || '/';
  return base.endsWith('/') ? base : `${base}/`;
}

/** Local SDK root from DeepAR-Web-v5.6.22.zip → public/deepar-resources/ */
export function getDeepARRootPath(): string {
  return `${normalizedBaseUrl()}deepar-resources/`;
}

export function getDeepARLicenseKey(): string {
  return (import.meta.env.VITE_DEEPAR_LICENSE_KEY as string | undefined)?.trim() ?? '';
}

export function isDeepARConfigured(): boolean {
  const key = getDeepARLicenseKey();
  return Boolean(key && !/your|xxxx|placeholder/i.test(key));
}

export function getDeepAREffectUrl(effectId: string): string | null {
  const preset = DEEPAR_EFFECT_PRESETS.find((p) => p.id === effectId);
  if (!preset?.effectPath) return null;

  if (preset.source === 'pack') {
    return `${normalizedBaseUrl()}effects/${preset.effectPath}`;
  }

  return `${getDeepARRootPath()}effects/${preset.effectPath}`;
}

export const DEEPAR_DEFAULT_EFFECT_ID = 'makeup';
