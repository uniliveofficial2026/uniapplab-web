import type { AssetCategory, UniLivesAsset } from './types';

/**
 * Category-level fallback URL paths.
 * Prefer known-good legacy public media so missing UniLive’s production
 * binaries never resolve to blank / 404 placeholders.
 */
export const CATEGORY_FALLBACK_PATHS: Record<AssetCategory, string> = {
  brand: '/brand/app-logo.png',
  onboarding: '/brand/app-logo.png',
  auth: '/brand/app-logo.png',
  'profile-setup': '/brand/app-logo.png',
  discovery: '/brand/app-logo.png',
  gift: '/brand/app-logo.png',
  sticker: '/brand/app-logo.png',
  'seat-interaction': '/brand/app-logo.png',
  badge: '/brand/app-logo.png',
  'avatar-ring': '/brand/app-logo.png',
  frame: '/brand/app-logo.png',
  'live-room': '/brand/app-logo.png',
  wallet: '/brand/app-logo.png',
  sharing: '/brand/app-logo.png',
  legal: '/brand/app-logo.png',
  ui: '/brand/app-logo.png',
};

/**
 * Legacy public paths that remain available until replacements are validated.
 * These are NOT invented production UniLive’s assets — inventory only.
 */
export const LEGACY_PUBLIC_ASSETS: readonly {
  path: string;
  kind: string;
  relatedBusinessIds?: string[];
}[] = [
  { path: '/brand/app-logo.png', kind: 'brand-logo' },
  { path: '/pwa-icon.png', kind: 'pwa-icon' },
  { path: '/pwa-icon.svg', kind: 'pwa-icon' },
  { path: '/icons/icon-192.png', kind: 'app-icon' },
  { path: '/icons/icon-192-maskable.png', kind: 'app-icon' },
  { path: '/icons/icon-512.png', kind: 'app-icon' },
  { path: '/icons/icon-512-maskable.png', kind: 'app-icon' },
  { path: '/live-gifts/mic.svga', kind: 'gift-svga', relatedBusinessIds: ['mic'] },
  { path: '/live-gifts/star.svga', kind: 'gift-svga', relatedBusinessIds: ['star'] },
  { path: '/live-gifts/crown.svga', kind: 'gift-svga', relatedBusinessIds: ['crown', 'diamond', 'unicorn', 'universe', 'divine'] },
  { path: '/live-gifts/rocket.svga', kind: 'gift-svga', relatedBusinessIds: ['rocket', 'castle', 'phoenix', 'dragon'] },
  { path: '/live-gifts/manifest.json', kind: 'legacy-manifest' },
] as const;

export function categoryFallbackPath(category: AssetCategory): string {
  return CATEGORY_FALLBACK_PATHS[category];
}

export function resolveConfiguredFallback(asset: UniLivesAsset): string {
  if (asset.fallback) return asset.fallback;
  if (asset.lowPerformanceFallback) return asset.lowPerformanceFallback;
  if (asset.reducedMotionFallback) return asset.reducedMotionFallback;
  if (asset.thumbnail) return asset.thumbnail;
  return categoryFallbackPath(asset.category);
}
