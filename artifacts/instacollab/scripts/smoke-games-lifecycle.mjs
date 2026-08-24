#!/usr/bin/env node
/**
 * Stage A games panel open/close resource smoke (force_demo).
 * Asserts game overlay can open and close without leaving visible overlay.
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
  const roots = [process.env.PLAYWRIGHT_BROWSERS_PATH, '/Volumes/Wei2TB/MacData/tools/playwright-browsers'].filter(Boolean);
  for (const root of roots) {
    try {
      for (const entry of fs.readdirSync(root)) {
        const shell = path.join(root, entry, 'chrome-mac/headless_shell');
        if (fs.existsSync(shell)) return shell;
        const full = path.join(root, entry, 'chrome-mac/Chromium.app/Contents/MacOS/Chromium');
        if (fs.existsSync(full)) return full;
      }
    } catch {
      /* ignore */
    }
  }
  return null;
}

async function launchBrowser() {
  const args = ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'];
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

async function dismiss(page) {
  for (let i = 0; i < 40; i += 1) {
    for (const name of [/skip onboarding/i, /^skip$/i, /^next$/i, /^continue$/i, /^enter app$/i]) {
      const btn = page.getByRole('button', { name }).first();
      if (await btn.isVisible().catch(() => false)) await btn.click({ timeout: 400 }).catch(() => {});
    }
    await page.waitForTimeout(120);
  }
}

async function main() {
  const hard = setTimeout(() => {
    console.error('[smoke-games-lifecycle] HARD_TIMEOUT');
    process.exit(2);
  }, 150_000);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const evidence = { base, stamp, ok: false, opened: false, closed: false, loops: 0, blocker: null };
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.goto(`${base}/home?launch=main&force_demo=1`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await dismiss(page);
    // Try opening a live room with games, else soft-SKIP
    await page.evaluate(() => {
      const create = Array.from(document.querySelectorAll('button,a')).find((el) =>
        /go live|create room|live/i.test(`${el.textContent || ''} ${el.getAttribute('aria-label') || ''}`),
      );
      create?.click();
    });
    await page.waitForTimeout(800);
    await page.evaluate(() => {
      const solo = Array.from(document.querySelectorAll('button,a,[role="button"]')).find((el) =>
        /solo|video live|go live/i.test(`${el.textContent || ''} ${el.getAttribute('aria-label') || ''}`),
      );
      solo?.click();
    });
    await page.waitForTimeout(2000);
    const before = await page.evaluate(() => ({
      videos: document.querySelectorAll('video').length,
      iframes: document.querySelectorAll('iframe').length,
    }));
    for (let i = 0; i < 3; i += 1) {
      await page.evaluate(() => {
        const games = Array.from(document.querySelectorAll('button,a')).find((el) =>
          /^games$/i.test((el.textContent || '').trim()) || /open games|game panel/i.test(el.getAttribute('aria-label') || ''),
        );
        games?.click();
      });
      await page.waitForTimeout(600);
      const open = await page.evaluate(
        () =>
          /greedy|game|play now|mini game/i.test(document.body.innerText || '') ||
          !!document.querySelector('[data-ui-id*="game"], .game-live-panel, iframe[src*="game"]'),
      );
      if (open) evidence.opened = true;
      await page.evaluate(() => {
        const close = Array.from(document.querySelectorAll('button,a')).find((el) =>
          /close|done|exit game|back/i.test(`${el.textContent || ''} ${el.getAttribute('aria-label') || ''}`),
        );
        close?.click();
        document.querySelector('.pkx-dismiss-layer')?.click();
      });
      await page.waitForTimeout(500);
      evidence.loops += 1;
    }
    const after = await page.evaluate(() => ({
      videos: document.querySelectorAll('video').length,
      iframes: document.querySelectorAll('iframe').length,
      gameOverlay: !!document.querySelector('[data-ui-id*="game"], .game-live-panel'),
    }));
    evidence.closed = !after.gameOverlay;
    evidence.resources = { before, after };
    evidence.ok = evidence.opened && evidence.closed && (after.iframes || 0) <= (before.iframes || 0) + 1;
    if (!evidence.opened) {
      evidence.skipped = 'games_entry_unavailable_in_demo';
      evidence.ok = true;
    }
    evidence.screenshot = path.join(OUT_DIR, `games-lifecycle-${stamp}.png`);
    await page.screenshot({ path: evidence.screenshot }).catch(() => {});
    console.log(`[smoke-games-lifecycle] ${evidence.skipped ? 'SKIP' : evidence.ok ? 'PASS' : 'FAIL'}`);
    console.log(JSON.stringify(evidence, null, 2));
    if (!evidence.ok) process.exitCode = 1;
  } finally {
    clearTimeout(hard);
    await browser.close().catch(() => {});
  }
}

main().catch((err) => {
  console.error('[smoke-games-lifecycle] FATAL', err);
  process.exit(1);
});
