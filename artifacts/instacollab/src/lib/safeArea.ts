/**
 * Central safe-area + dynamic viewport + keyboard SSOT for phone/tablet / Capacitor.
 *
 * Writes on :root:
 *   --app-safe-*          static notch / home-indicator insets (NOT keyboard)
 *   --app-vv-height/width visual viewport (above keyboard when open)
 *   --app-keyboard-inset  soft keyboard overlap height
 *   --keyboard-height     alias of --app-keyboard-inset
 *   --app-height          alias of --app-vv-height
 *   --app-shell-*-offset  chrome offsets (nav + static safe)
 *
 * Keyboard strategy (native): Capacitor KeyboardResize.None + plugin height events.
 * Do not also Body-resize the WebView — that double-moves fixed/flex composers.
 */
import {
  applyPlatformRuntimeToDocument,
  getPlatformRuntime,
  invalidatePlatformRuntime,
} from './platform/runtime';

const ROOT = () => document.documentElement;

/** Cap plugin keyboard height (px). 0 when closed / web without Cap. */
let nativeKeyboardHeightPx = 0;

export type AppViewportSnapshot = {
  viewportWidth: number;
  viewportHeight: number;
  visualViewportHeight: number;
  keyboardVisible: boolean;
  keyboardHeight: number;
  safeAreaTop: number;
  safeAreaBottom: number;
  safeAreaLeft: number;
  safeAreaRight: number;
  orientation: 'portrait' | 'landscape';
};

let lastSnapshot: AppViewportSnapshot = {
  viewportWidth: typeof window !== 'undefined' ? window.innerWidth : 0,
  viewportHeight: typeof window !== 'undefined' ? window.innerHeight : 0,
  visualViewportHeight: typeof window !== 'undefined' ? window.innerHeight : 0,
  keyboardVisible: false,
  keyboardHeight: 0,
  safeAreaTop: 0,
  safeAreaBottom: 0,
  safeAreaLeft: 0,
  safeAreaRight: 0,
  orientation: 'portrait',
};

const viewportListeners = new Set<(s: AppViewportSnapshot) => void>();

export function getAppViewportSnapshot(): AppViewportSnapshot {
  return lastSnapshot;
}

export function subscribeAppViewport(
  listener: (s: AppViewportSnapshot) => void,
): () => void {
  viewportListeners.add(listener);
  return () => {
    viewportListeners.delete(listener);
  };
}

function emitViewport(snapshot: AppViewportSnapshot): void {
  lastSnapshot = snapshot;
  viewportListeners.forEach((fn) => {
    try {
      fn(snapshot);
    } catch {
      /* ignore subscriber errors */
    }
  });
}

/**
 * Called from Capacitor keyboardWill/DidShow with event.keyboardHeight.
 * Prefer this over visualViewport alone on iOS WKWebView.
 */
export function setNativeKeyboardHeight(heightPx: number): void {
  const next = Number.isFinite(heightPx) ? Math.max(0, Math.round(heightPx)) : 0;
  if (next === nativeKeyboardHeightPx) {
    scheduleUpdateAppSafeArea();
    return;
  }
  nativeKeyboardHeightPx = next;
  scheduleUpdateAppSafeArea();
}

export function clearNativeKeyboardHeight(): void {
  if (nativeKeyboardHeightPx === 0) {
    scheduleUpdateAppSafeArea();
    return;
  }
  nativeKeyboardHeightPx = 0;
  scheduleUpdateAppSafeArea();
}

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
 * When env(safe-area-*) reports 0, Capacitor / PWA WebViews may still sit under
 * status + gesture bars — apply OS class fallbacks (not model-specific pixels).
 */
function nativeShellFallbacks(
  envTop: number,
  envBottom: number,
): { top: number; bottom: number } {
  const runtime = getPlatformRuntime();
  const needsFallback =
    runtime.shell === 'native' || runtime.shell === 'standalone_pwa';
  if (!needsFallback) return { top: 0, bottom: 0 };

  let top = 0;
  let bottom = 0;

  if (envTop <= 0) {
    if (runtime.os === 'android') top = 28;
    else if (runtime.os === 'ios') top = 47;
  }

  if (envBottom <= 0) {
    if (runtime.os === 'android') bottom = 24;
    else if (runtime.os === 'ios') bottom = 34;
  }

  return { top, bottom };
}

