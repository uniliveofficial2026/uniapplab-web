/**
 * Apply custom app logo to document head (favicon, apple-touch-icon, PWA manifest)
 * so every shell — browser tab, home screen, install prompt — uses the same mark.
 */
import { APP_BRAND_FALLBACK_ICON, APP_DISPLAY_NAME, APP_SHORT_NAME, resolveAppBrandFallbackIcon } from './appBrand';
import { readPlatformAppBrandCache } from './cloudSocial/platformAppBrandCloud';
import { isUniapplabHost } from './domains/uniapplab';
import { db } from './db/localDb';

const BRAND_ICON_LINK_ID = 'app-brand-dynamic-icon';
const BRAND_APPLE_LINK_ID = 'app-brand-dynamic-apple-touch';
const BRAND_MANIFEST_LINK_ID = 'app-brand-dynamic-manifest';
const API_MANIFEST = '/api/platform/manifest.webmanifest';
const API_BRAND_ICON = '/api/platform/brand-icon';

export type AppBrandSnapshot = {
  logoUrl: string | null;
  mediaType: 'image' | 'video';
};

let lastAppliedLogo: string | null | undefined;

function readSettingsBrand(): AppBrandSnapshot {
  try {
    const settings = db.settings;
    const logoUrl =
      typeof settings.appLogoUrl === 'string' && settings.appLogoUrl.trim()
        ? settings.appLogoUrl.trim()
        : null;
    return {
      logoUrl,
      mediaType: settings.appLogoMediaType === 'video' ? 'video' : 'image',
    };
  } catch {
    /* fall through */
  }

  if (typeof localStorage === 'undefined') {
    return { logoUrl: null, mediaType: 'image' };
  }
  try {
    const raw = localStorage.getItem('app_settings');
    if (!raw) return { logoUrl: null, mediaType: 'image' };
    const parsed = JSON.parse(raw) as {
      appLogoUrl?: string | null;
      appLogoMediaType?: string;
    };
    const logoUrl =
      typeof parsed.appLogoUrl === 'string' && parsed.appLogoUrl.trim()
        ? parsed.appLogoUrl.trim()
        : null;
    return {
      logoUrl,
      mediaType: parsed.appLogoMediaType === 'video' ? 'video' : 'image',
    };
  } catch {
    return { logoUrl: null, mediaType: 'image' };
  }
}

function readPlatformBrandFromLocalStorage(): AppBrandSnapshot | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem('platform_app_brand_remote');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { logoUrl?: string | null; mediaType?: string };
    const logoUrl =
      typeof parsed.logoUrl === 'string' && parsed.logoUrl.trim() ? parsed.logoUrl.trim() : null;
    if (!logoUrl) return null;
    return {
      logoUrl,
      mediaType: parsed.mediaType === 'video' ? 'video' : 'image',
    };
  } catch {
    return null;
  }
}

function hasCustomLogo(brand: AppBrandSnapshot): boolean {
  const fallback = resolveAppBrandFallbackIcon();
  return Boolean(
    brand.logoUrl &&
      brand.mediaType !== 'video' &&
      brand.logoUrl !== APP_BRAND_FALLBACK_ICON &&
      brand.logoUrl !== fallback,
  );
}

/** Platform backend logo wins; then local settings; then neutral static icon.
 * Local data-URL uploads always win so splash/auth logo picks are visible immediately.
 */
export function readAppBrandSnapshot(): AppBrandSnapshot {
  const settings = readSettingsBrand();
  if (settings.logoUrl?.startsWith('data:') || settings.logoUrl?.startsWith('blob:')) {
    return settings;
  }

  const platform = readPlatformAppBrandCache();
  if (platform.logoUrl) return platform;

  const platformLs = readPlatformBrandFromLocalStorage();
  if (platformLs?.logoUrl) return platformLs;

  if (settings.logoUrl) return settings;

  return {
    logoUrl: resolveAppBrandFallbackIcon(),
    mediaType: 'image',
  };
}

function canUseApiBrandRoutes(): boolean {
  if (typeof window === 'undefined') return false;
  if (import.meta.env.DEV) return true;
  return isUniapplabHost(window.location.hostname);
}

/** Install/PWA requires fetchable URLs — route data URLs through the API icon endpoint. */
function resolveHeadIconHref(brand: AppBrandSnapshot): string {
  if (!hasCustomLogo(brand)) return resolveAppBrandFallbackIcon();
  const logo = brand.logoUrl!;
  if (canUseApiBrandRoutes() && (logo.startsWith('data:') || logo.length > 2048)) {
    return API_BRAND_ICON;
  }
  return logo;
}

function upsertHeadLink(
  id: string,
  rel: string,
  href: string,
  type?: string,
): void {
  let el = document.getElementById(id) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.id = id;
    document.head.appendChild(el);
  }
  el.rel = rel;
  el.href = href;
  if (type) el.type = type;
  else el.removeAttribute('type');
}

