/**
 * Apply custom app logo to document head (favicon, apple-touch-icon, PWA manifest)
 * so every shell — browser tab, home screen, install prompt — uses the same mark.
 */
import { APP_BRAND_FALLBACK_ICON, APP_DISPLAY_NAME, APP_SHORT_NAME } from './appBrand';
import { readPlatformAppBrandCache } from './cloudSocial/platformAppBrandCloud';
import { db } from './db/localDb';

const BRAND_ICON_LINK_ID = 'app-brand-dynamic-icon';
const BRAND_APPLE_LINK_ID = 'app-brand-dynamic-apple-touch';
const BRAND_MANIFEST_LINK_ID = 'app-brand-dynamic-manifest';

export type AppBrandSnapshot = {
  logoUrl: string | null;
  mediaType: 'image' | 'video';
};

let manifestObjectUrl: string | null = null;
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

/** Platform backend logo wins; then local settings; then neutral static icon. */
export function readAppBrandSnapshot(): AppBrandSnapshot {
  const platform = readPlatformAppBrandCache();
  if (platform.logoUrl) return platform;

  const platformLs = readPlatformBrandFromLocalStorage();
  if (platformLs?.logoUrl) return platformLs;

  const settings = readSettingsBrand();
  if (settings.logoUrl) return settings;

  return {
    logoUrl: APP_BRAND_FALLBACK_ICON,
    mediaType: 'image',
  };
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

function removeHeadLink(id: string): void {
  document.getElementById(id)?.remove();
}

function guessImageMime(dataUrl: string): string {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+)/);
  return match?.[1] ?? 'image/png';
}

function applyDynamicManifest(iconUrl: string): void {
  if (manifestObjectUrl) {
    URL.revokeObjectURL(manifestObjectUrl);
    manifestObjectUrl = null;
  }

  const manifest = {
    name: APP_DISPLAY_NAME,
    short_name: APP_SHORT_NAME,
    icons: [
      {
        src: iconUrl,
        sizes: '512x512',
        type: guessImageMime(iconUrl),
        purpose: 'any',
      },
      {
        src: iconUrl,
        sizes: '512x512',
        type: guessImageMime(iconUrl),
        purpose: 'maskable',
      },
    ],
  };

  manifestObjectUrl = URL.createObjectURL(
    new Blob([JSON.stringify(manifest)], { type: 'application/json' }),
  );
  upsertHeadLink(BRAND_MANIFEST_LINK_ID, 'manifest', manifestObjectUrl);
}

function setAppleWebAppTitle(): void {
  const meta = document.querySelector('meta[name="apple-mobile-web-app-title"]');
  if (meta) meta.setAttribute('content', APP_SHORT_NAME);
}

export function applyAppBrandToDocument(snapshot?: AppBrandSnapshot): void {
  if (typeof document === 'undefined') return;

  const brand = snapshot ?? readAppBrandSnapshot();
  const iconUrl =
    brand.logoUrl && brand.mediaType !== 'video' ? brand.logoUrl : APP_BRAND_FALLBACK_ICON;

  if (iconUrl === lastAppliedLogo) return;
  lastAppliedLogo = iconUrl;

  const mime = iconUrl.startsWith('data:') ? guessImageMime(iconUrl) : 'image/svg+xml';
  upsertHeadLink(BRAND_ICON_LINK_ID, 'icon', iconUrl, mime);
  upsertHeadLink(BRAND_APPLE_LINK_ID, 'apple-touch-icon', iconUrl);
  applyDynamicManifest(iconUrl);

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

  db.subscribe(() => {
    const next = readAppBrandSnapshot().logoUrl;
    if (next !== lastAppliedLogo) {
      applyAppBrandToDocument();
    }
  });
}

/** Session hint: open Workspace on the admin & brand portal tab. */
export const WORKSPACE_ADMIN_TAB_HINT = 'workspace_open_admin_tab';

export function requestWorkspaceAdminTab(): void {
  try {
    sessionStorage.setItem(WORKSPACE_ADMIN_TAB_HINT, '1');
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
