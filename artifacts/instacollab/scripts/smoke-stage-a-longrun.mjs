#!/usr/bin/env node
/**
 * Bounded Stage A long-run stress (not infinite).
 * Cycles Reels/messages/calls/live chrome rapidly and samples resource counters.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const base = (process.argv[2] ?? 'http://localhost:5173').replace(/\/$/, '');
const CYCLES = Math.min(12, Math.max(3, Number(process.env.STAGE_A_STRESS_CYCLES || 6)));
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
  const executablePath = findExe();
  const args = [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    '--autoplay-policy=no-user-gesture-required',
  ];
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
  for (const name of [/skip onboarding/i, /^skip$/i, /^next$/i, /^continue$/i, /^enter app$/i]) {
    const btn = page.getByRole('button', { name }).first();
    if (await btn.isVisible().catch(() => false)) await btn.click({ timeout: 500 }).catch(() => {});
  }
}

async function sample(page) {
  return page.evaluate(() => {
    const videos = document.querySelectorAll('video').length;
    const canvases = document.querySelectorAll('canvas').length;
    const audio = document.querySelectorAll('audio').length;
    let usedJSHeapSize = null;
    try {
      usedJSHeapSize = performance.memory?.usedJSHeapSize ?? null;
    } catch {
      usedJSHeapSize = null;
    }
    return {
      videos,
      canvases,
      audio,
      usedJSHeapSize,
      overlays: document.querySelectorAll('[data-ui-id*="live.pk"], .pkx-overlay, .u1pk-overlay').length,
    };
  });
}

async function main() {
  const hardDeadline = setTimeout(() => {
    console.error('[smoke-stage-a-longrun] HARD_TIMEOUT');
    process.exit(2);
  }, 180_000);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const evidence = { base, stamp, cycles: CYCLES, ok: false, samples: [], growth: null };
  const browser = await launchBrowser();
  try {
    const page = await (await browser.newContext({ viewport: { width: 1200, height: 860 } })).newPage();
    console.log(`[smoke-stage-a-longrun] base=${base} cycles=${CYCLES}`);
    const routes = ['/home', '/reels', '/messages', '/calls', '/home'];
    for (let i = 0; i < CYCLES; i += 1) {
      const route = routes[i % routes.length];
      await page.goto(`${base}${route}?launch=main&as=u1&force_demo=1`, {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      });
      await dismiss(page);
      await page.waitForTimeout(400);
      // Rapid like / nav taps when present
      await page.evaluate(() => {
        Array.from(document.querySelectorAll('button'))
          .filter((b) => /like|heart|gift|call/i.test(b.getAttribute('aria-label') || b.textContent || ''))
          .slice(0, 3)
          .forEach((b) => b.click());
      });
      evidence.samples.push({ i, route, ...(await sample(page)) });
    }
    const first = evidence.samples[0];
    const last = evidence.samples[evidence.samples.length - 1];
    evidence.growth = {
      videosDelta: (last?.videos ?? 0) - (first?.videos ?? 0),
      canvasesDelta: (last?.canvases ?? 0) - (first?.canvases ?? 0),
      overlaysDelta: (last?.overlays ?? 0) - (first?.overlays ?? 0),
      heapDelta:
        first?.usedJSHeapSize != null && last?.usedJSHeapSize != null
          ? last.usedJSHeapSize - first.usedJSHeapSize
          : null,
    };
    // Soft growth bounds — hard fail only on extreme overlay accumulation
    evidence.ok = (evidence.growth.overlaysDelta ?? 0) < 8 && (evidence.growth.videosDelta ?? 0) < 12;
    evidence.screenshot = path.join(OUT_DIR, `stage-a-longrun-${stamp}.png`);
    await page.screenshot({ path: evidence.screenshot }).catch(() => {});
    console.log(`[smoke-stage-a-longrun] ${evidence.ok ? 'PASS' : 'FAIL'}`);
    console.log(JSON.stringify(evidence, null, 2));
    if (!evidence.ok) process.exitCode = 1;
  } finally {
    clearTimeout(hardDeadline);
    await browser.close().catch(() => {});
  }
}

main().catch((err) => {
  console.error('[smoke-stage-a-longrun] FATAL', err);
  process.exit(1);
});
