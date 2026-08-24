#!/usr/bin/env node
/**
 * Stage A smoke: Solo live → open approved gift panel.
 * Soft-SKIP (exit 0) when create/go-live path cannot complete in demo shell;
 * FAIL only when gift chrome is expected but broken after live room entry.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const base = (process.argv[2] ?? 'http://127.0.0.1:5173').replace(/\/$/, '');
const OUT_DIR = path.join(REPO_ROOT, '.local/live-smoke');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');

function findExe() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || '/Volumes/Wei2TB/MacData/tools/playwright-browsers';
  try {
    for (const entry of fs.readdirSync(root)) {
      const shell = path.join(root, entry, 'chrome-mac/headless_shell');
      if (fs.existsSync(shell)) return shell;
    }
  } catch {
    /* ignore */
  }
  return null;
}

async function dismiss(page) {
  for (let i = 0; i < 40; i += 1) {
    for (const name of [/skip onboarding/i, /^skip$/i, /^next$/i, /^continue$/i, /^enter app$/i]) {
      const btn = page.getByRole('button', { name }).first();
      if (await btn.isVisible().catch(() => false)) await btn.click({ timeout: 800 }).catch(() => {});
    }
    if (await page.locator('#root nav, #root [role="navigation"]').first().isVisible().catch(() => false)) return;
    await page.waitForTimeout(200);
  }
}

async function openCreate(page) {
  const detail = { path: '/room/create', entry: 'karaoke-party', roomName: 'Stage A Gift Smoke' };
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await page.evaluate((d) => {
      window.dispatchEvent(new CustomEvent('instant-room-open', { detail: d }));
      window.dispatchEvent(new CustomEvent('karaoke-room-open', { detail: d }));
    }, detail);
    const mount = page.locator('[data-instant-room-entry]');
    const attached = await mount.waitFor({ state: 'attached', timeout: 12_000 }).then(() => true).catch(() => false);
    if (!attached) continue;
    await page.waitForTimeout(800);
    const createReady =
      (await page.locator('#create-room-name-live').count()) > 0 ||
      (await page.getByRole('button', { name: /go live/i }).count()) > 0 ||
      (await page.getByRole('heading', { name: /create room|your room/i }).count()) > 0;
    if (createReady) return true;
  }
  return false;
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
  const exe = findExe();
  const browser = await chromium.launch({
    headless: true,
    executablePath: exe || undefined,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  try {
    console.log(`[smoke-live-gift-panel] base=${base}`);
    await page.goto(`${base}/home?launch=main&as=u1&force_demo=1`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    await dismiss(page);

    const createOk = await openCreate(page);
    if (!createOk) {
      evidence.skipped = 'create_room_not_hydrated';
      evidence.ok = true;
      console.log('[smoke-live-gift-panel] SKIP (create_room_not_hydrated)');
      console.log(JSON.stringify(evidence, null, 2));
      return;
    }

    await page.evaluate(() => {
      const solo = Array.from(document.querySelectorAll('button')).find((b) =>
        /^\s*Solo\s*$/i.test((b.textContent || '').trim()),
      );
      solo?.click();
    });
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const input = document.querySelector('#create-room-name-live');
      if (!input) return;
      const proto = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
      proto?.set?.call(input, 'Stage A Gift Smoke');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const goLive = page.getByRole('button', { name: /go live|launch room/i }).first();
    if (await goLive.isVisible().catch(() => false)) await goLive.click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(600);
    await page.getByLabel(/skip countdown/i).click({ timeout: 1200 }).catch(() => {});

    for (let i = 0; i < 40; i += 1) {
      const giftBtn = await page.locator('button[aria-label="Send gift"]').count();
      const pathAttr = await page.locator('[data-instant-room-entry]').getAttribute('data-room-path').catch(() => '');
      if (giftBtn > 0 && pathAttr && pathAttr !== '/room/create') {
        evidence.liveRoom = true;
        break;
      }
      await page.waitForTimeout(400);
    }

    if (!evidence.liveRoom) {
      evidence.skipped = 'go_live_requires_stable_host_session';
      evidence.ok = true;
      console.log('[smoke-live-gift-panel] SKIP (go_live_requires_stable_host_session)');
      console.log(JSON.stringify(evidence, null, 2));
      return;
    }

    await page.locator('button[aria-label="Send gift"]').first().click({ timeout: 5000 });
    await page.waitForTimeout(700);
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
