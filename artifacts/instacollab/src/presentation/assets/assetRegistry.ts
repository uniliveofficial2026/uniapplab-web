/**
 * Presentation asset lookup. Wraps UniLive’s production asset registry.
 * Components ask for stable IDs — never fragile filenames.
 */
import {
  getAssetUrl,
  getRegisteredAsset,
  resolveAsset,
  UNILIVES_BRAND_NAME,
} from '../../lib/unilives-assets';
import { resolveLocalizedAsset } from '../../lib/i18n/embeddedAssets';
import type { AppLocale } from '../../lib/i18n/locales';

export type AssetResolveInput = {
  assetId: string;
  locale?: AppLocale;
  themeKey?: string;
  seasonKey?: string;
  platform?: 'web' | 'ios' | 'android';
  density?: '1x' | '2x' | '3x';
};

export type ResolvedPresentationAsset = {
  assetId: string;
  brand: typeof UNILIVES_BRAND_NAME;
  url: string;
  fallbackUrl: string;
  checksum?: string;
  version: number;
};

export function resolvePresentationAsset(input: AssetResolveInput): ResolvedPresentationAsset {
  const localized = input.locale ? resolveLocalizedAsset(input.assetId, input.locale) : null;
  const registered = getRegisteredAsset(input.assetId) ?? resolveAsset(input.assetId);
  const url = localized || getAssetUrl(input.assetId) || registered?.fallback || '/brand/app-logo.png';
  return {
    assetId: input.assetId,
    brand: UNILIVES_BRAND_NAME,
    url,
    fallbackUrl: registered?.fallback || '/brand/app-logo.png',
    version: registered?.version ?? 1,
  };
}

export function isStableAssetId(assetId: string): boolean {
  return /^[a-z0-9]+(\.[a-z0-9_-]+)+$/i.test(assetId);
}
