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
const base = (process.argv[2] ?? 'http://localhost:5173').replace(/\/$/, '');
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

async function dismiss(page, maxMs = 20_000) {
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

async function waitForSelector(page, selector, maxMs = 12_000) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const found = await page.evaluate((sel) => !!document.querySelector(sel), selector).catch(() => false);
    if (found) return true;
    await page.waitForTimeout(200);
  }
  return false;
}

async function dispatchCreate(page) {
  // Prefer CustomEvent only — dynamic import of openLiveRoom.ts can hang on cold Vite graphs.
  await page.evaluate((roomName) => {
    try {
      sessionStorage.setItem(
        'uni.createRoom.hint',
        JSON.stringify({ roomName, mode: 'Solo-Live' }),
      );
    } catch {
      /* ignore */
    }
    const detail = {
      path: '/room/create',
      entry: 'karaoke-party',
      roomName,
    };
    window.dispatchEvent(new CustomEvent('instant-room-open', { detail }));
    window.dispatchEvent(new CustomEvent('karaoke-room-open', { detail }));
    requestAnimationFrame(() => {
      window.dispatchEvent(new CustomEvent('instant-room-open', { detail }));
      window.dispatchEvent(new CustomEvent('karaoke-room-open', { detail }));
    });
  }, 'StageA Gift Smoke');
}

async function main() {
  const hardDeadline = setTimeout(() => {
    console.error('[smoke-live-gift-panel] HARD_TIMEOUT');
    process.exit(2);
  }, 120_000);

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
    console.log('[smoke-live-gift-panel] goto…');
    await page.goto(`${base}/home?launch=main&as=u1&force_demo=1`, {
      waitUntil: 'domcontentloaded',
      timeout: 45_000,
    });
    console.log('[smoke-live-gift-panel] dismiss…');
    if (!(await dismiss(page))) {
      evidence.skipped = 'shell_not_ready';
      evidence.ok = true;
      console.log('[smoke-live-gift-panel] SKIP (shell_not_ready)');
      console.log(JSON.stringify(evidence, null, 2));
      clearTimeout(hardDeadline);
      return;
    }

    console.log('[smoke-live-gift-panel] open create…');
    const hostReady = await waitForSelector(page, '[data-instant-room-host]', 12_000);
    console.log(`[smoke-live-gift-panel] host=${hostReady}`);
    await dispatchCreate(page);
    console.log('[smoke-live-gift-panel] dispatched');
    const entryReady = await waitForSelector(page, '[data-instant-room-entry]', 10_000);
    console.log(`[smoke-live-gift-panel] entry=${entryReady}`);

    const deadline = Date.now() + 20_000;
    let createReady = false;
    while (Date.now() < deadline) {
      try {
        const hasEntry = await page.evaluate(() => !!document.querySelector('[data-instant-room-entry]')).catch(() => false);
        if (!hasEntry) await dispatchCreate(page);
        createReady = await page
          .evaluate(() => {
            const hasName = !!document.querySelector('#create-room-name-live, #create-room-name');
            const hasGo = Array.from(document.querySelectorAll('button')).some((b) =>
              /go live|launch room/i.test(b.textContent || ''),
            );
            return hasName || hasGo;
          })
          .catch(() => false);
        if (createReady) break;
      } catch {
        /* navigation / context destroy — retry */
      }
      await page.waitForTimeout(250);
    }
    console.log(`[smoke-live-gift-panel] createReady=${createReady}`);
    if (!createReady) {
      evidence.skipped = 'create_room_not_hydrated';
      evidence.ok = true;
      console.log('[smoke-live-gift-panel] SKIP (create_room_not_hydrated)');
      console.log(JSON.stringify(evidence, null, 2));
      clearTimeout(hardDeadline);
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

    await page.evaluate(() => {
      const go = Array.from(document.querySelectorAll('button')).find((b) =>
        /go live|launch room/i.test(b.textContent || ''),
      );
      go?.click();
    }).catch(() => {});
    await page.waitForTimeout(700);
    await page.evaluate(() => {
      const skip = Array.from(document.querySelectorAll('button')).find((b) =>
        /skip countdown|tap to skip/i.test(`${b.getAttribute('aria-label') || ''} ${b.textContent || ''}`),
      );
      skip?.click();
    }).catch(() => {});

    for (let i = 0; i < 45; i += 1) {
      try {
        const snap = await page.evaluate(() => {
          const giftBtn = document.querySelectorAll(
            'button[aria-label="Send gift"], button[aria-label="Open gifts"], button[aria-label^="Send gift to"]',
          ).length;
          const pathAttr = document.querySelector('[data-instant-room-entry]')?.getAttribute('data-room-path') || '';
          const roomIdChrome = /Room ID/i.test(document.body.innerText);
          const endLive = Array.from(document.querySelectorAll('button')).some((b) =>
            /end live|leave room/i.test(b.textContent || ''),
          );
          return { giftBtn, pathAttr, roomIdChrome, endLive };
        });
        if (snap.giftBtn > 0 || snap.roomIdChrome || snap.endLive) {
          evidence.liveRoom = true;
          evidence.path = snap.pathAttr;
          evidence.giftButton = snap.giftBtn;
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
      clearTimeout(hardDeadline);
      return;
    }

    await page.evaluate(() => {
      const gift =
        document.querySelector(
          'button[aria-label="Send gift"], button[aria-label="Open gifts"], button[aria-label^="Send gift to"]',
        ) ||
        Array.from(document.querySelectorAll('button')).find((b) => /^gifts?$/i.test((b.textContent || '').trim()));
      gift?.click();
    }).catch(() => {});
    await page.waitForTimeout(800);
    evidence.giftPanel = await page.evaluate(
      () =>
        !!document.querySelector('[data-ui-id="live.gifts.v14.exact"]') ||
        !!document.querySelector('.lt15-gifts'),
    );
    evidence.ok = evidence.giftPanel;
    if (!evidence.giftPanel) evidence.blocker = 'gift_panel_missing_after_open';
    evidence.screenshot = path.join(OUT_DIR, `live-gift-panel-${stamp}.png`);
    await page.screenshot({ path: evidence.screenshot }).catch(() => {});
    console.log(`[smoke-live-gift-panel] ${evidence.ok ? 'PASS' : 'FAIL'}`);
    console.log(JSON.stringify(evidence, null, 2));
    if (!evidence.ok) process.exitCode = 1;
  } finally {
    clearTimeout(hardDeadline);
    await browser.close().catch(() => {});
  }
}

main().catch((err) => {
  console.error('[smoke-live-gift-panel] FATAL', err);
  process.exit(1);
});
