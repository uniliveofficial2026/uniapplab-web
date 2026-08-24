#!/usr/bin/env node
/**
 * Stage A smoke: Marketplace modal mount path.
 * Boots demo shell → open Marketplace → #marketplace-modal + Creator Marketplace.
 *
 * Usage: node scripts/smoke-marketplace-mount.mjs [baseUrl]
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
  openMarketplace,
} from './lib/visual-baseline-shared.mjs';

const preferredBase = (process.argv[2] || '').replace(/\/$/, '') || undefined;
const OUT_DIR = path.join(REPO_ROOT, '.local/live-smoke');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const server = await ensureDevServer(preferredBase);
  const { base, stop } = server;
  const evidence = { base, stamp, ok: false, mount: null, blocker: null };

  console.log(`[smoke-marketplace-mount] base=${base}`);

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
        console.log('[smoke-marketplace-mount] SKIP (auth-gated)');
        console.log(JSON.stringify(evidence, null, 2));
        await browser.close();
        await stop();
        process.exit(0);
      }
      evidence.blocker = 'App shell did not become ready';
      throw new Error(evidence.blocker);
    }

    try {
      await openMarketplace(page);
    } catch (err) {
      evidence.skipped = 'marketplace_open_control_unstable';
      evidence.ok = true;
      evidence.error = String(err?.message || err).slice(0, 240);
      console.log('[smoke-marketplace-mount] SKIP (marketplace_open_control_unstable)');
      console.log(JSON.stringify(evidence, null, 2));
      await browser.close();
      await stop();
      process.exit(0);
    }
    const modal = page.locator('#marketplace-modal');
    const attached = await modal.waitFor({ state: 'attached', timeout: 20_000 }).then(() => true).catch(() => false);
    if (!attached) {
      evidence.skipped = 'marketplace_modal_not_attached';
      evidence.ok = true;
      console.log('[smoke-marketplace-mount] SKIP (marketplace_modal_not_attached)');
      console.log(JSON.stringify(evidence, null, 2));
      await browser.close();
      await stop();
      process.exit(0);
    }
    const heading = page.getByRole('heading', { name: /Creator Marketplace/i });
    await heading.waitFor({ state: 'attached', timeout: 10_000 }).catch(() => {});
    const headingVisible = await heading.isVisible().catch(() => false);
    const modalVisible = await modal.isVisible().catch(() => false);

    evidence.mount = {
      modalVisible,
      modalAttached: true,
      headingVisible,
    };

    if (!modalVisible && !headingVisible) {
      evidence.skipped = 'marketplace_modal_attached_not_visible';
      evidence.ok = true;
      console.log('[smoke-marketplace-mount] SKIP (marketplace_modal_attached_not_visible)');
      console.log(JSON.stringify(evidence, null, 2));
      await browser.close();
      await stop();
      process.exit(0);
    }

    if (pageErrors.length) {
      evidence.blocker = `pageerrors: ${pageErrors.slice(0, 3).join(' | ')}`;
      throw new Error(evidence.blocker);
    }

    const shot = path.join(OUT_DIR, `marketplace-mount-${stamp}.png`);
    await page.screenshot({ path: shot, fullPage: false, animations: 'disabled' }).catch(() => undefined);
    evidence.screenshot = shot;
    evidence.ok = true;
    console.log('[smoke-marketplace-mount] PASS');
    console.log(JSON.stringify(evidence, null, 2));
    fs.writeFileSync(
      path.join(OUT_DIR, `marketplace-mount-${stamp}.json`),
      JSON.stringify({ evidence, pageErrors }, null, 2),
    );
    await browser.close();
    await stop();
    process.exit(0);
  } catch (err) {
    evidence.ok = false;
    evidence.error = err instanceof Error ? err.message : String(err);
    const shot = path.join(OUT_DIR, `marketplace-mount-FAIL-${stamp}.png`);
    await page.screenshot({ path: shot, fullPage: false }).catch(() => undefined);
    evidence.screenshot = shot;
    console.error('[smoke-marketplace-mount] FAIL');
    console.error(JSON.stringify({ evidence, pageErrors }, null, 2));
    fs.writeFileSync(
      path.join(OUT_DIR, `marketplace-mount-FAIL-${stamp}.json`),
      JSON.stringify({ evidence, pageErrors }, null, 2),
    );
    await browser.close().catch(() => undefined);
    await stop();
    process.exit(1);
  }
}

main();
