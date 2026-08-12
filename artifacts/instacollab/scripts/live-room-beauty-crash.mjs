#!/usr/bin/env node
/**
 * Reproduce Solo Live room beauty crash/blank. Captures pageerror + console errors
 * and whether #root goes blank while interacting with the room beauty tray.
 * Usage: node scripts/live-room-beauty-crash.mjs [baseUrl]
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const base = (process.argv[2] ?? 'http://127.0.0.1:5173').replace(/\/$/, '');
const OUT = path.join(REPO_ROOT, '.local/live-room-beauty-crash.json');

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

async function launch() {
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

async function clickByText(page, re, timeout = 4000) {
  const el = page.getByText(re, { exact: false }).first();
  if (await el.isVisible().catch(() => false)) {
    await el.click({ timeout }).catch(() => {});
    return true;
  }
  const btn = page.getByRole('button', { name: re }).first();
  if (await btn.isVisible().catch(() => false)) {
    await btn.click({ timeout }).catch(() => {});
    return true;
  }
  return false;
}

async function loginIfAuthWall(page) {
  const onAuth = await page.getByText(/Welcome back/i).first().isVisible().catch(() => false);
  if (!onAuth) return false;
  // Click "Try demo (...)" button.
  const tryDemo = page.getByRole('button', { name: /try demo/i }).first();
  if (await tryDemo.isVisible().catch(() => false)) {
    await tryDemo.click({ timeout: 4000 }).catch(() => {});
  } else {
    await page.evaluate(() => {
      const b = Array.from(document.querySelectorAll('button')).find((x) =>
        /try demo/i.test(x.textContent || ''),
      );
      b?.click();
    });
  }
  await page.waitForTimeout(2500);
  return true;
}

async function rootBlank(page) {
  return page.evaluate(() => {
    const root = document.getElementById('root');
    const count = root?.childElementCount ?? 0;
    const txt = (document.body.innerText || '').trim();
    return count === 0 || txt.length === 0;
  }).catch(() => true);
}

async function main() {
  const browser = await launch();
  const ctx = await browser.newContext({
    permissions: ['camera', 'microphone'],
    viewport: { width: 430, height: 900 },
  });
  const page = await ctx.newPage();
  const errors = [];
  const consoleErrors = [];
  page.on('pageerror', (e) => errors.push(String(e.message || e)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const t = msg.text();
      // Always keep ErrorBoundary + React errors; drop network/offline noise.
      if (/UI error boundary|Minified React|Cannot read|is not a function|undefined is not|TypeError|ReferenceError/i.test(t)) {
        consoleErrors.push(t.slice(0, 600));
      } else if (!/offline|Failed to get document|postgres_changes|net::ERR|status of (401|404|400)/i.test(t)) {
        consoleErrors.push(t.slice(0, 300));
      }
    }
  });

  const result = { ok: false, steps: [], errors, consoleErrors, blankAt: null };
  const step = (n, note = '') => {
    result.steps.push({ n, note, t: Date.now() });
    console.log('[step]', n, note);
  };

  try {
    await page.goto(`${base}/karaoke?launch=main&as=u1&force_demo=1`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    for (let i = 0; i < 30; i++) {
      await loginIfAuthWall(page);
      const skip = page.getByRole('button', { name: /^skip$/i });
      if (await skip.isVisible().catch(() => false)) await skip.click().catch(() => {});
      if (await page.getByText(/K-Star|Studio|Party Rooms|Trending/i).first().isVisible().catch(() => false)) break;
      await page.waitForTimeout(700);
    }
    await dismissDev(page);
    step('karaoke', (await page.evaluate(() => (document.body.innerText||'').slice(0,60))).replace(/\n/g,' '));

    // Party tab
    await clickByText(page, /^Party Rooms$/i) || await clickByText(page, /^Party$/i);
    await page.waitForTimeout(800);
    await dismissDev(page);
    step('party');

    // Start Room / Create
    await clickByText(page, /Start Room/i) || await clickByText(page, /Create a Room/i) || await clickByText(page, /Create Room/i);
    await page.waitForTimeout(1500);
    await dismissDev(page);
    step('create_room_open', (await page.evaluate(() => (document.body.innerText||'').slice(0,80))).replace(/\n/g,' '));

    if (await rootBlank(page)) { result.blankAt = 'after_create_open'; throw new Error('blank_after_create_open'); }

    // Skip onboarding background upload gate (once), then re-auth if it bounced.
    await page.evaluate(() => {
      const b = Array.from(document.querySelectorAll('button, [role="button"]')).find((x) =>
        /^\s*skip\s*$/i.test((x.textContent || '').trim()),
      );
      b?.click();
    });
    await page.waitForTimeout(1000);
    await loginIfAuthWall(page);
    await dismissDev(page);
    step('after_skip_onboarding', (await page.evaluate(() => (document.body.innerText||'').slice(0,80))).replace(/\n/g,' '));

    // Enable camera in preview if a Video/Camera toggle exists
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      for (const b of btns) {
        const l = `${b.getAttribute('aria-label')||''} ${b.title||''} ${b.textContent||''}`.toLowerCase();
        if (l.includes('camera') || l.includes('video')) { b.click(); return; }
      }
    });
    await page.waitForTimeout(1500);
    await dismissDev(page);

    // Go Live
    await clickByText(page, /^Go Live$/i) || await clickByText(page, /Go Live/i);
    await page.waitForTimeout(4000);
    await loginIfAuthWall(page);
    await dismissDev(page);
    step('went_live', (await page.evaluate(() => (document.body.innerText||'').slice(0,80))).replace(/\n/g,' '));

    if (await rootBlank(page)) { result.blankAt = 'after_go_live'; throw new Error('blank_after_go_live'); }

    // Open beauty tray in room
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      for (const b of btns) {
        const l = `${b.getAttribute('aria-label')||''} ${b.title||''} ${b.textContent||''}`.toLowerCase();
        if (l.includes('beauty') || l.includes('美颜')) { b.click(); return; }
      }
    });
    await page.waitForTimeout(1200);
    await dismissDev(page);
    step('beauty_open');

    if (await rootBlank(page)) { result.blankAt = 'after_beauty_open'; throw new Error('blank_after_beauty_open'); }

    // Tap presets
    for (const label of ['Smooth', 'Soft', 'Glow', 'Natural', 'Clear', 'Off']) {
      const clicked = await page.evaluate((lab) => {
        const btns = Array.from(document.querySelectorAll('button'));
        const b = btns.find((x) => (x.textContent || '').trim().toLowerCase().includes(lab.toLowerCase()));
        if (b) { b.click(); return true; }
        return false;
      }, label);
      await page.waitForTimeout(700);
      const blank = await rootBlank(page);
      step('preset', `${label} clicked=${clicked} blank=${blank}`);
      if (blank) { result.blankAt = `after_preset_${label}`; throw new Error(`blank_after_preset_${label}`); }
    }

    result.ok = errors.length === 0 && consoleErrors.length === 0;
    step('done', result.ok ? 'PASS' : `errors=${errors.length} console=${consoleErrors.length}`);
  } catch (err) {
    result.ok = false;
    result.thrown = err instanceof Error ? err.message : String(err);
    step('error', result.thrown);
  } finally {
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(result, null, 2));
    console.log('\nRESULT', JSON.stringify({
      ok: result.ok,
      thrown: result.thrown,
      blankAt: result.blankAt,
      errors: result.errors.slice(0, 10),
      consoleErrors: result.consoleErrors.slice(0, 10),
    }, null, 2));
    await browser.close();
  }
  process.exit(result.ok ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
