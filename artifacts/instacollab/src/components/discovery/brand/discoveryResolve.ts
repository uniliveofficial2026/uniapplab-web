/** Discovery visual resolution — no queries, follow, or room-entry logic. */

import { resolveBrandRegistryUrl } from '../../../lib/unilives-assets/brandResolve';
import { resolveAsset } from '../../../lib/unilives-assets/resolver';
import type { AssetResolveOptions } from '../../../lib/unilives-assets/types';

export type DiscoverySurface =
  | 'trending'
  | 'search'
  | 'explore'
  | 'live'
  | 'party';

export function resolveDiscoveryAssetUrl(
  assetId: string,
  options?: AssetResolveOptions,
): string {
  const asset = resolveAsset(assetId);
  if (asset.status === 'missing' || asset.status === 'deprecated') {
    return resolveBrandRegistryUrl('brand.logo.icon', options);
  }
  return resolveBrandRegistryUrl(assetId, options);
}

export function hasProductionDiscoveryAsset(assetId: string): boolean {
  const asset = resolveAsset(assetId);
  return asset.status === 'production' || asset.status === 'placeholder';
}
