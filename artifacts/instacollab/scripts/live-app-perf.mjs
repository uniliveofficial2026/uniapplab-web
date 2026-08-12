#!/usr/bin/env node
/**
 * App-wide interaction + background lag check.
 * Usage: node scripts/live-app-perf.mjs [baseUrl]
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const base = (process.argv[2] ?? 'http://127.0.0.1:5173').replace(/\/$/, '');
const OUT = path.join(REPO_ROOT, '.local/live-app-perf.json');

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
  });
}

async function main() {
  const browser = await launchBrowser();
  const ctx = await browser.newContext({
    permissions: ['camera', 'microphone'],
    viewport: { width: 1280, height: 900 },
  });
  await ctx.addInitScript(() => {
    window.__perfProbe = { longTasks: [] };
    try {
      const po = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          window.__perfProbe.longTasks.push({
            t: Date.now(),
            duration: Math.round(e.duration),
            phase: window.__perfProbe.phase || 'boot',
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
    steps: [],
    maxLongTaskMs: 0,
    dwellMaxLongTaskMs: 0,
    clickSamples: [],
    failReasons: [],
  };
  const step = (name, note = '') => {
    result.steps.push({ name, note, t: Date.now() });
    console.log('[step]', name, note);
  };

  try {
    await page.goto(`${base}/home?launch=main&as=u1&force_demo=1`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    for (let i = 0; i < 25; i++) {
      const skip = page.getByRole('button', { name: /^skip$/i });
      if (await skip.isVisible().catch(() => false)) await skip.click().catch(() => {});
      const ready = await page.getByText('Karaoke', { exact: true }).first().isVisible().catch(() => false);
      if (ready) break;
      await page.waitForTimeout(700);
    }
    step('boot');
    await dismissDev(page);

    await page.evaluate(() => {
      window.__perfProbe.phase = 'dwell_home';
      window.__perfProbe.longTasks = [];
    });
    await page.waitForTimeout(5000);
    const homeDwell = await page.evaluate(() =>
      (window.__perfProbe.longTasks || []).reduce((m, x) => Math.max(m, x.duration || 0), 0),
    );
    result.dwellMaxLongTaskMs = homeDwell;
    step('dwell_home', `${homeDwell}ms max longtask`);

    const tabs = ['Explore', 'Reels', 'Karaoke', 'Live', 'Messages', 'Home'];
    await page.evaluate(() => {
      window.__perfProbe.phase = 'nav';
      window.__perfProbe.longTasks = [];
    });
    for (const name of tabs) {
      const btn = page.getByText(name, { exact: true }).first();
      if (!(await btn.isVisible().catch(() => false))) {
        step('skip_tab', name);
        continue;
      }
      const t0 = Date.now();
      await btn.click({ timeout: 8000 });
      const dt = Date.now() - t0;
      result.clickSamples.push({ tab: name, ms: dt });
      step('nav', `${name} ${dt}ms`);
      await page.waitForTimeout(700);
    }

    await page.goto(`${base}/karaoke?launch=main&as=u1&force_demo=1`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    await page.waitForTimeout(1200);
    await dismissDev(page);
    await page.evaluate(() => {
      window.__perfProbe.phase = 'dwell_karaoke';
      window.__perfProbe.longTasks = [];
    });
    await page.waitForTimeout(5000);
    const karaokeDwell = await page.evaluate(() =>
      (window.__perfProbe.longTasks || []).reduce((m, x) => Math.max(m, x.duration || 0), 0),
    );
    result.dwellMaxLongTaskMs = Math.max(result.dwellMaxLongTaskMs, karaokeDwell);
    step('dwell_karaoke', `${karaokeDwell}ms max longtask`);

    const sing = page.locator('button[title="Sing & Record"]').first();
    await sing.waitFor({ state: 'attached', timeout: 15_000 });
    const tSing = Date.now();
    await sing.click({ force: true, timeout: 8000 });
    result.clickSamples.push({ tab: 'SingRecord', ms: Date.now() - tSing });
    step('open_studio', `${Date.now() - tSing}ms`);
    await page.waitForTimeout(1500);

    const probe = await page.evaluate(() => ({
      longTasks: window.__perfProbe?.longTasks ?? [],
    }));
    const allDur = [
      ...probe.longTasks.map((x) => x.duration || 0),
      result.dwellMaxLongTaskMs,
    ];
    result.maxLongTaskMs = allDur.reduce((m, x) => Math.max(m, x), 0);
    result.longTasks = probe.longTasks.slice(-40);

    const slowNav = result.clickSamples.filter((c) => c.ms >= 700);
    if (result.dwellMaxLongTaskMs >= 800) {
      result.failReasons.push(`dwell_longtask_${result.dwellMaxLongTaskMs}`);
    }
    if (result.maxLongTaskMs >= 1500) {
      result.failReasons.push(`longtask_${result.maxLongTaskMs}`);
    }
    if (slowNav.length) {
      result.failReasons.push(`slow_nav_${slowNav.map((s) => `${s.tab}:${s.ms}`).join('|')}`);
    }
    if (result.clickSamples.length < 3) {
      result.failReasons.push('too_few_nav_samples');
    }
    result.ok = result.failReasons.length === 0;
    step('done', result.ok ? 'PASS' : `FAIL ${result.failReasons.join(', ')}`);
  } catch (err) {
    result.ok = false;
    result.failReasons = [err instanceof Error ? err.message : String(err)];
    step('error', result.failReasons[0]);
  } finally {
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(result, null, 2));
    console.log(
      '\nRESULT',
      JSON.stringify(
        {
          ok: result.ok,
          maxLongTaskMs: result.maxLongTaskMs,
          dwellMaxLongTaskMs: result.dwellMaxLongTaskMs,
          clickSamples: result.clickSamples,
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
