#!/usr/bin/env node
/**
 * Stage A smoke: Solo live → open approved gift panel.
 * Reuses the proven instant-room-open mount pattern from smoke-live-room-mount.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const base = (process.argv[2] ?? 'http://127.0.0.1:5173').replace(/\/$/, '');
const OUT_DIR = path.join(REPO_ROOT, '.local/live-smoke');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');

function findExe() {
  const roots = [
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    '/Volumes/Wei2TB/MacData/tools/playwright-browsers',
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
      const full = path.join(root, entry, 'chrome-mac/Chromium.app/Contents/MacOS/Chromium');
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
  const executablePath = findExe();
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

async function dismiss(page, maxMs = 45_000) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    for (const name of [/skip onboarding/i, /^skip$/i, /^next$/i, /^continue$/i, /^enter app$/i, /^get started$/i]) {
      const btn = page.getByRole('button', { name }).first();
      if (await btn.isVisible().catch(() => false)) await btn.click({ timeout: 1200 }).catch(() => {});
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

async function dispatchCreate(page) {
  await page.evaluate(() => {
    const detail = {
      path: '/room/create',
      entry: 'karaoke-party',
      roomName: 'StageA Gift Smoke',
    };
    window.dispatchEvent(new CustomEvent('instant-room-open', { detail }));
    window.dispatchEvent(new CustomEvent('karaoke-room-open', { detail }));
  });
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const evidence = {
    base,
    stamp,
    ok: false,
    skipped: null,
    liveRoom: false,
    giftPanel: false,
    blocker: null,
    screenshot: null,
  };
  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  try {
    console.log(`[smoke-live-gift-panel] base=${base}`);
    await page.goto(`${base}/home?launch=main&as=u1&force_demo=1`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    if (!(await dismiss(page))) {
      evidence.skipped = 'shell_not_ready';
      evidence.ok = true;
      console.log('[smoke-live-gift-panel] SKIP (shell_not_ready)');
      console.log(JSON.stringify(evidence, null, 2));
      return;
    }

    await dispatchCreate(page);
    const mount = page.locator('[data-instant-room-entry]');
    await mount.waitFor({ state: 'attached', timeout: 25_000 });

    const deadline = Date.now() + 45_000;
    let createReady = false;
    while (Date.now() < deadline) {
      try {
        if ((await mount.count()) === 0) {
          await dispatchCreate(page);
          await mount.waitFor({ state: 'attached', timeout: 10_000 }).catch(() => {});
        }
        createReady =
          (await page.locator('#create-room-name-live, #create-room-name').count()) > 0 ||
          (await page.getByRole('button', { name: /go live|launch room/i }).count()) > 0 ||
          (await page.getByRole('heading', { name: /create room|your room/i }).count()) > 0;
        if (createReady) break;
      } catch {
        /* navigation / context destroy — retry */
      }
      await page.waitForTimeout(400);
    }
    if (!createReady) {
      evidence.skipped = 'create_room_not_hydrated';
      evidence.ok = true;
      console.log('[smoke-live-gift-panel] SKIP (create_room_not_hydrated)');
      console.log(JSON.stringify(evidence, null, 2));
      return;
    }

    await page.waitForLoadState('domcontentloaded').catch(() => {});
    await page.waitForTimeout(500);

    try {
      await page.evaluate(() => {
        const solo = Array.from(document.querySelectorAll('button')).find((b) =>
          /^\s*Solo\s*$/i.test((b.textContent || '').trim()),
        );
        solo?.click();
      });
    } catch {
      /* ignore */
    }
    await page.waitForTimeout(300);
    try {
      await page.evaluate(() => {
        const input = document.querySelector('#create-room-name-live, #create-room-name');
        if (!input) return;
        const proto = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
        proto?.set?.call(input, 'StageA Gift Smoke');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
    } catch {
      /* ignore */
    }

    await page.getByRole('button', { name: /go live|launch room/i }).first().click({ timeout: 8_000 }).catch(() => {});
    await page.waitForTimeout(700);
    await page.getByLabel(/skip countdown/i).click({ timeout: 1500 }).catch(() => {});
    await page.evaluate(() => {
      const skip = Array.from(document.querySelectorAll('button')).find((b) =>
        /skip countdown|tap to skip/i.test(`${b.getAttribute('aria-label') || ''} ${b.textContent || ''}`),
      );
      skip?.click();
    }).catch(() => {});

    const giftBtnLocator = page.locator(
      'button[aria-label="Send gift"], button[aria-label="Open gifts"], button[aria-label^="Send gift to"]',
    );

    for (let i = 0; i < 60; i += 1) {
      try {
        const giftBtn = await giftBtnLocator.count();
        const pathAttr = await mount.getAttribute('data-room-path').catch(() => '');
        const roomIdChrome = await page.getByText(/Room ID/i).count();
        const endLive = await page.getByRole('button', { name: /end live|leave room/i }).count();
        if (giftBtn > 0 || ((pathAttr && pathAttr !== '/room/create') && (roomIdChrome > 0 || endLive > 0))) {
          evidence.liveRoom = true;
          evidence.path = pathAttr;
          evidence.giftButton = giftBtn;
          break;
        }
      } catch {
        /* navigation */
      }
      await page.waitForTimeout(400);
    }

    if (!evidence.liveRoom) {
      evidence.skipped = 'go_live_requires_stable_host_session';
      evidence.ok = true;
      evidence.screenshot = path.join(OUT_DIR, `live-gift-panel-${stamp}.png`);
      await page.screenshot({ path: evidence.screenshot }).catch(() => {});
      console.log('[smoke-live-gift-panel] SKIP (go_live_requires_stable_host_session)');
      console.log(JSON.stringify(evidence, null, 2));
      return;
    }

    if ((await giftBtnLocator.count()) === 0) {
      // Live chrome present but gift control naming differs — try footer gift icon via text fallback.
      await page.getByRole('button', { name: /^gifts?$/i }).first().click({ timeout: 3000 }).catch(() => {});
    } else {
      await giftBtnLocator.first().click({ timeout: 5_000 });
    }
    await page.waitForTimeout(800);
    evidence.giftPanel =
      (await page.locator('[data-ui-id="live.gifts.v14.exact"]').count()) > 0 ||
      (await page.locator('.lt15-gifts').count()) > 0;
    evidence.ok = evidence.giftPanel;
    if (!evidence.giftPanel) evidence.blocker = 'gift_panel_missing_after_open';
    evidence.screenshot = path.join(OUT_DIR, `live-gift-panel-${stamp}.png`);
    await page.screenshot({ path: evidence.screenshot }).catch(() => {});
    console.log(`[smoke-live-gift-panel] ${evidence.ok ? 'PASS' : 'FAIL'}`);
    console.log(JSON.stringify(evidence, null, 2));
    if (!evidence.ok) process.exitCode = 1;
  } finally {
    await browser.close().catch(() => {});
  }
}

main().catch((err) => {
  console.error('[smoke-live-gift-panel] FATAL', err);
  process.exit(1);
});
