#!/usr/bin/env node
/**
 * Stage A smoke: Posts feed mount path.
 * Boots demo shell at /home → StoryStrip + post cards must attach.
 *
 * Usage: node scripts/smoke-posts-feed-mount.mjs [baseUrl]
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

async function detectFeed(page) {
  const checks = [
    { id: 'story-strip-text', locator: page.getByText(/^STORIES$/i).first() },
    { id: 'your-story', locator: page.getByText(/Your story/i).first() },
    { id: 'posted-meta', locator: page.getByText(/Posted ·/i).first() },
    { id: 'follow-btn', locator: page.getByRole('button', { name: /^(Follow|Following)$/i }).first() },
    { id: 'repost-label', locator: page.getByText(/^Repost$/i).first() },
  ];
  for (const check of checks) {
    const count = await check.locator.count().catch(() => 0);
    if (count <= 0) continue;
    const visible = await check.locator.isVisible().catch(() => false);
    if (visible) return { id: check.id, visible, count };
  }
  return null;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const server = await ensureDevServer(preferredBase);
  const { base, stop } = server;
  const evidence = { base, stamp, ok: false, mount: null, blocker: null };

  console.log(`[smoke-posts-feed-mount] base=${base}`);

  const browser = await launchBrowser();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (err) => {
    pageErrors.push((err?.message || String(err)).slice(0, 300));
  });

  try {
    await page.goto(demoUrl(base, '/home'), {
      waitUntil: 'domcontentloaded',
      timeout: 45_000,
    });
    const shellReady = await dismissLaunchOverlays(page, 45_000);
    if (!shellReady) {
      if (await detectAuthGate(page)) {
        evidence.ok = true;
        evidence.skipped = 'auth_gated';
        console.log('[smoke-posts-feed-mount] SKIP (auth-gated)');
        console.log(JSON.stringify(evidence, null, 2));
        await browser.close();
        await stop();
        process.exit(0);
      }
      evidence.blocker = 'App shell did not become ready';
      throw new Error(evidence.blocker);
    }

    const deadline = Date.now() + 25_000;
    let hit = null;
    while (Date.now() < deadline) {
      hit = await detectFeed(page);
      if (hit) break;
      await page.waitForTimeout(300);
    }
    if (!hit) {
      evidence.blocker = 'Posts feed markers (stories/posts) not found';
      throw new Error(evidence.blocker);
    }
    evidence.mount = hit;

    if (pageErrors.length) {
      evidence.blocker = `pageerrors: ${pageErrors.slice(0, 3).join(' | ')}`;
      throw new Error(evidence.blocker);
    }

    const shot = path.join(OUT_DIR, `posts-feed-mount-${stamp}.png`);
    await page.screenshot({ path: shot, fullPage: false, animations: 'disabled' }).catch(() => undefined);
    evidence.screenshot = shot;
    evidence.ok = true;
    console.log('[smoke-posts-feed-mount] PASS');
    console.log(JSON.stringify(evidence, null, 2));
    fs.writeFileSync(
      path.join(OUT_DIR, `posts-feed-mount-${stamp}.json`),
      JSON.stringify({ evidence, pageErrors }, null, 2),
    );
    await browser.close();
    await stop();
    process.exit(0);
  } catch (err) {
    evidence.ok = false;
    evidence.error = err instanceof Error ? err.message : String(err);
    const shot = path.join(OUT_DIR, `posts-feed-mount-FAIL-${stamp}.png`);
    await page.screenshot({ path: shot, fullPage: false }).catch(() => undefined);
    evidence.screenshot = shot;
    console.error('[smoke-posts-feed-mount] FAIL');
    console.error(JSON.stringify({ evidence, pageErrors }, null, 2));
    fs.writeFileSync(
      path.join(OUT_DIR, `posts-feed-mount-FAIL-${stamp}.json`),
      JSON.stringify({ evidence, pageErrors }, null, 2),
    );
    await browser.close().catch(() => undefined);
    await stop();
    process.exit(1);
  }
}

main();