function removeStaticManifestLinks(): void {
  document.querySelectorAll('link[rel="manifest"]').forEach((node) => {
    if (node.id !== BRAND_MANIFEST_LINK_ID) node.remove();
  });
}

function guessImageMime(url: string): string {
  if (url.startsWith('data:')) {
    const match = url.match(/^data:(image\/[a-zA-Z0-9.+-]+)/);
    return match?.[1] ?? 'image/png';
  }
  if (url.includes('brand-icon')) return 'image/png';
  if (url.endsWith('.svg')) return 'image/svg+xml';
  return 'image/png';
}

function setAppleWebAppTitle(): void {
  const meta = document.querySelector('meta[name="apple-mobile-web-app-title"]');
  if (meta) meta.setAttribute('content', APP_SHORT_NAME);
}

export function applyAppBrandToDocument(snapshot?: AppBrandSnapshot): void {
  if (typeof document === 'undefined') return;

  const brand = snapshot ?? readAppBrandSnapshot();
  const iconUrl = resolveHeadIconHref(brand);
  const custom = hasCustomLogo(brand);

  if (iconUrl === lastAppliedLogo && !custom) return;
  lastAppliedLogo = iconUrl;

  upsertHeadLink(BRAND_ICON_LINK_ID, 'icon', iconUrl, guessImageMime(iconUrl));
  upsertHeadLink(BRAND_APPLE_LINK_ID, 'apple-touch-icon', iconUrl);

  if (custom && canUseApiBrandRoutes()) {
    removeStaticManifestLinks();
    upsertHeadLink(BRAND_MANIFEST_LINK_ID, 'manifest', API_MANIFEST);
  } else {
    document.getElementById(BRAND_MANIFEST_LINK_ID)?.remove();
  }

  document.title = APP_DISPLAY_NAME;
  setAppleWebAppTitle();
}

export function initAppBrandRuntime(): void {
  applyAppBrandToDocument();

  const refreshBrand = () => {
    lastAppliedLogo = undefined;
    applyAppBrandToDocument();
  };

  window.addEventListener('app-brand:updated', refreshBrand);
  window.addEventListener('platform-app-brand-updated', refreshBrand);

  // On every app access / tab focus, re-read snapshot so logo surfaces stay current.
  const refreshOnAccess = () => {
    if (document.visibilityState && document.visibilityState !== 'visible') return;
    refreshBrand();
  };
  window.addEventListener('focus', refreshOnAccess);
  document.addEventListener('visibilitychange', refreshOnAccess);
  window.addEventListener('pageshow', refreshOnAccess);

  db.subscribe(() => {
    const next = resolveHeadIconHref(readAppBrandSnapshot());
    if (next !== lastAppliedLogo) {
      applyAppBrandToDocument();
    }
  });
}

/** Session hint: open Workspace on the admin & brand portal tab. */
export const WORKSPACE_ADMIN_TAB_HINT = 'workspace_open_admin_tab';
/** Session hint: after workspace unlock, open Admin Control → Greedy Tap Admin. */
export const WORKSPACE_GREEDY_ADMIN_HINT = 'workspace_open_greedy_admin';
export const WORKSPACE_GREEDY_ADMIN_EVENT = 'workspace-open-greedy-admin';

export function requestWorkspaceAdminTab(): void {
  try {
    sessionStorage.setItem(WORKSPACE_ADMIN_TAB_HINT, '1');
  } catch {
    /* ignore */
  }
}

/** Admin Panel nav: unlock workspace, then land on Greedy admin inside Admin & Portal. */
export function requestWorkspaceGreedyAdmin(): void {
  try {
    sessionStorage.setItem(WORKSPACE_ADMIN_TAB_HINT, '1');
    sessionStorage.setItem(WORKSPACE_GREEDY_ADMIN_HINT, '1');
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new CustomEvent(WORKSPACE_GREEDY_ADMIN_EVENT));
  } catch {
    /* ignore */
  }
}

export function consumeWorkspaceAdminTabHint(): boolean {
  try {
    const hit = sessionStorage.getItem(WORKSPACE_ADMIN_TAB_HINT) === '1';
    if (hit) sessionStorage.removeItem(WORKSPACE_ADMIN_TAB_HINT);
    return hit;
  } catch {
    return false;
  }
}

export function consumeWorkspaceGreedyAdminHint(): boolean {
  try {
    const hit = sessionStorage.getItem(WORKSPACE_GREEDY_ADMIN_HINT) === '1';
    if (hit) sessionStorage.removeItem(WORKSPACE_GREEDY_ADMIN_HINT);
    return hit;
  } catch {
    return false;
  }
}

export function peekWorkspaceAdminTabHint(): boolean {
  try {
    return sessionStorage.getItem(WORKSPACE_ADMIN_TAB_HINT) === '1';
  } catch {
    return false;
  }
}

export function peekWorkspaceGreedyAdminHint(): boolean {
  try {
    return sessionStorage.getItem(WORKSPACE_GREEDY_ADMIN_HINT) === '1';
  } catch {
    return false;
  }
}
