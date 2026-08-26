/**
 * Shared browser layout probes for responsive / overflow / overlap gates.
 */
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const instacollabRoot = path.resolve(__dirname, '../../../artifacts/instacollab');
const playwrightEntry = path.join(instacollabRoot, 'node_modules/playwright/index.js');

let playwrightModulePromise;

async function getChromium() {
  if (!playwrightModulePromise) {
    playwrightModulePromise = import(pathToFileURL(playwrightEntry).href);
  }
  const mod = await playwrightModulePromise;
  const pw = mod.chromium ? mod : mod.default;
  return pw.chromium;
}

export async function launchChromium(opts = {}) {
  const chromium = await getChromium();
  return chromium.launch({ headless: true, ...opts });
}

export const VIEWPORT_MATRIX = {
  smallPhone: { width: 320, height: 568, label: 'smallPhone' },
  standardPhone: { width: 375, height: 667, label: 'standardPhone' },
  modernPhone: { width: 390, height: 844, label: 'modernPhone' },
  largePhone: { width: 430, height: 932, label: 'largePhone' },
  androidPhone: { width: 360, height: 800, label: 'androidPhone' },
  tablet: { width: 768, height: 1024, label: 'tablet' },
  desktop: { width: 1280, height: 800, label: 'desktop' },
};

export const SHELL_ROUTES = [
  { screenId: 'home', route: '/home', tab: 'Home' },
  { screenId: 'search', route: '/explore', tab: 'Discover' },
  { screenId: 'reels', route: '/reels', tab: 'Reels' },
  { screenId: 'messages', route: '/messages', tab: 'Messages' },
  { screenId: 'live', route: '/live', tab: 'Live' },
  { screenId: 'wallet', route: '/wallet', tab: 'Wallet' },
  { screenId: 'profile', route: '/profile', tab: 'Profile' },
];

export const CRITICAL_LANDMARKS = [
  { id: 'home-nav', selector: '[data-testid="home-nav"]', role: 'bottomNav' },
  { id: 'mobile-bottom-nav', selector: '.mobile-bottom-nav', role: 'bottomNav' },
  { id: 'app-main', selector: 'main, [data-app-main], .app-main', role: 'content' },
];

export const MOBILE_USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

/** In-page geometry probe (runs inside browser context). */
export function layoutProbeSource() {
  return function probeLayout(opts = {}) {
    const safeTop = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--app-safe-top'),
    ) || 0;
    const safeBottom = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--app-safe-bottom'),
    ) || 0;
    const doc = document.documentElement;
    const horizontalOverflowPx = Math.max(
      0,
      doc.scrollWidth - doc.clientWidth,
      (document.body?.scrollWidth || 0) - (document.body?.clientWidth || 0),
    );

    const selectors = opts.selectors || [];
    const landmarks = selectors.map((s) => {
      const el = document.querySelector(s.selector);
      if (!el) {
        return { id: s.id, found: false, role: s.role };
      }
      const r = el.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const underTop = r.top < safeTop - 2;
      const underBottom = r.bottom > vh - safeBottom + 2;
      return {
        id: s.id,
        found: true,
        role: s.role,
        width: Math.round(r.width),
        height: Math.round(r.height),
        top: Math.round(r.top),
        bottom: Math.round(r.bottom),
        left: Math.round(r.left),
        right: Math.round(r.right),
        zeroSize: r.width <= 0 || r.height <= 0,
        underSafeTop: underTop,
        underSafeBottom: underBottom,
        escapesViewportWidth: r.right > vw + 2 || r.left < -2,
      };
    });

    const failures = [];
    if (horizontalOverflowPx > 2) {
      failures.push({
        failureClass: 'HORIZONTAL_OVERFLOW',
        px: horizontalOverflowPx,
      });
    }
    for (const lm of landmarks) {
      if (!lm.found) continue;
      if (lm.zeroSize) {
        failures.push({ failureClass: 'ZERO_SIZE', id: lm.id });
      }
      if (lm.underSafeTop) {
        failures.push({ failureClass: 'SAFE_TOP_OVERLAP', id: lm.id });
      }
      if (lm.underSafeBottom) {
        failures.push({ failureClass: 'SAFE_BOTTOM_OVERLAP', id: lm.id });
      }
      if (lm.escapesViewportWidth) {
        failures.push({ failureClass: 'HORIZONTAL_OVERFLOW', id: lm.id });
      }
    }

    const shellReady = landmarks.some(
      (lm) => (lm.id === 'mobile-bottom-nav' || lm.id === 'home-nav') && lm.found,
    );

    return {
      url: location.href,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      safeTop,
      safeBottom,
      horizontalOverflowPx,
      horizontalOverflow: horizontalOverflowPx > 2,
      keyboardOpen: document.documentElement.dataset.keyboardOpen === '1',
      shellReady,
      landmarks,
      failures,
      ok: failures.length === 0,
    };
  };
}

export async function loginIfNeeded(page, email, password) {
  await page.goto(process.env.UNILIVE_E2E_BASE || 'https://app.uniapplab.com/', {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForTimeout(4000);

  for (let i = 0; i < 5; i++) {
    const next = page.getByRole('button', { name: 'Next' });
    if ((await next.count()) > 0) {
      await next.first().click({ force: true });
      await page.waitForTimeout(500);
      continue;
    }
    const skip = page.getByRole('button', { name: /Skip onboarding|Get started/i });
    if ((await skip.count()) > 0) {
      await skip.first().click({ force: true });
      break;
    }
    break;
  }

  const shell =
    (await page.locator('[data-testid="home-nav"], .mobile-bottom-nav').count()) > 0;
  if (shell) return true;

  await page.getByRole('button', { name: /Agree to Terms/i }).click({ force: true }).catch(() => {});
  const signup = page.getByRole('button', { name: /Sign Up with Email|Sign in with Email|Email/i });
  if ((await signup.count()) > 0) await signup.first().click({ force: true });
  await page.getByRole('button', { name: /^Log in$/i }).click({ force: true }).catch(() => {});

  const emailInput = page.locator('input[type="email"], input[name="email"]').first();
  if ((await emailInput.count()) > 0) {
    await emailInput.fill(email);
    await page.locator('input[type="password"]').first().fill(password);
    await page.getByRole('button', { name: /^Log in$/i }).click({ force: true }).catch(() => {});
    await page.waitForTimeout(5000);
  }

  return (await page.locator('[data-testid="home-nav"], .mobile-bottom-nav').count()) > 0;
}

export async function navigateShellTab(page, tabName) {
  const re = new RegExp(`^${tabName}$`, 'i');
  if (await page.getByRole('button', { name: re }).first().click({ force: true, timeout: 3000 }).then(() => true).catch(() => false)) {
    await page.waitForTimeout(1200);
    return true;
  }
  if (await page.getByRole('link', { name: re }).first().click({ force: true, timeout: 3000 }).then(() => true).catch(() => false)) {
    await page.waitForTimeout(1200);
    return true;
  }
  const aria = page.locator(`[aria-label="${tabName}"]`).first();
  if ((await aria.count()) > 0) {
    await aria.click({ force: true });
    await page.waitForTimeout(1200);
    return true;
  }
  return false;
}
