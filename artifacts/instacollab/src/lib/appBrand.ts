/** Canonical product naming — import instead of hard-coding display strings. */
import { resolveBrandContextUrl, resolveBrandVariantUrl } from './unilives-assets';

/** Official product name — always exactly UniLive’s (U+2019 apostrophe). */
export const APP_DISPLAY_NAME = 'UniLive\u2019s';
export const WORKSPACE_DISPLAY_NAME = 'UniLive\u2019s Workspace';
export const APP_SHORT_NAME = 'UniLive\u2019s';
export const APP_TAGLINE =
  'UniLive\u2019s is a live social app for going live, chatting, sharing posts, and collaborating with creators in real time.';
export const APP_SHARE_HOST = 'unilive.app';
/** Legacy share links still resolve for older messages. */
export const LEGACY_SHARE_HOST = 'instacollab.app';
/** Hosts accepted when parsing in-app share URLs (production + brand aliases). */
export const APP_SHARE_HOSTS = [
  APP_SHARE_HOST,
  LEGACY_SHARE_HOST,
  'app.uniapplab.com',
  'uniapplab.com',
  'www.uniapplab.com',
] as const;

/**
 * Known-good static mark on disk. Kept until UniLive’s production brand files
 * are validated. Prefer resolveAppBrandFallbackIcon() for runtime UI.
 */
export const APP_BRAND_FALLBACK_ICON = '/brand/app-logo.png';

/** Alias used by older PWA / notification paths. */
export const APP_PWA_ICON = APP_BRAND_FALLBACK_ICON;

/** Registry-aware icon fallback (remote override handled by appBrandRuntime). */
export function resolveAppBrandFallbackIcon(): string {
  return resolveBrandVariantUrl('icon');
}

/** Registry-aware notification icon (falls back to known-good path when missing). */
export function resolveAppNotificationIcon(): string {
  return resolveBrandContextUrl('notification');
}

/** Registry-aware splash mark URL. */
export function resolveAppSplashBrandUrl(): string {
  return resolveBrandContextUrl('splash');
}
