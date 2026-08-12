/** Profile-setup visual resolution — no profile/upload logic. */

import { resolveBrandRegistryUrl } from '../../../lib/unilives-assets/brandResolve';
import { resolveAsset } from '../../../lib/unilives-assets/resolver';
import type { AssetResolveOptions } from '../../../lib/unilives-assets/types';

/**
 * Conceptual visual sections for registry assets.
 * Existing launch UI is a **single screen** — these keys map to visual zones,
 * not separate routes/steps. Interests/creator are registered but not-in-phase
 * because the current flow has no such UI.
 */
export type ProfileSetupVisualSection =
  | 'welcome'
  | 'avatar'
  | 'identity'
  | 'bio'
  | 'interests'
  | 'creator'
  | 'completion';

export function resolveProfileSetupAssetUrl(
  assetId: string,
  options?: AssetResolveOptions,
): string {
  const asset = resolveAsset(assetId);
  if (asset.status === 'missing' || asset.status === 'deprecated') {
    return resolveBrandRegistryUrl('brand.logo.icon', options);
  }
  return resolveBrandRegistryUrl(assetId, options);
}

export function hasProductionProfileSetupAsset(assetId: string): boolean {
  const asset = resolveAsset(assetId);
  return asset.status === 'production' || asset.status === 'placeholder';
}

/** Tokenized input class — preserves form semantics; visual only. */
export const unilivesProfileSetupInputClass =
  'w-full rounded-xl border border-[color:var(--color-unilives-profile-setup-border)] bg-[color:var(--color-unilives-profile-setup-surface)] px-4 py-3 text-[15px] font-medium text-[color:var(--color-unilives-profile-setup-text)] outline-none focus:ring-2 focus:ring-[color:var(--color-unilives-profile-setup-focus)]/40';
