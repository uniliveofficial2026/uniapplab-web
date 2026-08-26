#!/usr/bin/env node
/**
 * test:responsive-matrix — multi-viewport shell sweep with failure classification.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CRITICAL_LANDMARKS,
  MOBILE_USER_AGENT,
  SHELL_ROUTES,
  VIEWPORT_MATRIX,
  layoutProbeSource,
  launchChromium,
  loginIfNeeded,
  navigateShellTab,
} from './lib/layout-probe.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = path.join(root, 'docs/ui-device-recovery');
const outFile = path.join(outDir, 'FINAL-RESPONSIVE-SCREEN-MATRIX.json');

spawnSync('node', ['scripts/ui-device-recovery/generate-responsive-inventories.mjs'], {
  cwd: root,
  stdio: 'inherit',
});

const inventoryPath = path.join(outDir, 'FINAL-SCREEN-INVENTORY.json');
const screens = JSON.parse(fs.readFileSync(inventoryPath, 'utf8')).screens;

const BASE = process.env.UNILIVE_E2E_BASE || 'https://app.uniapplab.com';
const EMAIL = (process.env.UNILIVE_E2E_EMAIL || 'demo@unilive.app').trim();
const PASSWORD = (process.env.UNILIVE_E2E_PASSWORD || 'demo123').trim();

const matrix = {
  generatedAt: new Date().toISOString(),
  base: BASE,
  screensIndexed: screens.length,
  results: {},
  failures: [],
  summary: {},
};

for (const s of screens) {
  matrix.results[s.screenId] = {
    smallPhone: 'NOT_APPLICABLE',
    standardPhone: 'NOT_APPLICABLE',
    largePhone: 'NOT_APPLICABLE',
    physicalIphone: 'BLOCKED_EXTERNAL_DEVICE',
    android: 'NOT_APPLICABLE',
    tablet: 'NOT_APPLICABLE',
    desktop: 'NOT_APPLICABLE',
  };
}

function ensureScreenResult(screenId) {
  if (!matrix.results[screenId]) {
    matrix.results[screenId] = {
      smallPhone: 'NOT_APPLICABLE',
      standardPhone: 'NOT_APPLICABLE',
      largePhone: 'NOT_APPLICABLE',
      physicalIphone: 'BLOCKED_EXTERNAL_DEVICE',
      android: 'NOT_APPLICABLE',
      tablet: 'NOT_APPLICABLE',
      desktop: 'NOT_APPLICABLE',
    };
  }
  return matrix.results[screenId];
}

const viewportBuckets = {
  smallPhone: VIEWPORT_MATRIX.smallPhone,
  standardPhone: VIEWPORT_MATRIX.standardPhone,
  largePhone: VIEWPORT_MATRIX.largePhone,
  android: VIEWPORT_MATRIX.androidPhone,
  tablet: VIEWPORT_MATRIX.tablet,
  desktop: VIEWPORT_MATRIX.desktop,
};

if (process.env.UNILIVE_SKIP_BROWSER === '1') {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(matrix, null, 2));
  console.log(JSON.stringify({ ok: true, skipped: true, screens: screens.length }, null, 2));
  process.exit(0);
}

const browser = await launchChromium();
const probeFn = layoutProbeSource();

try {
  for (const [bucket, vp] of Object.entries(viewportBuckets)) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.width < 768,
      hasTouch: vp.width < 1024,
      userAgent: MOBILE_USER_AGENT,
    });
    const page = await context.newPage();
    const signedIn = await loginIfNeeded(page, EMAIL, PASSWORD);

    for (const route of SHELL_ROUTES) {
      if (signedIn && route.tab) {
        await navigateShellTab(page, route.tab);
      } else {
        await page.goto(`${BASE}${route.route}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await page.waitForTimeout(1500);
      }
      const probe = await page.evaluate(probeFn, { selectors: CRITICAL_LANDMARKS });
      let status = 'PASS';
      if (!probe.ok) {
        status = 'FAIL';
      } else if (!probe.shellReady) {
        status = signedIn ? 'PARTIAL' : 'BLOCKED_AUTH';
      }
      ensureScreenResult(route.screenId)[bucket] = status;
      if (status === 'FAIL') {
        for (const f of probe.failures) {
          matrix.failures.push({
            screenId: route.screenId,
            viewport: bucket,
            route: route.route,
            ...f,
          });
        }
      }
    }
    await context.close();
  }
} finally {
  await browser.close();
}

for (const bucket of Object.keys(viewportBuckets)) {
  const vals = Object.values(matrix.results).map((r) => r[bucket]);
  const tested = vals.filter((v) => v === 'PASS' || v === 'FAIL');
  matrix.summary[bucket] =
    tested.length === 0
      ? 'NOT_APPLICABLE'
      : tested.every((v) => v === 'PASS')
        ? 'PASS'
        : tested.some((v) => v === 'FAIL')
          ? 'FAIL'
          : 'BLOCKED_AUTH';
}

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(matrix, null, 2));

const ok = !Object.values(matrix.summary).includes('FAIL');
console.log(
  JSON.stringify(
    {
      ok,
      failures: matrix.failures.length,
      summary: matrix.summary,
      screensIndexed: matrix.screensIndexed,
    },
    null,
    2,
  ),
);
if (!ok) process.exitCode = 1;
