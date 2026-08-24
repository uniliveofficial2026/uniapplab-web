/**
 * Shared helpers for Stage A pixel visual baselines + mount smokes.
 * uiUxChanged: false — capture/compare only; no UI redesign.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const APP_ROOT = path.resolve(__dirname, '../..');
export const REPO_ROOT = path.resolve(APP_ROOT, '../..');
export const BASELINES_DIR = path.join(APP_ROOT, 'test/visual-baselines');
export const CAPTURE_OUT_DIR = path.join(REPO_ROOT, '.local/visual-captures');
export const DEFAULT_BASE = 'http://127.0.0.1:5173';
export const VIEWPORT = { width: 1280, height: 900 };

/** Per-channel RGB delta allowed before a pixel counts as different. */
export const PIXEL_CHANNEL_TOLERANCE = 24;
/** Max fraction of differing pixels (0–1) before FAIL. */
export const PIXEL_MISMATCH_RATIO = 0.02;

export const CRITICAL_ROUTES = [
  {
    id: 'home-feed',
    label: 'Home/Feed shell',
    path: '/home',
    // Feed cards / avatars / stories are dynamic — mask content; lock chrome.
    stabilize: 'shell-chrome',
    maxMismatchRatio: 0.04,
    readySelectors: [
      '#root nav',
      '#root [role="navigation"]',
      '#root [data-app-shell]',
      '#root main',
    ],
    readyText: [/UniLive/i, /Karaoke/i],
  },
  {
    id: 'messages',
    label: 'Messages',
    path: '/messages',
    stabilize: 'freeze-motion',
    maxMismatchRatio: 0.03,
    readySelectors: ['#messages-screen', '[data-chat-open]'],
    readyText: [/Messages|Inbox|New message/i],
  },
  {
    id: 'live-create-room',
    label: 'Live create-room',
    path: '/home',
    kind: 'create-room',
    stabilize: 'shell-chrome',
    maxMismatchRatio: 0.15,
    readySelectors: [
      '#create-room-name-live',
      '#create-room-name',
      '[data-instant-room-entry]',
      '[data-ui-id="live.approved.room-chrome"]',
    ],
    readyText: [/create room|your room|go live/i],
  },
  {
    id: 'marketplace',
    label: 'Marketplace',
    path: '/home',
    kind: 'marketplace',
    // Catalog tiles / promo art change often — lock modal chrome, allow body churn.
    stabilize: 'shell-chrome',
    maxMismatchRatio: 0.35,
    readySelectors: ['#marketplace-modal'],
    readyText: [/Creator Marketplace/i],
  },
];

export function findPlaywrightChromiumExecutable() {
  const roots = [
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    '/Volumes/Wei2TB/MacData/tools/playwright-browsers',
    path.join(os.homedir(), '.cache/ms-playwright'),
    path.join(REPO_ROOT, '.local/playwright-browsers'),
    path.join(APP_ROOT, '.local/playwright-browsers'),
  ].filter(Boolean);

  for (const root of roots) {
    let entries = [];
    try {
      entries = fs.readdirSync(root);
    } catch {
      continue;
    }
    for (const entry of entries) {
      const shell = path.join(root, entry, 'chrome-mac/headless_shell');
      if (fs.existsSync(shell)) return shell;
      const full = path.join(
        root,
        entry,
        'chrome-mac/Chromium.app/Contents/MacOS/Chromium',
      );
      if (fs.existsSync(full)) return full;
    }
  }
  return null;
}

export async function launchBrowser() {
  const args = [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    '--autoplay-policy=no-user-gesture-required',
  ];
  const executablePath = findPlaywrightChromiumExecutable();
  if (executablePath) {
    try {
      return await chromium.launch({ headless: true, executablePath, args });
    } catch {
      /* fall through */
    }
  }
  try {
    return await chromium.launch({ channel: 'chrome', headless: true, args });
  } catch {
    return chromium.launch({ headless: true, args });
  }
}

export function probeHttpOk(url, timeoutMs = 2_000) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      res.resume();
      resolve(res.statusCode >= 200 && res.statusCode < 500);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

/**
 * Use existing vite/preview if up; otherwise start `pnpm dev` briefly.
 * Returns { base, stop } where stop() kills a process we started.
 */
