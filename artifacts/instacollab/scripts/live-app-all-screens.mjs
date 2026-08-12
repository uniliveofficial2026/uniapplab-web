#!/usr/bin/env node
/**
 * App-wide navigation + dwell latency across major screens.
 * Usage: node scripts/live-app-all-screens.mjs [baseUrl]
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const base = (process.argv[2] ?? 'http://127.0.0.1:5173').replace(/\/$/, '');
const OUT = path.join(REPO_ROOT, '.local/live-app-all-screens.json');

const ROUTE_SCREENS = [
  { label: 'Home', path: '/home' },
  { label: 'Explore', path: '/explore' },
  { label: 'Reels', path: '/reels' },
  { label: 'Karaoke', path: '/karaoke' },
  { label: 'Live', path: '/live' },
  { label: 'Messages', path: '/messages' },
  { label: 'Notifications', path: '/notifications' },
  { label: 'Wallet', path: '/wallet' },
  { label: 'Dating', path: '/dating' },
  { label: 'YouTube', path: '/youtube' },
  { label: 'Profile', path: '/profile' },
];

function findChromium() {
  const root = path.join(os.homedir(), '.cache/ms-playwright');
  try {
    for (const entry of fs.readdirSync(root)) {
      const full = path.join(root, entry, 'chrome-mac/Chromium.app/Contents/MacOS/Chromium');
      if (fs.existsSync(full)) return full;
    }
  } catch {
    /* ignore */
  }
  return null;
}

async function launchBrowser() {
  const args = [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    '--autoplay-policy=no-user-gesture-required',
  ];
  const executablePath = findChromium();
  if (executablePath) {
    try {
      return await chromium.launch({ headless: true, executablePath, args });
    } catch {
      /* fall through */
    }
  }
  return chromium.launch({ channel: 'chrome', headless: true, args });
}

async function dismissDev(page) {
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('div')) {
      const t = el.textContent || '';
      if (t.includes('Live dev') && t.includes('Ctrl+Shift+D')) {
        el.style.display = 'none';
        el.style.pointerEvents = 'none';
      }
    }
  }).catch(() => {});
}

async function ensureDemo(page) {
  await page.goto(`${base}/?launch=main&as=u1&force_demo=1`, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });
  for (let i = 0; i < 35; i++) {
    const skip = page.getByRole('button', { name: /^skip$/i });
    if (await skip.isVisible().catch(() => false)) await skip.click().catch(() => {});
    const demo = page.getByRole('button', { name: /try demo/i });
    if (await demo.isVisible().catch(() => false)) await demo.click().catch(() => {});
    const sw = page.getByText('Switch as @designer_dude');
    if (await sw.isVisible().catch(() => false)) await sw.click().catch(() => {});
    if (await page.getByText('Karaoke', { exact: true }).first().isVisible().catch(() => false)) {
      await dismissDev(page);
      return;
    }
    await page.waitForTimeout(700);
  }
  throw new Error('demo_boot_timeout');
}

async function clickNav(page, label) {
  // Prefer desktop sidebar exact text; fallback aria / role.
  const candidates = [
    page.getByRole('button', { name: new RegExp(`^${label}$`, 'i') }).first(),
    page.getByText(label, { exact: true }).first(),
    page.locator(`button:has-text("${label}")`).first(),
    page.locator(`a:has-text("${label}")`).first(),
  ];
  for (const el of candidates) {
    if (!(await el.isVisible().catch(() => false))) continue;
    const t0 = Date.now();
    await el.click({ timeout: 8000 });
    return Date.now() - t0;
  }
  return null;
}

