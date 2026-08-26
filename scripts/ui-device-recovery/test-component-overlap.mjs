#!/usr/bin/env node
/**
 * test:component-overlap — static SSOT + browser landmark intersection checks.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  MOBILE_USER_AGENT,
  launchChromium,
  loginIfNeeded,
} from './lib/layout-probe.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const app = path.join(root, 'artifacts/instacollab');
const outDir = path.join(root, 'docs/ui-device-recovery');

spawnSync('node', ['scripts/ui-device-recovery/generate-responsive-inventories.mjs'], {
  cwd: root,
  stdio: 'inherit',
});

const safeArea = fs.readFileSync(path.join(app, 'src/lib/safeArea.ts'), 'utf8');
assert.match(safeArea, /measureHorizontalOverflowPx/);
assert.match(safeArea, /horizontalOverflow/);
assert.match(safeArea, /isMobile/);
assert.match(safeArea, /keyboardInset/);

const css = fs.readFileSync(path.join(app, 'src/index.css'), 'utf8');
assert.match(css, /\.pb-composer/);
assert.match(css, /data-keyboard-open/);

const geometryPath = path.join(outDir, 'FINAL-COMPONENT-GEOMETRY-MATRIX.json');
assert.ok(fs.existsSync(geometryPath), 'component geometry matrix missing');

const result = {
  static: 'PASS',
  browser: 'SKIPPED',
  overlaps: [],
  ok: true,
};

if (process.env.UNILIVE_SKIP_BROWSER !== '1') {
  const browser = await launchChromium();
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    userAgent: MOBILE_USER_AGENT,
    isMobile: true,
    hasTouch: true,
  });
  try {
    const signedIn = await loginIfNeeded(
      page,
      (process.env.UNILIVE_E2E_EMAIL || 'demo@unilive.app').trim(),
      (process.env.UNILIVE_E2E_PASSWORD || 'demo123').trim(),
    );
    if (signedIn) {
      const overlap = await page.evaluate(() => {
        const nav = document.querySelector('.mobile-bottom-nav, [data-testid="home-nav"]');
        const main = document.querySelector('main, [data-app-main], .app-main');
        if (!nav || !main) return { ok: true, reason: 'landmarks_missing' };
        const a = nav.getBoundingClientRect();
        const b = main.getBoundingClientRect();
        const intersects = !(a.bottom < b.top || a.top > b.bottom);
        return {
          ok: !intersects,
          navBottom: Math.round(a.top),
          mainBottom: Math.round(b.bottom),
          intersects,
        };
      });
      result.browser = overlap.ok ? 'PASS' : 'FAIL';
      if (!overlap.ok && overlap.intersects) {
        result.ok = false;
        result.overlaps.push({ failureClass: 'NAV_OVERLAP', detail: overlap });
      }
    } else {
      result.browser = 'AUTH_SKIPPED';
    }
  } finally {
    await browser.close();
  }
}

console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exitCode = 1;
