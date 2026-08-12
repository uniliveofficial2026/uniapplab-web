/**
 * Cross-platform runtime — one web + PWA surface for iOS, Android, Mac, Windows, Linux.
 * Detects OS / form factor / shell and exposes capability flags for install, media, OAuth.
 */

export type PlatformOs = 'ios' | 'android' | 'mac' | 'windows' | 'linux' | 'unknown';
export type PlatformForm = 'phone' | 'tablet' | 'desktop';
export type PlatformShell = 'browser' | 'standalone_pwa' | 'native';

export type PlatformCapabilities = {
  /** Host + browser can show an install affordance (Chromium BIP or Apple share steps). */
  canInstallPwa: boolean;
  /** Camera/mic require HTTPS (or localhost). */
  needsHttpsForMedia: boolean;
  /** Secure context is available right now. */
  isSecureContext: boolean;
  /** Chromium `beforeinstallprompt` may fire. */
  supportsBeforeInstallPrompt: boolean;
  /** Prefer Web Share API when available. */
  preferNativeShare: boolean;
  /** Show Share → Add to Home Screen copy (iOS / iPadOS). */
  usesAppleInstallHints: boolean;
  /** Prefer OAuth redirect over popup (mobile + standalone PWA). */
  preferOAuthRedirect: boolean;
  /** Coarse pointer / touch-primary UI. */
  isTouchPrimary: boolean;
  /** WebGL available for beauty / WebAR. */
  supportsWebGl: boolean;
  /** getUserMedia exists. */
  supportsMediaDevices: boolean;
};

export type PlatformRuntime = {
  os: PlatformOs;
  form: PlatformForm;
  shell: PlatformShell;
  capabilities: PlatformCapabilities;
  userAgent: string;
};

function readUa(): string {
  if (typeof navigator === 'undefined') return '';
  return navigator.userAgent || '';
}

function isIPadOsDesktopUa(ua: string): boolean {
  // iPadOS 13+ may report as Macintosh with touch.
  if (typeof navigator === 'undefined') return false;
  return /Macintosh/i.test(ua) && navigator.maxTouchPoints > 1;
}

export function detectPlatformOs(ua = readUa()): PlatformOs {
  if (!ua) return 'unknown';
  if (/iPhone|iPod/i.test(ua) || isIPadOsDesktopUa(ua) || /iPad/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  if (/Windows/i.test(ua)) return 'windows';
  if (/Mac OS X|Macintosh/i.test(ua)) return 'mac';
  if (/Linux/i.test(ua)) return 'linux';
  return 'unknown';
}

export function detectPlatformForm(ua = readUa(), os = detectPlatformOs(ua)): PlatformForm {
  if (typeof window === 'undefined') return 'desktop';

  const coarse =
    window.matchMedia?.('(pointer: coarse)').matches ||
    window.matchMedia?.('(hover: none)').matches;
  const narrow = window.matchMedia?.('(max-width: 767px)').matches;
  const mid = window.matchMedia?.('(min-width: 768px) and (max-width: 1024px)').matches;

  if (os === 'ios') {
    if (/iPad/i.test(ua) || isIPadOsDesktopUa(ua)) return 'tablet';
    return 'phone';
  }
  if (os === 'android') {
    if (/Mobile/i.test(ua) || narrow) return 'phone';
    if (mid || coarse) return 'tablet';
    return 'tablet';
  }
  if (narrow && coarse) return 'phone';
  if (mid && coarse) return 'tablet';
  return 'desktop';
}

export function detectPlatformShell(): PlatformShell {
  if (typeof window === 'undefined') return 'browser';
  const cap = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } })
    .Capacitor;
  if (cap?.isNativePlatform?.()) return 'native';
  const proto = window.location.protocol;
  if (proto === 'capacitor:' || proto === 'ionic:') return 'native';
  const nav = window.navigator as Navigator & { standalone?: boolean };
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches ||
    nav.standalone === true;
  return standalone ? 'standalone_pwa' : 'browser';
}

let webGlCached: boolean | null = null;

