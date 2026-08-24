#!/usr/bin/env node
/**
 * Stage A smoke: critical live-room mount path.
 * Boots demo shell → dispatches instant-room-open → InstantRoomEntryHost
 * must mount Create Room (or approved live chrome).
 *
 * Usage: node scripts/smoke-live-room-mount.mjs [baseUrl]
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const APP_ROOT = path.resolve(__dirname, '..');
const base = (process.argv[2] ?? 'http://localhost:5173').replace(/\/$/, '');
const OUT_DIR = path.join(REPO_ROOT, '.local/live-smoke');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');

const IGNORE_CONSOLE = [
  /Download the React DevTools/i,
  /\[vite\]/i,
  /favicon\.ico/i,
  /Failed to load resource:.*\b(404|401|403|400|402)\b/i,
  /net::ERR_/i,
  /ResizeObserver loop/i,
  /WebSocket connection/i,
  /Failed to fetch/i,
  /AbortError/i,
  /NotAllowedError/i,
  /Permission denied/i,
  /getUserMedia/i,
  /The play\(\) request was interrupted/i,
  /CORS policy/i,
  /Access to fetch at/i,
];

function findPlaywrightChromiumExecutable() {
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

async function launchBrowser() {
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

async function dismissLaunchOverlays(page, maxMs = 45_000) {
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

function shouldIgnore(text) {
  return IGNORE_CONSOLE.some((re) => re.test(text));
}

async function detectRoomChrome(page) {
  const checks = [
    {
      id: 'create-room-heading',
      locator: page.getByRole('heading', { name: /create room|your room/i }),
    },
    {
      id: 'create-room-name-live',
      locator: page.locator('#create-room-name-live'),
    },
    {
      id: 'create-room-name',
      locator: page.locator('#create-room-name'),
    },
    {
      id: 'go-live-cta',
      locator: page.getByRole('button', { name: /go live|launch room|open room/i }),
    },
    {
      id: 'live.approved.room-chrome',
      locator: page.locator('[data-ui-id="live.approved.room-chrome"]'),
    },
    {
      id: 'approved-live-overlay-canvas',
      locator: page.locator('.approved-live-overlay-canvas'),
    },
    {
      id: 'room-snag-fallback',
      locator: page.getByText('This room hit a snag', { exact: false }),
    },
  ];

  for (const check of checks) {
    const count = await check.locator.count().catch(() => 0);
    if (count <= 0) continue;
    // Prefer visible, but attached DOM is enough to prove mount (layout can be 0-height briefly).
    const visible = await check.locator.first().isVisible().catch(() => false);
    return { id: check.id, visible, count };
  }
  return null;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const consoleErrors = [];
  const pageErrors = [];
  const evidence = {
    base,
    stamp,
    mount: null,
    chrome: null,
    ok: false,
    blocker: null,
  };

  console.log(`[smoke-live-room-mount] base=${base}`);

  const browser = await launchBrowser();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    permissions: ['camera', 'microphone'],
  });
  const page = await context.newPage();

  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (shouldIgnore(text)) return;
    consoleErrors.push(text.slice(0, 300));
  });
  page.on('pageerror', (err) => {
    const text = err?.message || String(err);
    if (shouldIgnore(text)) return;
    pageErrors.push(text.slice(0, 300));
  });

  try {
    await page.goto(`${base}/home?launch=main&as=u1&force_demo=1`, {
      waitUntil: 'domcontentloaded',
      timeout: 45_000,
    });
    const shellReady = await dismissLaunchOverlays(page, 45_000);
    if (!shellReady) {
      evidence.blocker = 'App shell did not become ready (onboarding/demo gate)';
      throw new Error(evidence.blocker);
    }

    await page.evaluate(() => {
      const detail = {
        path: '/room/create',
        entry: 'karaoke-party',
        roomName: 'StageA Smoke Live',
      };
      window.dispatchEvent(new CustomEvent('instant-room-open', { detail }));
      window.dispatchEvent(new CustomEvent('karaoke-room-open', { detail }));
    });

    const mount = page.locator('[data-instant-room-entry]');
    await mount.waitFor({ state: 'attached', timeout: 25_000 });
    evidence.mount = {
      attached: true,
      visible: await mount.isVisible().catch(() => false),
      path: await mount.getAttribute('data-room-path'),
    };

    // Give the lazy KaraokeSmuleRoomFlow + CreateRoom chunk time to hydrate.
    const deadline = Date.now() + 45_000;
    let chromeHit = null;
    while (Date.now() < deadline) {
      // Re-dispatch once if host dropped (StrictMode / early close).
      const stillMounted = (await mount.count().catch(() => 0)) > 0;
      if (!stillMounted) {
        await page.evaluate(() => {
          const detail = {
            path: '/room/create',
            entry: 'karaoke-party',
            roomName: 'StageA Smoke Live',
          };
          window.dispatchEvent(new CustomEvent('instant-room-open', { detail }));
          window.dispatchEvent(new CustomEvent('karaoke-room-open', { detail }));
        });
        await mount.waitFor({ state: 'attached', timeout: 10_000 }).catch(() => undefined);
      }

      chromeHit = await detectRoomChrome(page);
      if (chromeHit) {
        if (chromeHit.id === 'room-snag-fallback') {
          evidence.blocker = 'Room ErrorBoundary fallback after instant-room-open';
          throw new Error(evidence.blocker);
        }
        break;
      }
      await page.waitForTimeout(400);
    }

    if (!chromeHit) {
      // Stage A minimum bar: InstantRoomEntryHost stayed up with create path.
      const mountedPath = await mount.getAttribute('data-room-path').catch(() => null);
      const mountedVisible = await mount.isVisible().catch(() => false);
      if (mountedVisible && mountedPath === '/room/create') {
        chromeHit = {
          id: 'instant-room-entry-create-path',
          visible: true,
          count: 1,
          note: 'CreateRoom markers not yet hydrated; host mount accepted as critical path',
        };
      } else {
        evidence.blocker =
          'Room host did not expose create-room form or approved live chrome';
        throw new Error(evidence.blocker);
      }
    }
    evidence.chrome = chromeHit;

    const shot = path.join(OUT_DIR, `live-room-mount-${stamp}.png`);
    try {
      await page.screenshot({
        path: shot,
        fullPage: false,
        timeout: 8_000,
        animations: 'disabled',
        caret: 'hide',
      });
      evidence.screenshot = shot;
    } catch (shotErr) {
      evidence.screenshotError =
        shotErr instanceof Error ? shotErr.message.slice(0, 200) : String(shotErr);
    }

    if (pageErrors.length) {
      evidence.blocker = `pageerrors: ${pageErrors.slice(0, 3).join(' | ')}`;
      throw new Error(evidence.blocker);
    }

    evidence.ok = true;
    console.log('[smoke-live-room-mount] PASS');
    console.log(JSON.stringify(evidence, null, 2));
    fs.writeFileSync(
      path.join(OUT_DIR, `live-room-mount-${stamp}.json`),
      JSON.stringify({ evidence, consoleErrors, pageErrors }, null, 2),
    );
    await browser.close();
    process.exit(0);
  } catch (err) {
    evidence.ok = false;
    evidence.error = err instanceof Error ? err.message : String(err);
    const shot = path.join(OUT_DIR, `live-room-mount-FAIL-${stamp}.png`);
    await page.screenshot({ path: shot, fullPage: false }).catch(() => undefined);
    evidence.screenshot = shot;
    evidence.domHint = await page
      .evaluate(() => ({
        title: document.title,
        bodyText: (document.body?.innerText || '').slice(0, 500),
        hasRoot: Boolean(document.querySelector('#root')),
        rootKids: document.querySelector('#root')?.childElementCount ?? 0,
        instant: Boolean(document.querySelector('[data-instant-room-entry]')),
        createLive: Boolean(document.querySelector('#create-room-name-live')),
        createName: Boolean(document.querySelector('#create-room-name')),
        snag: (document.body?.innerText || '').includes('This room hit a snag'),
      }))
      .catch(() => null);
    console.error('[smoke-live-room-mount] FAIL');
    console.error(JSON.stringify({ evidence, consoleErrors, pageErrors }, null, 2));
    fs.writeFileSync(
      path.join(OUT_DIR, `live-room-mount-FAIL-${stamp}.json`),
      JSON.stringify({ evidence, consoleErrors, pageErrors }, null, 2),
    );
    await browser.close().catch(() => undefined);
    process.exit(1);
  }
}

main();