export async function ensureDevServer(preferredBase = DEFAULT_BASE) {
  const base = (preferredBase || DEFAULT_BASE).replace(/\/$/, '');
  if (await probeHttpOk(base)) {
    return { base, stop: async () => undefined, started: false };
  }

  console.log(`[visual-baseline] no server at ${base}; starting vite…`);
  const child = spawn('pnpm', ['exec', 'vite', '--config', 'vite.config.ts', '--host', '127.0.0.1', '--port', '5173'], {
    cwd: APP_ROOT,
    env: { ...process.env, DEV_BIND_HOST: '127.0.0.1' },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  });

  let stderr = '';
  child.stderr?.on('data', (buf) => {
    stderr += buf.toString();
  });

  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (child.exitCode != null) {
      throw new Error(`vite exited early (${child.exitCode}): ${stderr.slice(0, 400)}`);
    }
    if (await probeHttpOk(base)) {
      return {
        base,
        started: true,
        stop: async () => {
          try {
            child.kill('SIGTERM');
          } catch {
            /* ignore */
          }
        },
      };
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  try {
    child.kill('SIGTERM');
  } catch {
    /* ignore */
  }
  throw new Error(`vite did not become ready at ${base} within 90s`);
}

export async function dismissLaunchOverlays(page, maxMs = 45_000) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    for (const name of [
      /skip onboarding/i,
      /^skip$/i,
      /^next$/i,
      /^continue$/i,
      /^enter app$/i,
      /^get started$/i,
    ]) {
      const btn = page.getByRole('button', { name }).first();
      if (await btn.isVisible().catch(() => false)) {
        await btn.click({ timeout: 1_500 }).catch(() => undefined);
      }
    }
    for (const re of [/Switch as @/i]) {
      const switchBtn = page.getByText(re).first();
      if (await switchBtn.isVisible().catch(() => false)) {
        await switchBtn.click({ timeout: 1_500 }).catch(() => undefined);
      }
    }

    const ready =
      (await page
        .locator('#root')
        .locator('nav, [role="navigation"], main, [data-app-shell]')
        .first()
        .isVisible()
        .catch(() => false)) ||
      (await page.getByText('Karaoke', { exact: true }).first().isVisible().catch(() => false)) ||
      (await page.getByText('UniLive', { exact: false }).first().isVisible().catch(() => false)) ||
      (await page.locator('#root button, #root a').first().isVisible().catch(() => false));
    if (ready) return true;
    await page.waitForTimeout(250);
  }
  return false;
}

export async function detectAuthGate(page) {
  const markers = [
    page.getByRole('heading', { name: /sign in|log in|welcome back/i }).first(),
    page.getByRole('button', { name: /continue with google|sign in with/i }).first(),
    page.locator('[data-auth-screen], #auth-screen, .auth-screen').first(),
    page.getByText(/enter your email|verify your code/i).first(),
  ];
  for (const loc of markers) {
    if (await loc.isVisible().catch(() => false)) return true;
  }
  const body = ((await page.locator('body').innerText().catch(() => '')) || '').slice(0, 800);
  if (/sign in to continue|create an account|otp code/i.test(body) && !/Karaoke|UniLive|Messages/i.test(body)) {
    return true;
  }
  return false;
}

export async function waitForAnyReady(page, route, timeoutMs = 25_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const sel of route.readySelectors || []) {
      const loc = page.locator(sel).first();
      if ((await loc.count().catch(() => 0)) > 0) {
        const visible = await loc.isVisible().catch(() => false);
        if (visible || sel.includes('instant-room')) {
          return { ok: true, via: sel, visible };
        }
      }
    }
    for (const re of route.readyText || []) {
      const loc = page.getByText(re).first();
      if (await loc.isVisible().catch(() => false)) {
        return { ok: true, via: String(re), visible: true };
      }
    }
    await page.waitForTimeout(250);
  }
  return { ok: false };
}

export async function openCreateRoom(page) {
  await page.evaluate(() => {
    const detail = {
      path: '/room/create',
      entry: 'karaoke-party',
      roomName: 'StageA Visual Baseline',
    };
    window.dispatchEvent(new CustomEvent('instant-room-open', { detail }));
    window.dispatchEvent(new CustomEvent('karaoke-room-open', { detail }));
  });
  await page.locator('[data-instant-room-entry]').waitFor({ state: 'attached', timeout: 20_000 });
}

/**
 * Reduce non-deterministic pixels before screenshot (no UI redesign —
 * temporary capture-only CSS injection).
 */