async function main() {
  const browser = await launchBrowser();
  const ctx = await browser.newContext({
    permissions: ['camera', 'microphone'],
    viewport: { width: 1280, height: 900 },
  });
  await ctx.addInitScript(() => {
    window.__allPerf = { longTasks: [], phase: 'boot' };
    try {
      const po = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          window.__allPerf.longTasks.push({
            t: Date.now(),
            duration: Math.round(e.duration),
            phase: window.__allPerf.phase,
          });
        }
      });
      po.observe({ type: 'longtask', buffered: true });
    } catch {
      /* ignore */
    }
  });
  const page = await ctx.newPage();
  const result = {
    ok: false,
    nav: [],
    dwell: {},
    maxLongTaskMs: 0,
    failReasons: [],
  };

  try {
    await ensureDemo(page);
    console.log('[step] boot');

    await page.evaluate(() => {
      window.__allPerf.phase = 'nav';
      window.__allPerf.longTasks = [];
    });

    for (const screen of ROUTE_SCREENS) {
      let ms = await clickNav(page, screen.label);
      if (ms == null) {
        const t0 = Date.now();
        await page.goto(`${base}${screen.path}?launch=main&as=u1&force_demo=1`, {
          waitUntil: 'domcontentloaded',
          timeout: 45_000,
        });
        await page.waitForTimeout(500);
        await dismissDev(page);
        ms = Date.now() - t0;
        console.log('[step] route', screen.label, `${ms}ms`);
        result.nav.push({ label: screen.label, ms, skipped: false, via: 'route' });
      } else {
        console.log('[step] nav', screen.label, `${ms}ms`);
        result.nav.push({ label: screen.label, ms, skipped: false, via: 'nav' });
      }
      await page.waitForTimeout(500);
      await dismissDev(page);
    }

    // Dwell each successful screen briefly
    for (const screen of [
      { label: 'Home', path: '/home' },
      { label: 'Karaoke', path: '/karaoke' },
      { label: 'Live', path: '/live' },
      { label: 'Messages', path: '/messages' },
      { label: 'Reels', path: '/reels' },
      { label: 'Wallet', path: '/wallet' },
    ]) {
      await page.goto(`${base}${screen.path}?launch=main&as=u1&force_demo=1`, {
        waitUntil: 'domcontentloaded',
        timeout: 45_000,
      });
      await page.waitForTimeout(400);
      await dismissDev(page);
      await page.evaluate((phase) => {
        window.__allPerf.phase = phase;
        window.__allPerf.longTasks = [];
      }, `dwell_${screen.label}`);
      await page.waitForTimeout(3000);
      const dwellMax = await page.evaluate(() =>
        (window.__allPerf.longTasks || []).reduce((m, x) => Math.max(m, x.duration || 0), 0),
      );
      result.dwell[screen.label] = dwellMax;
      console.log('[step] dwell', screen.label, `${dwellMax}ms`);
    }

    const probe = await page.evaluate(() => window.__allPerf.longTasks || []);
    result.maxLongTaskMs = Math.max(
      0,
      ...probe.map((x) => x.duration || 0),
      ...Object.values(result.dwell),
    );
    result.longTasks = probe.slice(-40);

    const slowNav = result.nav.filter((n) => n.via === 'nav' && n.ms != null && n.ms >= 700);
    const visited = result.nav.filter((n) => !n.skipped).length;
    const hotDwell = Object.entries(result.dwell).filter(([, v]) => v >= 900);

    if (visited < 5) result.failReasons.push(`visited_${visited}`);
    if (slowNav.length) {
      result.failReasons.push(`slow_nav_${slowNav.map((n) => `${n.label}:${n.ms}`).join('|')}`);
    }
    if (hotDwell.length) {
      result.failReasons.push(`dwell_${hotDwell.map(([k, v]) => `${k}:${v}`).join('|')}`);
    }
    if (result.maxLongTaskMs >= 1500) {
      result.failReasons.push(`longtask_${result.maxLongTaskMs}`);
    }

    result.ok = result.failReasons.length === 0;
    console.log('[step] done', result.ok ? 'PASS' : `FAIL ${result.failReasons.join(', ')}`);
  } catch (err) {
    result.ok = false;
    result.failReasons = [err instanceof Error ? err.message : String(err)];
    console.log('[step] error', result.failReasons[0]);
  } finally {
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(result, null, 2));
    console.log(
      '\nRESULT',
      JSON.stringify(
        {
          ok: result.ok,
          maxLongTaskMs: result.maxLongTaskMs,
          nav: result.nav,
          dwell: result.dwell,
          failReasons: result.failReasons,
          out: OUT,
        },
        null,
        2,
      ),
    );
    await browser.close();
  }
  process.exit(result.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