function detectWebGl(): boolean {
  if (webGlCached != null) return webGlCached;
  if (typeof document === 'undefined') {
    webGlCached = false;
    return false;
  }
  try {
    const canvas = document.createElement('canvas');
    webGlCached = Boolean(
      canvas.getContext('webgl') ||
        canvas.getContext('experimental-webgl') ||
        canvas.getContext('webgl2'),
    );
  } catch {
    webGlCached = false;
  }
  return webGlCached;
}

function isPrivateLanHost(hostname: string): boolean {
  if (!hostname) return false;
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]') return true;
  if (/^192\.168\./.test(hostname)) return true;
  if (/^10\./.test(hostname)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) return true;
  return false;
}

function buildCapabilities(
  os: PlatformOs,
  form: PlatformForm,
  shell: PlatformShell,
  ua: string,
): PlatformCapabilities {
  const secure =
    typeof window === 'undefined' ? true : window.isSecureContext !== false;
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const installableHost = Boolean(hostname) && !isPrivateLanHost(hostname);
  const isChromium =
    /Chrome|Chromium|Edg|CriOS|EdgA|EdgiOS/i.test(ua) && !/OPR\//i.test(ua);
  const isSafari =
    /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|Chrome|Chromium|Edg/i.test(ua);
  const touchPrimary =
    form !== 'desktop' ||
    (typeof window !== 'undefined' &&
      (window.matchMedia?.('(pointer: coarse)').matches ||
        window.matchMedia?.('(hover: none)').matches));

  const usesAppleInstallHints = os === 'ios' && shell === 'browser';
  const supportsBeforeInstallPrompt =
    shell === 'browser' && installableHost && (isChromium || os === 'android');

  return {
    canInstallPwa:
      shell === 'browser' &&
      installableHost &&
      (supportsBeforeInstallPrompt || usesAppleInstallHints || isSafari),
    needsHttpsForMedia: !secure,
    isSecureContext: secure,
    supportsBeforeInstallPrompt,
    preferNativeShare: typeof navigator !== 'undefined' && typeof navigator.share === 'function',
    usesAppleInstallHints,
    preferOAuthRedirect: form !== 'desktop' || shell !== 'browser',
    isTouchPrimary: Boolean(touchPrimary),
    supportsWebGl: detectWebGl(),
    supportsMediaDevices:
      typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia),
  };
}

let cached: PlatformRuntime | null = null;

/** Fresh snapshot (recomputes form/shell; cheap). */
export function getPlatformRuntime(): PlatformRuntime {
  const ua = readUa();
  const os = detectPlatformOs(ua);
  const form = detectPlatformForm(ua, os);
  const shell = detectPlatformShell();
  const next: PlatformRuntime = {
    os,
    form,
    shell,
    capabilities: buildCapabilities(os, form, shell, ua),
    userAgent: ua,
  };
  cached = next;
  return next;
}

/** Last computed runtime (or compute once). */
export function peekPlatformRuntime(): PlatformRuntime {
  return cached ?? getPlatformRuntime();
}

/** Invalidate cache after orientation / display-mode changes. */
export function invalidatePlatformRuntime(): void {
  cached = null;
}

export function explainInsecureMediaContext(): string {
  return (
    'Camera and microphone need a secure connection (HTTPS or localhost). ' +
    'On a phone, open the https:// preview URL or run `pnpm run mobile:preview` on your computer.'
  );
}

export function isBeautyRuntimeSupported(runtime = peekPlatformRuntime()): boolean {
  const { capabilities } = runtime;
  return (
    capabilities.isSecureContext &&
    capabilities.supportsMediaDevices &&
    capabilities.supportsWebGl
  );
}

/** Apply data-* attributes on <html> for CSS / debugging. */
export function applyPlatformRuntimeToDocument(runtime = getPlatformRuntime()): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.dataset.platformOs = runtime.os;
  root.dataset.platformForm = runtime.form;
  root.dataset.platformShell = runtime.shell;
  root.dataset.touchPrimary = runtime.capabilities.isTouchPrimary ? '1' : '0';
  // Back-compat with existing [data-platform] CSS expectations.
  if (runtime.os === 'ios') root.dataset.platform = 'ios';
  else if (runtime.os === 'android') root.dataset.platform = 'android';
  else root.dataset.platform = 'desktop';
}
