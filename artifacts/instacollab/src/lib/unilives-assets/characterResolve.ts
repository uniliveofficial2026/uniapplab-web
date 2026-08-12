/** Character / mascot resolve helpers — never hardcode paths in feature UI. */

import { resolveConfiguredFallback } from './fallbacks';
import { getRegisteredAsset } from './registry';
import { getAssetUrl, resolveAssetUrlDetailed } from './resolver';
import type { AssetResolveOptions, ResolvedAssetUrl } from './types';

/** Canonical IDs for character preview media (manifest extras; seed may not list them). */
export const CHARACTER_MASCOT_PREVIEW_ID = 'character.mascot.preview.glb' as const;
export const CHARACTER_MASCOT_AUDIO_ID = 'character.mascot.preview.audio' as const;

/**
 * Known-good public paths for the optional character preview host.
 * These are NOT production-approved kingdom assets.
 */
const PREVIEW_GLB = '/unilives-assets/characters/unilives-mascot.glb';
const PREVIEW_AUDIO = '/unilives-assets/characters/audio/mascot-ambient.mp3';
const LEGACY = '/brand/app-logo.png';

export function resolveCharacterPreviewModelUrl(
  options: AssetResolveOptions = {},
): ResolvedAssetUrl {
  const registered = getRegisteredAsset(CHARACTER_MASCOT_PREVIEW_ID);
  if (registered && registered.status !== 'missing') {
    return resolveAssetUrlDetailed(CHARACTER_MASCOT_PREVIEW_ID, options);
  }
  // Physical preview file may exist outside seed — still not production-approved.
  return {
    assetId: CHARACTER_MASCOT_PREVIEW_ID,
    url: PREVIEW_GLB,
    format: 'json',
    usedFallback: false,
    status: 'placeholder',
  };
}

export function resolveCharacterPreviewAudioUrl(): string | undefined {
  return PREVIEW_AUDIO;
}

export function resolveCharacterSafeFallbackUrl(assetId?: string): string {
  if (assetId) {
    const hit = getRegisteredAsset(assetId);
    if (hit) return resolveConfiguredFallback(hit);
    return getAssetUrl(assetId);
  }
  return LEGACY;
}
