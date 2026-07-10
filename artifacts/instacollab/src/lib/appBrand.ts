/** Canonical product naming — import instead of hard-coding display strings. */
export const APP_DISPLAY_NAME = 'UniLive';
export const WORKSPACE_DISPLAY_NAME = 'UniappLab Workspace';
export const APP_SHORT_NAME = 'UniLive';
export const APP_TAGLINE =
  'UniLive is a live social app for going live, chatting, sharing posts, and collaborating with creators in real time.';
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
/** Hardcoded UniLive install / PWA / favicon mark (static asset in public/). */
export const APP_BRAND_FALLBACK_ICON = '/brand/app-logo.png';
/** Alias used by older PWA / notification paths. */
export const APP_PWA_ICON = APP_BRAND_FALLBACK_ICON;
