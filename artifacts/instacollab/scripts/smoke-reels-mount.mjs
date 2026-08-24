#!/usr/bin/env node
/**
 * Stage A smoke: Reels mount + first reel video element when present.
 * Boots demo shell at /reels → [data-reel-snap-item]; prefers <video>.
 * If cloud/poster fallback leaves no <video>, mount still PASS and
 * evidence.video = false (pair with stage-a-mount-contracts for AppNativeVideo).
 *
 * Usage: node scripts/smoke-reels-mount.mjs [baseUrl]
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  REPO_ROOT,
  demoUrl,
  detectAuthGate,
  dismissLaunchOverlays,
  ensureDevServer,
  launchBrowser,
} from './lib/visual-baseline-shared.mjs';

const preferredBase = (process.argv[2] || '').replace(/\/$/, '') || undefined;
const OUT_DIR = path.join(REPO_ROOT, '.local/live-smoke');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const server = await ensureDevServer(preferredBase);
  const { base, stop } = server;
  const evidence = {
    base,
    stamp,
    ok: false,
    mount: null,
    video: null,
    blocker: null,
  };

  console.log(`[smoke-reels-mount] base=${base}`);

  const browser = await launchBrowser();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    permissions: ['camera', 'microphone'],
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (err) => {
    pageErrors.push((err?.message || String(err)).slice(0, 300));
  });

  try {
    await page.goto(demoUrl(base, '/reels'), {
      waitUntil: 'domcontentloaded',
      timeout: 45_000,
    });
    const shellReady = await dismissLaunchOverlays(page, 45_000);
    const reelEarly = page.locator('[data-reel-snap-item]').first();
    const reelAttachedEarly = await reelEarly
      .waitFor({ state: 'attached', timeout: 8_000 })
      .then(() => true)
      .catch(() => false);
    if (!shellReady && !reelAttachedEarly) {
      if (await detectAuthGate(page)) {
        evidence.ok = true;
        evidence.skipped = 'auth_gated';
        console.log('[smoke-reels-mount] SKIP (auth-gated)');
        console.log(JSON.stringify(evidence, null, 2));
        await browser.close();
        await stop();
        process.exit(0);
      }
      evidence.blocker = 'App shell did not become ready';
      throw new Error(evidence.blocker);
    }

    const reel = page.locator('[data-reel-snap-item]').first();
    await reel.waitFor({ state: 'attached', timeout: 25_000 });
    evidence.mount = {
      attached: true,
      visible: await reel.isVisible().catch(() => false),
      count: await page.locator('[data-reel-snap-item]').count().catch(() => 0),
      chrome: (await page.locator('.reel-video-chrome').count().catch(() => 0)) > 0,
    };

    // Prefer a real <video>; carousel/cloud may render poster images first.
    const videoDeadline = Date.now() + 20_000;
    let videoHit = null;
    while (Date.now() < videoDeadline) {
      const video = page.locator('[data-reel-snap-item] video, video[data-playback-scope]').first();
      const count = await video.count().catch(() => 0);
      if (count > 0) {
        videoHit = {
          attached: true,
          visible: await video.isVisible().catch(() => false),
          scope: await video.getAttribute('data-playback-scope').catch(() => null),
        };
        break;
      }
      // Nudge carousel / next reel in case the active slide is an image.
      await page.keyboard.press('ArrowRight').catch(() => undefined);
      await page.keyboard.press('ArrowDown').catch(() => undefined);
      await page.mouse.wheel(0, 600).catch(() => undefined);
      await page.waitForTimeout(400);
    }
    evidence.video = videoHit || { attached: false, note: 'poster/image fallback or remote video blocked' };

    if (!evidence.mount.attached || evidence.mount.count < 1) {
      evidence.blocker = 'No [data-reel-snap-item] reels mounted';
      throw new Error(evidence.blocker);
    }

    if (pageErrors.length) {
      evidence.blocker = `pageerrors: ${pageErrors.slice(0, 3).join(' | ')}`;
      throw new Error(evidence.blocker);
    }

    const shot = path.join(OUT_DIR, `reels-mount-${stamp}.png`);
    await page.screenshot({ path: shot, fullPage: false, animations: 'disabled' }).catch(() => undefined);
    evidence.screenshot = shot;
    evidence.ok = true;
    evidence.videoElementPass = Boolean(videoHit?.attached);
    console.log('[smoke-reels-mount] PASS');
    console.log(JSON.stringify(evidence, null, 2));
    fs.writeFileSync(
      path.join(OUT_DIR, `reels-mount-${stamp}.json`),
      JSON.stringify({ evidence, pageErrors }, null, 2),
    );
    await browser.close();
    await stop();
    process.exit(0);
  } catch (err) {
    evidence.ok = false;
    evidence.error = err instanceof Error ? err.message : String(err);
    const shot = path.join(OUT_DIR, `reels-mount-FAIL-${stamp}.png`);
    await page.screenshot({ path: shot, fullPage: false }).catch(() => undefined);
    evidence.screenshot = shot;
    console.error('[smoke-reels-mount] FAIL');
    console.error(JSON.stringify({ evidence, pageErrors }, null, 2));
    fs.writeFileSync(
      path.join(OUT_DIR, `reels-mount-FAIL-${stamp}.json`),
      JSON.stringify({ evidence, pageErrors }, null, 2),
    );
    await browser.close().catch(() => undefined);
    await stop();
    process.exit(1);
  }
}

main();
