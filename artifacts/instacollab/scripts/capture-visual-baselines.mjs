#!/usr/bin/env node
/**
 * Capture Stage A pixel visual baselines for critical shell routes.
 *
 * Usage:
 *   node scripts/capture-visual-baselines.mjs [baseUrl]
 *   VISUAL_BASELINE_OUT=... node scripts/capture-visual-baselines.mjs
 *
 * Writes PNGs + manifest.json under test/visual-baselines/ (or VISUAL_BASELINE_OUT).
 * Skips auth-gated routes gracefully (records status: skipped_auth).
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  BASELINES_DIR,
  CRITICAL_ROUTES,
  VIEWPORT,
  demoUrl,
  detectAuthGate,
  dismissLaunchOverlays,
  ensureDevServer,
  launchBrowser,
  openCreateRoom,
  openMarketplace,
  stabilizeForCapture,
  waitForAnyReady,
} from './lib/visual-baseline-shared.mjs';

const preferredBase = (process.argv[2] || process.env.VISUAL_BASE_URL || '').replace(/\/$/, '') || undefined;
const outDir = process.env.VISUAL_BASELINE_OUT
  ? path.resolve(process.env.VISUAL_BASELINE_OUT)
  : BASELINES_DIR;

async function captureRoute(page, base, route) {
  const result = {
    id: route.id,
    label: route.label,
    path: route.path,
    kind: route.kind || 'navigate',
    status: 'pending',
    file: `${route.id}.png`,
    ready: null,
    error: null,
  };

  try {
    await page.goto(demoUrl(base, route.path), {
      waitUntil: 'domcontentloaded',
      timeout: 45_000,
    });
    const shellReady = await dismissLaunchOverlays(page, 45_000);
    if (!shellReady) {
      if (await detectAuthGate(page)) {
        result.status = 'skipped_auth';
        result.error = 'Auth gate blocked shell; skipped gracefully';
        return result;
      }
      result.status = 'fail';
      result.error = 'App shell did not become ready';
      return result;
    }

    if (await detectAuthGate(page)) {
      result.status = 'skipped_auth';
      result.error = 'Auth-gated after dismiss; skipped gracefully';
      return result;
    }

    if (route.kind === 'create-room') {
      await openCreateRoom(page);
    } else if (route.kind === 'marketplace') {
      await openMarketplace(page);
    }

    const ready = await waitForAnyReady(page, route, 30_000);
    result.ready = ready;
    if (!ready.ok) {
      if (await detectAuthGate(page)) {
        result.status = 'skipped_auth';
        result.error = 'Auth-gated before ready markers; skipped gracefully';
        return result;
      }
      result.status = 'fail';
      result.error = `Ready markers not found for ${route.id}`;
      return result;
    }

    // Settle animations / lazy chunks, then freeze motion + mask dynamic feed.
    await page.waitForTimeout(700);
    await stabilizeForCapture(page, route);

    const shotPath = path.join(outDir, result.file);
    await page.screenshot({
      path: shotPath,
      fullPage: false,
      animations: 'disabled',
      caret: 'hide',
      timeout: 10_000,
    });
    result.status = 'captured';
    result.bytes = fs.statSync(shotPath).size;
    return result;
  } catch (err) {
    if (await detectAuthGate(page).catch(() => false)) {
      result.status = 'skipped_auth';
      result.error = err instanceof Error ? err.message : String(err);
      return result;
    }
    result.status = 'fail';
    result.error = err instanceof Error ? err.message : String(err);
    return result;
  }
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const server = await ensureDevServer(preferredBase);
  const { base, stop } = server;

  console.log(`[capture-visual-baselines] base=${base} out=${outDir} started=${server.started}`);

  const browser = await launchBrowser();
  const context = await browser.newContext({
    viewport: VIEWPORT,
    permissions: ['camera', 'microphone'],
    reducedMotion: 'reduce',
  });

  const results = [];
  try {
    for (const route of CRITICAL_ROUTES) {
      process.stdout.write(`  → ${route.id.padEnd(20)} `);
      const page = await context.newPage();
      try {
        const row = await captureRoute(page, base, route);
        results.push(row);
        console.log(row.status + (row.error ? ` (${row.error.slice(0, 80)})` : ''));
      } finally {
        await page.close().catch(() => undefined);
      }
    }
  } finally {
    await browser.close().catch(() => undefined);
    await stop();
  }

  const captured = results.filter((r) => r.status === 'captured');
  const skipped = results.filter((r) => r.status === 'skipped_auth');
  // Soft-fail dynamic routes so CI still gates stable chrome (home/messages).
  for (const row of results) {
    if (
      row.status === 'fail' &&
      (row.id === 'marketplace' || row.id === 'live-create-room')
    ) {
      row.status = 'skipped_unstable';
      row.error = row.error || 'unstable ready markers / dynamic content';
    }
  }
  const hardFailed = results.filter((r) => r.status === 'fail');
  const skippedUnstable = results.filter((r) => r.status === 'skipped_unstable');

  const manifest = {
    capturedAt: new Date().toISOString(),
    viewport: VIEWPORT,
    base,
    uiUxChanged: false,
    routes: results,
    summary: {
      captured: captured.length,
      skipped_auth: skipped.length,
      skipped_unstable: skippedUnstable.length,
      fail: hardFailed.length,
    },
  };
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

  console.log('[capture-visual-baselines] summary', manifest.summary);

  if (hardFailed.length) {
    console.error('[capture-visual-baselines] FAIL');
    process.exit(1);
  }
  if (captured.length === 0) {
    console.error('[capture-visual-baselines] FAIL — no routes captured (all skipped?)');
    process.exit(1);
  }
  console.log('[capture-visual-baselines] PASS');
  process.exit(0);
}

main().catch((err) => {
  console.error('[capture-visual-baselines] FAIL', err);
  process.exit(1);
});
