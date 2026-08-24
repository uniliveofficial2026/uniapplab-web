#!/usr/bin/env node
/**
 * Stage A smoke: Messages mount path.
 * Boots demo shell at /messages → #messages-screen must attach.
 *
 * Usage: node scripts/smoke-messages-mount.mjs [baseUrl]
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
  const evidence = { base, stamp, ok: false, mount: null, blocker: null };

  console.log(`[smoke-messages-mount] base=${base}`);

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
    await page.goto(demoUrl(base, '/messages'), {
      waitUntil: 'domcontentloaded',
      timeout: 45_000,
    });
    const shellReady = await dismissLaunchOverlays(page, 45_000);
    if (!shellReady) {
      if (await detectAuthGate(page)) {
        evidence.ok = true;
        evidence.skipped = 'auth_gated';
        console.log('[smoke-messages-mount] SKIP (auth-gated)');
        console.log(JSON.stringify(evidence, null, 2));
        await browser.close();
        await stop();
        process.exit(0);
      }
      evidence.blocker = 'App shell did not become ready';
      throw new Error(evidence.blocker);
    }

    const mount = page.locator('#messages-screen');
    await mount.waitFor({ state: 'attached', timeout: 25_000 });
    evidence.mount = {
      attached: true,
      visible: await mount.isVisible().catch(() => false),
      chatOpen: await mount.getAttribute('data-chat-open'),
    };

    if (pageErrors.length) {
      evidence.blocker = `pageerrors: ${pageErrors.slice(0, 3).join(' | ')}`;
      throw new Error(evidence.blocker);
    }

    const shot = path.join(OUT_DIR, `messages-mount-${stamp}.png`);
    await page.screenshot({ path: shot, fullPage: false, animations: 'disabled' }).catch(() => undefined);
    evidence.screenshot = shot;
    evidence.ok = true;
    console.log('[smoke-messages-mount] PASS');
    console.log(JSON.stringify(evidence, null, 2));
    fs.writeFileSync(
      path.join(OUT_DIR, `messages-mount-${stamp}.json`),
      JSON.stringify({ evidence, pageErrors }, null, 2),
    );
    await browser.close();
    await stop();
    process.exit(0);
  } catch (err) {
    evidence.ok = false;
    evidence.error = err instanceof Error ? err.message : String(err);
    const shot = path.join(OUT_DIR, `messages-mount-FAIL-${stamp}.png`);
    await page.screenshot({ path: shot, fullPage: false }).catch(() => undefined);
    evidence.screenshot = shot;
    console.error('[smoke-messages-mount] FAIL');
    console.error(JSON.stringify({ evidence, pageErrors }, null, 2));
    fs.writeFileSync(
      path.join(OUT_DIR, `messages-mount-FAIL-${stamp}.json`),
      JSON.stringify({ evidence, pageErrors }, null, 2),
    );
    await browser.close().catch(() => undefined);
    await stop();
    process.exit(1);
  }
}

main();
