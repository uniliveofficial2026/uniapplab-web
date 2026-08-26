#!/usr/bin/env node
/**
 * test:mobile-overflow — Playwright gate: no accidental document horizontal overflow.
 */
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
const outFile = path.join(outDir, 'FINAL-OVERFLOW-MATRIX.json');

const EMAIL = (process.env.UNILIVE_E2E_EMAIL || 'demo@unilive.app').trim();
const PASSWORD = (process.env.UNILIVE_E2E_PASSWORD || 'demo123').trim();
const BASE = process.env.UNILIVE_E2E_BASE || 'https://app.uniapplab.com';
const SKIP_BROWSER = process.env.UNILIVE_SKIP_BROWSER === '1';

const result = {
  generatedAt: new Date().toISOString(),
  base: BASE,
  entries: [],
  failures: [],
  ok: true,
};

if (SKIP_BROWSER) {
  result.note = 'SKIP_BROWSER=1 — static inventory only';
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

const browser = await launchChromium();
const probeFn = layoutProbeSource();

try {
  for (const [key, vp] of Object.entries(VIEWPORT_MATRIX)) {
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
        await page.waitForTimeout(2000);
      }

      const probe = await page.evaluate(probeFn, { selectors: CRITICAL_LANDMARKS });
      const entry = {
        viewport: key,
        screenId: route.screenId,
        route: route.route,
        horizontalOverflowPx: probe.horizontalOverflowPx,
        status: probe.horizontalOverflow ? 'FAIL' : 'PASS',
        failures: probe.failures,
      };
      result.entries.push(entry);
      if (probe.horizontalOverflow) {
        result.ok = false;
        result.failures.push({
          failureClass: 'HORIZONTAL_OVERFLOW',
          viewport: key,
          screenId: route.screenId,
          px: probe.horizontalOverflowPx,
        });
      }
    }
    await context.close();
  }
} finally {
  await browser.close();
}

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(result, null, 2));
console.log(JSON.stringify({ ok: result.ok, failures: result.failures.length, entries: result.entries.length }, null, 2));
if (!result.ok) process.exitCode = 1;
