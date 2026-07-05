/**
 * Central safe-area insets for iOS notch, home indicator, and Android status/gesture bars.
 * Writes --app-safe-* on :root so shell chrome and immersive screens share one source of truth.
 */

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

function visualViewportInsets(): { top: number; bottom: number; left: number; right: number } {
  const vv = window.visualViewport;
  if (!vv) {
    return { top: 0, bottom: 0, left: 0, right: 0 };
  }

  return {
    top: Math.max(0, vv.offsetTop),
    bottom: Math.max(0, window.innerHeight - vv.height - vv.offsetTop),
    left: Math.max(0, vv.offsetLeft),
    right: Math.max(0, window.innerWidth - vv.width - vv.offsetLeft),
  };
}

function isStandaloneDisplay(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** Minimal Android status-bar estimate when env() and visualViewport both report 0 in installed PWA. */
function androidTopFallback(envTop: number, vvTop: number): number {
  if (envTop > 0 || vvTop > 0) return 0;
  if (!/Android/i.test(navigator.userAgent)) return 0;
  if (!isStandaloneDisplay()) return 0;
  return 24;
}

export function updateAppSafeArea(): void {
  if (typeof document === 'undefined') return;

  const root = ROOT();
  const env = {
    top: readEnvInset('top'),
    bottom: readEnvInset('bottom'),
    left: readEnvInset('left'),
    right: readEnvInset('right'),
  };
  const vv = visualViewportInsets();
  const androidTop = androidTopFallback(env.top, vv.top);

  const top = Math.max(env.top, vv.top, androidTop);
  const bottom = Math.max(env.bottom, vv.bottom);
  const left = Math.max(env.left, vv.left);
  const right = Math.max(env.right, vv.right);

  root.style.setProperty('--app-safe-top', `${top}px`);
  root.style.setProperty('--app-safe-bottom', `${bottom}px`);
  root.style.setProperty('--app-safe-left', `${left}px`);
  root.style.setProperty('--app-safe-right', `${right}px`);

  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) {
    root.dataset.platform = 'ios';
  } else if (/Android/i.test(ua)) {
    root.dataset.platform = 'android';
  } else {
    root.dataset.platform = 'desktop';
  }
}

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
