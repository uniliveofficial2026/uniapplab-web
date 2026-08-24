#!/usr/bin/env node
/**
 * Capture approved V13 live-tool panel renders at 390×844 for visual comparison.
 * Requires: pnpm --filter @workspace/instacollab run build
 * Usage: node scripts/capture-live-tools-v13-screenshots.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const outDir = path.join(appRoot, '.local-dev/live-tools-v13-screenshots');
const previewPort = 5199;

const PANELS = ['gifts', 'guests', 'games', 'voice', 'beauty'];

function waitForUrl(url, timeoutMs = 60000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        const res = await fetch(url);
        if (res.ok) return resolve(undefined);
      } catch {
        /* retry */
      }
      if (Date.now() - start > timeoutMs) return reject(new Error(`Timed out waiting for ${url}`));
      setTimeout(tick, 400);
    };
    void tick();
  });
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });

  const preview = spawn(
    'pnpm',
    ['exec', 'vite', 'preview', '--port', String(previewPort), '--host', '127.0.0.1'],
    { cwd: appRoot, stdio: 'pipe', env: { ...process.env, PREVIEW_PORT: String(previewPort) } },
  );

  let playwright;
  try {
    await waitForUrl(`http://127.0.0.1:${previewPort}/`);
    playwright = await import('playwright');
  } catch (err) {
    preview.kill('SIGTERM');
    console.error(err);
    process.exit(1);
  }

  const browser = await playwright.chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });

  for (const panel of PANELS) {
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${previewPort}/?live_tools_v13_probe=${panel}`, {
      waitUntil: 'networkidle',
      timeout: 60000,
    });
    await page.waitForSelector('#live-tools-v13-probe-root', { timeout: 30000 });
    await page.waitForTimeout(600);
    const outPath = path.join(outDir, `actual-${panel}-390x844.png`);
    await page.locator('#live-tools-v13-probe-root').screenshot({ path: outPath });
    console.log('Wrote', outPath);
    await page.close();
  }

  await browser.close();
  preview.kill('SIGTERM');

  const refName = (p) => {
    if (p === 'guests') return 'approved-guest-panel.jpeg';
    if (p === 'gifts') return '01-approved-gift-panel.png';
    if (p === 'games') return '02-approved-game-center.png';
    if (p === 'voice') return '03-approved-voice-changer.png';
    return '04-approved-beauty-effects.png';
  };

  fs.writeFileSync(
    path.join(outDir, 'manifest.json'),
    JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        viewport: '390x844',
        outputs: PANELS.map((p) => ({
          panel: p,
          actual: `.local-dev/live-tools-v13-screenshots/actual-${p}-390x844.png`,
          reference: `/reference-approved/live-tools-v13/${refName(p)}`,
        })),
      },
      null,
      2,
    ),
  );
  console.log('Done. See', outDir);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
