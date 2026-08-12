/**
 * UniLive’s onboarding visual resolution (Phase 2).
 * Missing production files → known-good brand fallback; Lucide icons remain the
 * working slide illustrations until approved artwork lands.
 */

import { resolveBrandRegistryUrl } from '../../../lib/unilives-assets/brandResolve';
import { resolveAsset } from '../../../lib/unilives-assets/resolver';
import type { AssetResolveOptions } from '../../../lib/unilives-assets/types';

export type OnboardingStepKey = 'welcome' | 'connect' | 'create' | 'discover' | 'permissions';

/** Maps the 3-slide OnboardingScreen order to canonical step keys. */
export const ONBOARDING_SLIDE_STEPS: readonly OnboardingStepKey[] = [
  'welcome',
  'connect',
  'create',
] as const;

export function onboardingIllustrationId(step: OnboardingStepKey): string {
  return `onboarding.${step}.illustration`;
}

export function onboardingBackgroundId(step: OnboardingStepKey): string {
  return `onboarding.${step}.background`;
}

/**
 * Resolve an onboarding registry asset URL.
 * Always falls back to known-good brand mark when production files are missing.
 */
export function resolveOnboardingAssetUrl(
  assetId: string,
  options?: AssetResolveOptions,
): string {
  const asset = resolveAsset(assetId);
  if (asset.status === 'missing' || asset.status === 'deprecated') {
    return resolveBrandRegistryUrl('brand.logo.icon', options);
  }
  return resolveBrandRegistryUrl(assetId, options);
}

/** True when production illustration exists (otherwise keep Lucide). */
export function hasProductionOnboardingIllustration(step: OnboardingStepKey): boolean {
  const asset = resolveAsset(onboardingIllustrationId(step));
  return asset.status === 'production' || asset.status === 'placeholder';
}

export function hasProductionOnboardingBackground(step: OnboardingStepKey): boolean {
  const asset = resolveAsset(onboardingBackgroundId(step));
  return asset.status === 'production' || asset.status === 'placeholder';
}