export async function stabilizeForCapture(page, route) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation: none !important;
        animation-duration: 0s !important;
        transition: none !important;
        caret-color: transparent !important;
      }
      video, canvas {
        visibility: hidden !important;
      }
    `,
  }).catch(() => undefined);

  if (route.stabilize === 'shell-chrome') {
    // Mask the primary scroll/content column; keep nav / shell chrome visible.
    await page.evaluate(() => {
      const style = document.createElement('style');
      style.setAttribute('data-visual-baseline-mask', '1');
      style.textContent = `
        #root main,
        #root [data-feed],
        #root .feed-scroll,
        #root [class*="Feed"],
        #root article,
        #root [role="feed"] {
          background: #121212 !important;
        }
        #root main img,
        #root main video,
        #root [role="feed"] img,
        #root article img,
        #root main canvas {
          opacity: 0 !important;
        }
      `;
      document.head.appendChild(style);

      // If main exists, overlay a solid mask inset so only shell chrome remains.
      const main = document.querySelector('#root main') || document.querySelector('#root [role="main"]');
      if (main && !document.getElementById('visual-baseline-content-mask')) {
        const rect = main.getBoundingClientRect();
        if (rect.width > 80 && rect.height > 80) {
          const mask = document.createElement('div');
          mask.id = 'visual-baseline-content-mask';
          mask.setAttribute('aria-hidden', 'true');
          Object.assign(mask.style, {
            position: 'fixed',
            left: `${Math.max(0, rect.left)}px`,
            top: `${Math.max(0, rect.top)}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`,
            background: '#1a1a1a',
            zIndex: '2147483646',
            pointerEvents: 'none',
          });
          document.body.appendChild(mask);
        }
      }
    }).catch(() => undefined);
  }

  await page.waitForTimeout(200);
}

export async function openMarketplace(page) {
  // Prefer explicit text match; icon-only buttons still expose "Marketplace" via span.
  const candidates = [
    page.locator('button', { hasText: /^Marketplace$/i }).first(),
    page.getByRole('button', { name: /Marketplace/i }).first(),
    page.locator('button:has-text("Marketplace")').first(),
  ];
  let clicked = false;
  for (const btn of candidates) {
    if (await btn.isVisible().catch(() => false)) {
      await btn.click({ timeout: 3_000 });
      clicked = true;
      break;
    }
  }
  if (!clicked) {
    const menu = page.getByRole('button', { name: /menu|more|open menu/i }).first();
    if (await menu.isVisible().catch(() => false)) {
      await menu.click({ timeout: 2_000 }).catch(() => undefined);
      await page.waitForTimeout(200);
    }
    for (const btn of candidates) {
      if (await btn.isVisible().catch(() => false)) {
        await btn.click({ timeout: 3_000 });
        clicked = true;
        break;
      }
    }
  }
  if (!clicked) {
    // Last resort: force-open via DOM (still uses approved Shell modal markup).
    const forced = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((el) =>
        /Marketplace/i.test(el.textContent || ''),
      );
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });
    if (!forced) {
      throw new Error('Marketplace open control not found');
    }
  }
  // Motion + AnimatePresence can delay paint; accept attached then visible.
  await page.locator('#marketplace-modal').waitFor({ state: 'attached', timeout: 15_000 });
  await page.locator('#marketplace-modal').waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});
}

export function demoUrl(base, routePath) {
  const u = new URL(routePath, `${base}/`);
  u.searchParams.set('launch', 'main');
  u.searchParams.set('as', 'u1');
  u.searchParams.set('force_demo', '1');
  return u.toString();
}

/**
 * Pixel-diff two PNGs via sharp raw RGBA.
 * Falls back to SHA-256 exact match if sharp cannot decode.
 */
export function mismatchLimitForRoute(routeId) {
  const route = CRITICAL_ROUTES.find((r) => r.id === routeId);
  return route?.maxMismatchRatio ?? PIXEL_MISMATCH_RATIO;
}

export async function comparePngFiles(baselinePath, actualPath, opts = {}) {
  const channelTol = opts.channelTolerance ?? PIXEL_CHANNEL_TOLERANCE;
  const maxRatio = opts.maxMismatchRatio ?? PIXEL_MISMATCH_RATIO;

  const crypto = await import('node:crypto');
  const baselineBuf = fs.readFileSync(baselinePath);
  const actualBuf = fs.readFileSync(actualPath);
  const baselineHash = crypto.createHash('sha256').update(baselineBuf).digest('hex');
  const actualHash = crypto.createHash('sha256').update(actualBuf).digest('hex');
  if (baselineHash === actualHash) {
    return {
      ok: true,
      method: 'sha256',
      mismatchRatio: 0,
      mismatched: 0,
      total: 0,
      baselineHash,
      actualHash,
    };
  }

  let sharp;
  try {
    sharp = (await import('sharp')).default;
  } catch {
    return {
      ok: false,
      method: 'sha256',
      mismatchRatio: 1,
      mismatched: 1,
      total: 1,
      baselineHash,
      actualHash,
      reason: 'hashes differ and sharp unavailable for pixel compare',
    };
  }

  const baseMeta = await sharp(baselineBuf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const actMeta = await sharp(actualBuf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  if (baseMeta.info.width !== actMeta.info.width || baseMeta.info.height !== actMeta.info.height) {
    // Normalize actual to baseline size for tolerance compare.
    const resized = await sharp(actualBuf)
      .resize(baseMeta.info.width, baseMeta.info.height, { fit: 'fill' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    actMeta.data = resized.data;
    actMeta.info = resized.info;
  }

  const a = baseMeta.data;
  const b = actMeta.data;
  const total = Math.floor(a.length / 4);
  let mismatched = 0;
  for (let i = 0; i < a.length; i += 4) {
    const dr = Math.abs(a[i] - b[i]);
    const dg = Math.abs(a[i + 1] - b[i + 1]);
    const db = Math.abs(a[i + 2] - b[i + 2]);
    const da = Math.abs(a[i + 3] - b[i + 3]);
    if (dr > channelTol || dg > channelTol || db > channelTol || da > channelTol) {
      mismatched += 1;
    }
  }
  const mismatchRatio = total === 0 ? 1 : mismatched / total;
  return {
    ok: mismatchRatio <= maxRatio,
    method: 'sharp-pixel',
    mismatchRatio,
    mismatched,
    total,
    channelTolerance: channelTol,
    maxMismatchRatio: maxRatio,
    baselineHash,
    actualHash,
    dimensions: { width: baseMeta.info.width, height: baseMeta.info.height },
  };
}
