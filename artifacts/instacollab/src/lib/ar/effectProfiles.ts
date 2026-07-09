export type EffectRenderKind =
  | 'makeup'
  | 'makeup-split'
  | 'glasses'
  | 'helmet'
  | 'horns'
  | 'face-tint'
  | 'face-mask'
  | 'animal'
  | 'trunk'
  | 'flowers'
  | 'segment-bg'
  | 'particles'
  | 'emotion';

export type EffectProfile = {
  id: string;
  kind: EffectRenderKind;
  /** Uses pose landmarks when available (snail shell, upper-body). */
  usesPose?: boolean;
};

const DEFAULT: EffectProfile = { id: 'unknown', kind: 'face-tint' };

export const EFFECT_PROFILES: Record<string, EffectProfile> = {
  none: { id: 'none', kind: 'makeup' },
  makeup: { id: 'makeup', kind: 'makeup' },
  'makeup-split': { id: 'makeup-split', kind: 'makeup-split' },
  viking: { id: 'viking', kind: 'helmet' },
  flowers: { id: 'flowers', kind: 'flowers' },
  humanoid: { id: 'humanoid', kind: 'face-mask' },
  'devil-horns': { id: 'devil-horns', kind: 'horns' },
  stallone: { id: 'stallone', kind: 'face-tint' },
  vendetta: { id: 'vendetta', kind: 'face-mask' },
  snail: { id: 'snail', kind: 'animal', usesPose: true },
  elephant: { id: 'elephant', kind: 'trunk' },
  lion: { id: 'lion', kind: 'animal' },
  dalmatian: { id: 'dalmatian', kind: 'animal' },
  koala: { id: 'koala', kind: 'animal' },
  wayfarer: { id: 'wayfarer', kind: 'glasses' },
  aviators: { id: 'aviators', kind: 'glasses' },
  galaxy: { id: 'galaxy', kind: 'segment-bg' },
  burning: { id: 'burning', kind: 'segment-bg' },
  background_blur: { id: 'background_blur', kind: 'segment-bg' },
  background_replacement: { id: 'background_replacement', kind: 'segment-bg' },
  fire: { id: 'fire', kind: 'particles' },
  hope: { id: 'hope', kind: 'emotion' },
  emotions: { id: 'emotions', kind: 'emotion' },
  'emotion-meter': { id: 'emotion-meter', kind: 'emotion' },
  'ping-pong': { id: 'ping-pong', kind: 'particles' },
  'pixel-hearts': { id: 'pixel-hearts', kind: 'particles' },
};

export function getEffectProfile(effectId: string): EffectProfile {
  return EFFECT_PROFILES[effectId] ?? DEFAULT;
}
