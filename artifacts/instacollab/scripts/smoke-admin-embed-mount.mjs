#!/usr/bin/env node
/**
 * Stage A smoke: Admin embed route mount (no workspace access-code secrets).
 * /admin-embed/gift-preview → [data-admin-embed-gift-preview]
 * Workspace /admin panel stays access-code gated → contract tests cover AdminControlCenter.
 *
 * Usage: node scripts/smoke-admin-embed-mount.mjs [baseUrl]
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  REPO_ROOT,
  detectAuthGate,
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

  console.log(`[smoke-admin-embed-mount] base=${base}`);

  const browser = await launchBrowser();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (err) => {
    pageErrors.push((err?.message || String(err)).slice(0, 300));
  });

  try {
    const url = `${base}/admin-embed/gift-preview`;
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 45_000,
    });

    if (await detectAuthGate(page)) {
      evidence.ok = true;
      evidence.skipped = 'auth_gated';
      console.log('[smoke-admin-embed-mount] SKIP (auth-gated)');
      console.log(JSON.stringify(evidence, null, 2));
      await browser.close();
      await stop();
      process.exit(0);
    }

    const host = page.locator('[data-admin-embed-gift-preview]');
    await host.waitFor({ state: 'attached', timeout: 25_000 });

    const giftPreviewCopy = page.getByText(/Gift preview|Tap Preview effect/i).first();
    evidence.mount = {
      attached: true,
      visible: await host.isVisible().catch(() => false),
      giftPreviewText: await giftPreviewCopy.isVisible().catch(() => false),
      path: '/admin-embed/gift-preview',
    };

    if (!evidence.mount.attached) {
      evidence.blocker = 'admin-embed gift-preview host missing';
      throw new Error(evidence.blocker);
    }

    if (pageErrors.length) {
      evidence.blocker = `pageerrors: ${pageErrors.slice(0, 3).join(' | ')}`;
      throw new Error(evidence.blocker);
    }

    const shot = path.join(OUT_DIR, `admin-embed-mount-${stamp}.png`);
    await page.screenshot({ path: shot, fullPage: false, animations: 'disabled' }).catch(() => undefined);
    evidence.screenshot = shot;
    evidence.ok = true;
    console.log('[smoke-admin-embed-mount] PASS');
    console.log(JSON.stringify(evidence, null, 2));
    fs.writeFileSync(
      path.join(OUT_DIR, `admin-embed-mount-${stamp}.json`),
      JSON.stringify({ evidence, pageErrors }, null, 2),
    );
    await browser.close();
    await stop();
    process.exit(0);
  } catch (err) {
    evidence.ok = false;
    evidence.error = err instanceof Error ? err.message : String(err);
    const shot = path.join(OUT_DIR, `admin-embed-mount-FAIL-${stamp}.png`);
    await page.screenshot({ path: shot, fullPage: false }).catch(() => undefined);
    evidence.screenshot = shot;
    console.error('[smoke-admin-embed-mount] FAIL');
    console.error(JSON.stringify({ evidence, pageErrors }, null, 2));
    fs.writeFileSync(
      path.join(OUT_DIR, `admin-embed-mount-FAIL-${stamp}.json`),
      JSON.stringify({ evidence, pageErrors }, null, 2),
    );
    await browser.close().catch(() => undefined);
    await stop();
    process.exit(1);
  }
}

main();
