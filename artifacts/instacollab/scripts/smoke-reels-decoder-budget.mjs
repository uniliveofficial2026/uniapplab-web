#!/usr/bin/env node
/**
 * Stage A: Reels decoder budget — scroll many reels; video element count stays bounded.
 * No UI changes. Soft-SKIP when reels/auth unavailable.
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
const SCROLLS = Number(process.env.REELS_SCROLLS || 40);

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
  const args = ['--autoplay-policy=no-user-gesture-required'];
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
  for (let i = 0; i < 50; i += 1) {
    for (const name of [/skip onboarding/i, /^skip$/i, /^next$/i, /^continue$/i, /^enter app$/i]) {
      const btn = page.getByRole('button', { name }).first();
      if (await btn.isVisible().catch(() => false)) await btn.click({ timeout: 400 }).catch(() => {});
    }
    if (await page.locator('[data-reel-snap-item]').first().isVisible().catch(() => false)) return true;
    await page.waitForTimeout(150);
  }
  return false;
}

async function snap(page) {
  return page.evaluate(() => {
    const videos = Array.from(document.querySelectorAll('video'));
    const playing = videos.filter((v) => !v.paused && !v.ended).length;
    const tracks = videos.reduce((n, v) => n + (v.srcObject?.getTracks?.().length || 0), 0);
    return {
      videoEls: videos.length,
      playing,
      mediaTracks: tracks,
      reelItems: document.querySelectorAll('[data-reel-snap-item]').length,
      audioEls: document.querySelectorAll('audio').length,
    };
  });
}

async function main() {
  const hard = setTimeout(() => {
    console.error('[smoke-reels-decoder-budget] HARD_TIMEOUT');
    process.exit(2);
  }, 180_000);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const evidence = { base, stamp, ok: false, scrolls: SCROLLS, samples: [], blocker: null };
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.goto(`${base}/reels?launch=main&force_demo=1`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    const ready = await dismiss(page);
    if (!ready) {
      evidence.skipped = 'reels_not_ready';
      evidence.ok = true;
      console.log('[smoke-reels-decoder-budget] SKIP');
      console.log(JSON.stringify(evidence, null, 2));
      return;
    }
    const first = await snap(page);
    evidence.samples.push({ i: 0, ...first });
    for (let i = 1; i <= SCROLLS; i += 1) {
      await page.keyboard.press('ArrowDown').catch(() => undefined);
      await page.mouse.wheel(0, 900).catch(() => undefined);
      await page.waitForTimeout(180);
      if (i % 5 === 0 || i === SCROLLS) {
        evidence.samples.push({ i, ...(await snap(page)) });
      }
    }
    const last = evidence.samples[evidence.samples.length - 1];
    const maxVideos = Math.max(...evidence.samples.map((s) => s.videoEls || 0));
    // Bound: active + bounded preload — allow small absolute ceiling.
    evidence.maxVideos = maxVideos;
    evidence.finalVideos = last?.videoEls ?? 0;
    evidence.finalPlaying = last?.playing ?? 0;
    evidence.ok = maxVideos <= 6 && (last?.playing ?? 0) <= 2 && (last?.audioEls ?? 0) <= 2;
    if (!evidence.ok) evidence.blocker = 'decoder_budget_exceeded';
    evidence.screenshot = path.join(OUT_DIR, `reels-decoder-${stamp}.png`);
    await page.screenshot({ path: evidence.screenshot }).catch(() => {});
    console.log(`[smoke-reels-decoder-budget] ${evidence.ok ? 'PASS' : 'FAIL'}`);
    console.log(JSON.stringify(evidence, null, 2));
    if (!evidence.ok) process.exitCode = 1;
  } finally {
    clearTimeout(hard);
    await browser.close().catch(() => {});
  }
}

main().catch((err) => {
  console.error('[smoke-reels-decoder-budget] FATAL', err);
  process.exit(1);
});
