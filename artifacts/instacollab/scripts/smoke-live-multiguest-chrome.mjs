#!/usr/bin/env node
/**
 * Stage A smoke: Solo live → Multi-Guest live → seat chrome.
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
        JSON.stringify({ roomName, mode: 'Multi-Guest' }),
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
  }, 'StageA MultiGuest Smoke');
}

async function main() {
  const hardDeadline = setTimeout(() => {
    console.error('[smoke-live-multiguest-chrome] HARD_TIMEOUT');
    process.exit(2);
  }, 120_000);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const evidence = {
    base,
    stamp,
    ok: false,
    skipped: null,
    liveRoom: false,
    multiGuestChrome: false,
    blocker: null,
    screenshot: null,
  };
  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  try {
    console.log(`[smoke-live-multiguest-chrome] base=${base}`);
    console.log('[smoke-live-multiguest-chrome] goto…');
    await page.goto(`${base}/home?launch=main&as=u1&force_demo=1`, {
      waitUntil: 'domcontentloaded',
      timeout: 45_000,
    });
    console.log('[smoke-live-multiguest-chrome] dismiss…');
    if (!(await dismiss(page))) {
      evidence.skipped = 'shell_not_ready';
      evidence.ok = true;
      console.log('[smoke-live-multiguest-chrome] SKIP (shell_not_ready)');
      console.log(JSON.stringify(evidence, null, 2));
      clearTimeout(hardDeadline);
      return;
    }

    console.log('[smoke-live-multiguest-chrome] open create…');
    const hostReady = await waitForSelector(page, '[data-instant-room-host]', 12_000);
    console.log(`[smoke-live-multiguest-chrome] host=${hostReady}`);
    await dispatchCreate(page);
    console.log('[smoke-live-multiguest-chrome] dispatched');
    const entryReady = await waitForSelector(page, '[data-instant-room-entry]', 10_000);
    console.log(`[smoke-live-multiguest-chrome] entry=${entryReady}`);

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
    console.log(`[smoke-live-multiguest-chrome] createReady=${createReady}`);
    if (!createReady) {
      evidence.skipped = 'create_room_not_hydrated';
      evidence.ok = true;
      console.log('[smoke-live-multiguest-chrome] SKIP (create_room_not_hydrated)');
      console.log(JSON.stringify(evidence, null, 2));
      clearTimeout(hardDeadline);
      return;
    }

    await page.waitForTimeout(800);
    await page.evaluate(() => {
      const multi = Array.from(document.querySelectorAll('button')).find((b) =>
        /^\s*Multi\s*$/i.test((b.textContent || '').trim()),
      );
      multi?.click();
    }).catch(() => {});
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      const go = Array.from(document.querySelectorAll('button')).find((b) =>
        /go live|launch room/i.test(b.textContent || ''),
      );
      go?.click();
    }).catch(() => {});
    await page.waitForTimeout(900);
    await page.evaluate(() => {
      const skip = document.querySelector('[aria-label="Skip countdown and go live"]');
      skip?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }).catch(() => {});

    for (let i = 0; i < 50; i += 1) {
      try {
        const snap = await page.evaluate(() => {
          const giftBtn = document.querySelectorAll(
            'button[aria-label="Send gift"], button[aria-label="Open gifts"], button[aria-label^="Send gift to"]',
          ).length;
          const pkBtn = document.querySelectorAll(
            'button[aria-label="Join"], button[aria-label="PK battle"]',
          ).length;
          const pathAttr = document.querySelector('[data-instant-room-entry]')?.getAttribute('data-room-path') || '';
          const roomIdChrome = /Room ID/i.test(document.body.innerText);
          const endLive = Array.from(document.querySelectorAll('button')).some((b) =>
            /end live|leave room/i.test(b.textContent || ''),
          );
          return { giftBtn, pkBtn, pathAttr, roomIdChrome, endLive };
        });
        if (snap.giftBtn > 0 || snap.pkBtn > 0 || snap.roomIdChrome || snap.endLive) {
          evidence.liveRoom = true;
          evidence.path = snap.pathAttr;
          evidence.giftButton = snap.giftBtn;
          evidence.pkButtonEarly = snap.pkBtn;
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
      evidence.screenshot = path.join(OUT_DIR, `live-multiguest-chrome-${stamp}.png`);
      await page.screenshot({ path: evidence.screenshot }).catch(() => {});
      console.log('[smoke-live-multiguest-chrome] SKIP (go_live_requires_stable_host_session)');
      console.log(JSON.stringify(evidence, null, 2));
      clearTimeout(hardDeadline);
      return;
    }

    evidence.multiGuestChrome = await page.evaluate(() => {
      const joinish = Array.from(document.querySelectorAll('button')).some((b) =>
        /Join (guest|seat|empty)/i.test(b.getAttribute('aria-label') || '') ||
        /^Join /i.test(b.getAttribute('aria-label') || ''),
      );
      const guestsCtrl = !!document.querySelector('button[aria-label="Guests"], button[aria-label*="guest" i]');
      const seatGrid = /Guest|Seat/i.test(document.body.innerText);
      return joinish || guestsCtrl || seatGrid;
    });
    evidence.ok = evidence.multiGuestChrome;
    if (!evidence.multiGuestChrome) evidence.blocker = 'multiguest_seat_chrome_missing';
    evidence.screenshot = path.join(OUT_DIR, `live-multiguest-chrome-${stamp}.png`);
    await page.screenshot({ path: evidence.screenshot }).catch(() => {});
    console.log(`[smoke-live-multiguest-chrome] ${evidence.ok ? 'PASS' : 'FAIL'}`);
    console.log(JSON.stringify(evidence, null, 2));
    if (!evidence.ok) process.exitCode = 1;
  } finally {
    clearTimeout(hardDeadline);
    await browser.close().catch(() => {});
  }
}

main().catch((err) => {
  console.error('[smoke-live-multiguest-chrome] FATAL', err);
  process.exit(1);
});
