import type { AppLocale } from './locales';
import { SOURCE_LOCALE } from './locales';

export type EmbeddedAssetManifestEntry = {
  asset_id: string;
  asset_type: 'png' | 'jpeg' | 'webp' | 'gif' | 'svga' | 'video' | 'audio' | 'animation';
  default_path: string;
  locale_variants: Partial<Record<AppLocale, string>>;
  embedded_text: boolean;
  brand_locked: boolean;
  approval_status: 'approved' | 'pending' | 'none';
  fallback_path: string;
};

export const EMBEDDED_ASSET_MANIFEST: EmbeddedAssetManifestEntry[] = [
  {
    asset_id: 'splash.boot',
    asset_type: 'video',
    default_path: '/unilives-assets/brand/loading/princess-boot-splash-locked.mp4',
    locale_variants: {},
    embedded_text: false,
    brand_locked: true,
    approval_status: 'approved',
    fallback_path: '/unilives-assets/brand/loading/princess-boot-splash-locked.jpg',
  },
  {
    asset_id: 'onboarding.welcome',
    asset_type: 'png',
    default_path: '/unilives-assets/onboarding/welcome/princess-onboarding-welcome-locked.png',
    locale_variants: {},
    embedded_text: false,
    brand_locked: true,
    approval_status: 'approved',
    fallback_path: '/unilives-assets/onboarding/welcome/princess-onboarding-welcome-locked.png',
  },
];

export function resolveLocalizedAsset(assetId: string, locale: AppLocale): string | null {
  const entry = EMBEDDED_ASSET_MANIFEST.find((a) => a.asset_id === assetId);
  if (!entry) return null;
  if (entry.brand_locked) return entry.default_path;
  return entry.locale_variants[locale] || entry.locale_variants[SOURCE_LOCALE] || entry.fallback_path || entry.default_path;
}

export function localeHasRequiredAssets(_locale: AppLocale): boolean {
  // Brand-locked splash/onboarding contain no translatable words.
  // Gift/badge/ring/frame designs are visual-only unless a locale variant is approved.
  return EMBEDDED_ASSET_MANIFEST.every((entry) => {
    if (!entry.embedded_text) return true;
    if (entry.brand_locked) return true;
    return Boolean(entry.locale_variants[_locale] || entry.approval_status === 'approved');
  });
}