let rafScheduled = false;

export function scheduleUpdateAppSafeArea(): void {
  if (typeof window === 'undefined') return;
  if (rafScheduled) return;
  rafScheduled = true;
  requestAnimationFrame(() => {
    rafScheduled = false;
    updateAppSafeArea();
  });
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
  const fallback = nativeShellFallbacks(env.top, env.bottom);

  // Static safe insets only — never fold keyboard height into --app-safe-bottom.
  const top = Math.max(env.top, fallback.top);
  const staticBottom = Math.max(env.bottom, fallback.bottom);
  const left = Math.max(env.left, vv.left);
  const right = Math.max(env.right, vv.right);

  // Keyboard: Cap plugin height wins; visualViewport bottom is web/PWA fallback.
  const vvKeyboard = Math.max(0, vv.bottom - env.bottom);
  const keyboardInset = Math.max(nativeKeyboardHeightPx, vvKeyboard);
  const keyboardOpen = keyboardInset > 40;

  // Prefer visualViewport height; when Cap reports keyboard but vv has not shrunk yet,
  // subtract keyboard so flex shells (h-vv) still clear the IME.
  let height = Math.max(1, Math.round(vv.height || window.innerHeight));
  if (
    keyboardOpen &&
    nativeKeyboardHeightPx > 40 &&
    vvKeyboard < nativeKeyboardHeightPx * 0.5
  ) {
    height = Math.max(
      1,
      Math.round(window.innerHeight - nativeKeyboardHeightPx),
    );
  }
  const width = Math.max(1, Math.round(vv.width || window.innerWidth));

  root.style.setProperty('--app-safe-top', `${top}px`);
  root.style.setProperty('--app-safe-bottom', `${staticBottom}px`);
  root.style.setProperty('--app-safe-left', `${left}px`);
  root.style.setProperty('--app-safe-right', `${right}px`);
  root.style.setProperty('--app-vv-height', `${height}px`);
  root.style.setProperty('--app-vv-width', `${width}px`);
  root.style.setProperty('--app-height', `${height}px`);
  root.style.setProperty('--app-keyboard-inset', `${keyboardInset}px`);
  root.style.setProperty('--keyboard-height', `${keyboardInset}px`);
  // Composer / fixed footers: keyboard when open, else home-indicator safe bottom.
  root.style.setProperty(
    '--app-composer-bottom-inset',
    `${keyboardOpen ? keyboardInset : staticBottom}px`,
  );
  root.style.setProperty(
    '--app-shell-top-offset',
    `calc(${top}px + var(--app-mobile-top-nav-h, 60px))`,
  );
  root.style.setProperty(
    '--app-shell-bottom-offset',
    keyboardOpen
      ? `0px`
      : `calc(${staticBottom}px + var(--app-mobile-bottom-nav-h, 50px))`,
  );

  root.dataset.keyboardOpen = keyboardOpen ? '1' : '0';
  root.dataset.nativeOverflowFix = runtime.shell === 'native' ? '1' : '0';

  const orientation: 'portrait' | 'landscape' =
    width >= height ? 'landscape' : 'portrait';

  emitViewport({
    viewportWidth: width,
    viewportHeight: Math.round(window.innerHeight),
    visualViewportHeight: height,
    keyboardVisible: keyboardOpen,
    keyboardHeight: keyboardInset,
    safeAreaTop: top,
    safeAreaBottom: staticBottom,
    safeAreaLeft: left,
    safeAreaRight: right,
    orientation,
  });
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
  composerBottom: 'pb-[var(--app-composer-bottom-inset)]',
} as const;

let installed = false;

export function installAppSafeArea(): void {
  if (typeof window === 'undefined' || installed) return;
  installed = true;

  updateAppSafeArea();

  const onGeom = () => scheduleUpdateAppSafeArea();
  window.addEventListener('resize', onGeom, { passive: true });
  window.addEventListener('orientationchange', onGeom, { passive: true });
  window.visualViewport?.addEventListener('resize', onGeom, { passive: true });
  window.visualViewport?.addEventListener('scroll', onGeom, { passive: true });
}
