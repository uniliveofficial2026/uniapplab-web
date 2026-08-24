/**
 * Central safe-area insets for iOS notch, home indicator, Android status/gesture bars,
 * and soft-keyboard (visualViewport) insets on phone/tablet / Capacitor.
 * Writes --app-safe-* and --app-vv-* on :root for shell chrome and immersive screens.
 */
import {
  applyPlatformRuntimeToDocument,
  getPlatformRuntime,
  invalidatePlatformRuntime,
} from './platform/runtime';

const ROOT = () => document.documentElement;

function readEnvInset(edge: 'top' | 'bottom' | 'left' | 'right'): number {
  if (typeof document === 'undefined') return 0;
  const probe = document.createElement('div');
  probe.style.cssText = [
    'position:fixed',
    'top:0',
    'left:0',
    'visibility:hidden',
    'pointer-events:none',
    `padding-${edge}:env(safe-area-inset-${edge},0px)`,
  ].join(';');
  document.documentElement.appendChild(probe);
  const raw = getComputedStyle(probe).getPropertyValue(`padding-${edge}`);
  probe.remove();
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : 0;
}

function visualViewportInsets(): {
  top: number;
  bottom: number;
  left: number;
  right: number;
  height: number;
  width: number;
} {
  const vv = window.visualViewport;
  if (!vv) {
    return {
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      height: window.innerHeight,
      width: window.innerWidth,
    };
  }

  return {
    top: Math.max(0, vv.offsetTop),
    bottom: Math.max(0, window.innerHeight - vv.height - vv.offsetTop),
    left: Math.max(0, vv.offsetLeft),
    right: Math.max(0, window.innerWidth - vv.width - vv.offsetLeft),
    height: vv.height,
    width: vv.width,
  };
}

/**
 * When env(safe-area-*) and visualViewport both report 0, Capacitor / PWA WebViews
 * still sit under status + gesture bars — apply OS fallbacks so chrome doesn't clip.
 */
function nativeShellFallbacks(
  envTop: number,
  envBottom: number,
  vvTop: number,
  vvBottom: number,
): { top: number; bottom: number } {
  const runtime = getPlatformRuntime();
  const needsFallback =
    runtime.shell === 'native' || runtime.shell === 'standalone_pwa';
  if (!needsFallback) return { top: 0, bottom: 0 };

  let top = 0;
  let bottom = 0;

  if (envTop <= 0 && vvTop <= 0) {
    if (runtime.os === 'android') top = 28;
    else if (runtime.os === 'ios') top = 47; // notch / Dynamic Island class devices
  }

  if (envBottom <= 0 && vvBottom <= 0) {
    if (runtime.os === 'android') bottom = 24; // gesture / 3-button nav
    else if (runtime.os === 'ios') bottom = 34; // home indicator
  }

  return { top, bottom };
}

export function updateAppSafeArea(): void {
  if (typeof document === 'undefined') return;

  invalidatePlatformRuntime();
  const runtime = getPlatformRuntime();
  applyPlatformRuntimeToDocument(runtime);

  const root = ROOT();
  const env = {
    top: readEnvInset('top'),
    bottom: readEnvInset('bottom'),
    left: readEnvInset('left'),
    right: readEnvInset('right'),
  };
  const vv = visualViewportInsets();
  const fallback = nativeShellFallbacks(env.top, env.bottom, vv.top, vv.bottom);

  const top = Math.max(env.top, vv.top, fallback.top);
  // Keyboard / home indicator: prefer the larger of env safe-area and visualViewport shrink.
  const bottom = Math.max(env.bottom, vv.bottom, fallback.bottom);
  const left = Math.max(env.left, vv.left);
  const right = Math.max(env.right, vv.right);

  // Prefer visualViewport height on native — 100dvh can exceed the WebView and overflow.
  const height = Math.max(1, Math.round(vv.height || window.innerHeight));
  const width = Math.max(1, Math.round(vv.width || window.innerWidth));

  root.style.setProperty('--app-safe-top', `${top}px`);
  root.style.setProperty('--app-safe-bottom', `${bottom}px`);
  root.style.setProperty('--app-safe-left', `${left}px`);
  root.style.setProperty('--app-safe-right', `${right}px`);
  root.style.setProperty('--app-vv-height', `${height}px`);
  root.style.setProperty('--app-vv-width', `${width}px`);
  root.style.setProperty(
    '--app-shell-top-offset',
    `calc(${top}px + var(--app-mobile-top-nav-h, 60px))`,
  );
  root.style.setProperty(
    '--app-shell-bottom-offset',
    `calc(${bottom}px + var(--app-mobile-bottom-nav-h, 50px))`,
  );
  // Keyboard-only inset (visualViewport bottom beyond static safe-area).
  const keyboard = Math.max(0, vv.bottom - env.bottom);
  root.style.setProperty('--app-keyboard-inset', `${keyboard}px`);
  root.dataset.keyboardOpen = keyboard > 40 ? '1' : '0';
  root.dataset.nativeOverflowFix = runtime.shell === 'native' ? '1' : '0';
}

/** Tailwind-friendly class fragments for common chrome. */
export const SAFE_AREA_CLASS = {
  padTop: 'pt-[var(--app-safe-top)]',
  padBottom: 'pb-[var(--app-safe-bottom)]',
  padX: 'pl-[var(--app-safe-left)] pr-[var(--app-safe-right)]',
  padAll:
    'pt-[var(--app-safe-top)] pb-[var(--app-safe-bottom)] pl-[var(--app-safe-left)] pr-[var(--app-safe-right)]',
  shellTop: 'pt-[var(--app-shell-top-offset)]',
  shellBottom: 'pb-[var(--app-shell-bottom-offset)]',
  maxHeightVv: 'max-h-[var(--app-vv-height)]',
  heightVv: 'h-[var(--app-vv-height)]',
} as const;

let installed = false;

export function installAppSafeArea(): void {
  if (typeof window === 'undefined' || installed) return;
  installed = true;

  updateAppSafeArea();

  window.addEventListener('resize', updateAppSafeArea, { passive: true });
  window.addEventListener('orientationchange', updateAppSafeArea, { passive: true });
  window.visualViewport?.addEventListener('resize', updateAppSafeArea, { passive: true });
  window.visualViewport?.addEventListener('scroll', updateAppSafeArea, { passive: true });
}
