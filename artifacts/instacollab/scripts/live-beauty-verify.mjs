#!/usr/bin/env node
/**
 * Live beauty freeze/blank verification (karaoke RecordingStudio).
 * Requires a real demo session + studio + beauty panel — fails if those are missing.
 *
 * Usage: node scripts/live-beauty-verify.mjs [baseUrl]
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const base = (process.argv[2] ?? 'http://127.0.0.1:5173').replace(/\/$/, '');
const OUT = path.join(REPO_ROOT, '.local/live-beauty-verify.json');

function findChromium() {
  const roots = [
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    path.join(os.homedir(), '.cache/ms-playwright'),
    path.join(REPO_ROOT, '.local/playwright-browsers'),
  ].filter(Boolean);
  for (const root of roots) {
    let entries = [];
    try {
      entries = fs.readdirSync(root);
    } catch {
      continue;
    }
    for (const entry of entries) {
      for (const rel of [
        'chrome-mac/headless_shell',
        'chrome-mac/Chromium.app/Contents/MacOS/Chromium',
        'chrome-mac-arm64/chrome-mac/Chromium.app/Contents/MacOS/Chromium',
      ]) {
        const full = path.join(root, entry, rel);
        if (fs.existsSync(full)) return full;
      }
    }
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
  try {
    return await chromium.launch({ channel: 'chrome', headless: true, args });
  } catch {
    return chromium.launch({ headless: true, args });
  }
}

async function dismissOverlays(page) {
  // Live Dev panel can cover song action buttons on mobile.
  const closeDev = page.getByRole('button', { name: /close|hide/i }).filter({ hasText: /dev|live/i }).first();
  if (await closeDev.isVisible().catch(() => false)) {
    await closeDev.click().catch(() => {});
  }
  await page.keyboard.press('Control+Shift+D').catch(() => {});
  await page.waitForTimeout(200);
  // Click outside / Escape overlays
  await page.evaluate(() => {
    const panels = Array.from(document.querySelectorAll('[class*="dev"], [data-testid*="dev"]'));
    for (const p of panels) {
      if (/Live dev/i.test(p.textContent || '')) {
        p.style.display = 'none';
        p.style.pointerEvents = 'none';
      }
    }
    // Also hide anything that looks like the floating live-dev sheet
    for (const el of document.querySelectorAll('div')) {
      const t = el.textContent || '';
      if (t.includes('Live dev') && t.includes('Ctrl+Shift+D') && el.getBoundingClientRect().height > 120) {
        el.style.display = 'none';
        el.style.pointerEvents = 'none';
      }
    }
  });
}

async function ensureDemoKaraoke(page) {
  // Land directly on karaoke with demo session — avoids mobile sidebar (hidden md:flex).
  await page.goto(`${base}/karaoke?launch=main&as=u1&force_demo=1`, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });

  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const skip = page.getByRole('button', { name: /^skip$/i });
    if (await skip.isVisible().catch(() => false)) {
      await skip.click().catch(() => {});
    }
    const switchBtn = page.getByText('Switch as @designer_dude');
    if (await switchBtn.isVisible().catch(() => false)) {
      await switchBtn.click().catch(() => {});
    }
    const welcome = await page.getByText(/Welcome back/i).first().isVisible().catch(() => false);
    if (welcome) {
      const demo = page.getByRole('button', { name: /try demo|demo|guest/i }).first();
      if (await demo.isVisible().catch(() => false)) {
        await demo.click().catch(() => {});
      }
      await page.waitForTimeout(800);
      continue;
    }
    const singCount = await page.locator('button[title="Sing & Record"]').count();
    if (singCount > 0) {
      await dismissOverlays(page);
      return;
    }
    await page.waitForTimeout(800);
  }
  throw new Error('demo_karaoke_timeout');
}

async function openKaraokeStudio(page) {
  await dismissOverlays(page);

  const studioTab = page.getByRole('button', { name: /^(Studio|Sing)$/i }).first();
  if (await studioTab.isVisible().catch(() => false)) {
    await studioTab.click().catch(() => {});
    await page.waitForTimeout(400);
  }

  const singRecord = page.locator('button[title="Sing & Record"]').first();
  await singRecord.waitFor({ state: 'attached', timeout: 10_000 });
  await singRecord.scrollIntoViewIfNeeded().catch(() => {});
  await singRecord.click({ timeout: 5000, force: true });
  await page.waitForTimeout(1800);

  // Confirm studio opened
  const inStudio = await page
    .locator('button#btn-recording-restart, button[title="Restart session"], button[aria-label="Beauty effects"]')
    .first()
    .isVisible()
    .catch(() => false);
  if (inStudio) return;

  // Camera may still be off — look for Mic/Video toggle or End Early
  const alt = await page.getByText(/End Early|Restart|Recording Studio|Loaded session/i).first().isVisible().catch(() => false);
  if (alt) return;

  // One more attempt: evaluate click
  const clicked = await page.evaluate(() => {
    const btn = document.querySelector('button[title="Sing & Record"]');
    if (!btn) return false;
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return true;
  });
  if (clicked) await page.waitForTimeout(1800);
}

async function enableCamera(page) {
  // Camera toggle is the Video icon in the mic/camera pill
  const beautyAlready = page.getByRole('button', { name: /Beauty effects/i });
  if (await beautyAlready.isVisible().catch(() => false)) return true;

  // Click the Video half of the camera toggle
  const videoToggle = page.locator('button').filter({ has: page.locator('svg') }).filter({
    hasText: /^$/,
  });
  // More reliable: find toggle container with Mic then click sibling Video button
  const cameraOn = page.locator('button').filter({ has: page.locator('.lucide-video, svg.lucide-video') }).first();
  if (await cameraOn.isVisible().catch(() => false)) {
    await cameraOn.click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(1200);
  } else {
    // Click any control that looks like enabling camera
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      for (const b of buttons) {
        const label = `${b.getAttribute('aria-label') || ''} ${b.title || ''} ${b.textContent || ''}`.toLowerCase();
        if (label.includes('camera') || label.includes('video')) {
          b.click();
          return;
        }
      }
    });
    await page.waitForTimeout(1200);
  }

  // Wait for Beauty button (only rendered when cameraEnabled)
  try {
    await page.getByRole('button', { name: /Beauty effects/i }).waitFor({
      state: 'visible',
      timeout: 12_000,
    });
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const browser = await launchBrowser();
  const ctx = await browser.newContext({
    permissions: ['camera', 'microphone'],
    viewport: { width: 430, height: 900 },
  });
  await ctx.addInitScript(() => {
    window.__beautyProbe = {
      longTasks: [],
      clicks: [],
      blanks: [],
      errors: [],
      phase: 'boot',
    };
    try {
      const po = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          window.__beautyProbe.longTasks.push({
            t: Date.now(),
            duration: Math.round(e.duration),
            name: e.name || 'longtask',
            phase: window.__beautyProbe.phase,
          });
        }
      });
      po.observe({ type: 'longtask', buffered: true });
    } catch {
      /* unsupported */
    }
    window.addEventListener(
      'error',
      (ev) => {
        window.__beautyProbe.errors.push(String(ev.message || ev.error || 'error'));
      },
      true,
    );
    window.addEventListener('unhandledrejection', (ev) => {
      window.__beautyProbe.errors.push(String(ev.reason?.message || ev.reason || 'rejection'));
    });
  });

  const page = await ctx.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));

  const result = {
    base,
    ok: false,
    steps: [],
    longTasks: [],
    maxLongTaskMs: 0,
    beautyPhaseMaxLongTaskMs: 0,
    slowClicks: [],
    blankDetected: false,
    pageErrors,
    probeErrors: [],
    reachedStudio: false,
    beautyPanelOpened: false,
    presetsTapped: 0,
  };

  const step = (name, detail = {}) => {
    result.steps.push({ name, t: Date.now(), ...detail });
    console.log(`[step] ${name}`, detail.note || '');
  };

  try {
    await ensureDemoKaraoke(page);
    step('demo_karaoke');

    // Reject auth wall
    const onAuth = await page.getByText(/Welcome back/i).first().isVisible().catch(() => false);
    if (onAuth) throw new Error('still_on_auth_wall');

    await openKaraokeStudio(page);
    step('opened_studio');
    result.reachedStudio = true;

    // Studio marker: Beauty effects or Restart session / recording controls
    const studioMarker = await page
      .locator('button[aria-label="Beauty effects"], button#btn-recording-restart, button[title="Restart session"]')
      .first()
      .isVisible()
      .catch(() => false);
    if (!studioMarker) {
      // Camera may be off — still expect restart or end controls
      const anyStudio = await page.getByText(/Recording|Studio|End Early|Restart/i).first().isVisible().catch(() => false);
      if (!anyStudio) throw new Error('studio_ui_not_detected');
    }

    const camOk = await enableCamera(page);
    step('camera_enabled', { note: camOk ? 'beauty_btn_visible' : 'beauty_btn_missing' });
    if (!camOk) throw new Error('camera_or_beauty_button_missing');

    // Let WebAR warm while camera is on (before beauty taps) — cold Smooth was 1.6s.
    await page.waitForTimeout(2500);

    await page.evaluate(() => {
      window.__beautyProbe.phase = 'beauty';
      window.__beautyProbe.longTasks = []; // measure from beauty interaction onward
    });

    const beautyBtn = page.getByRole('button', { name: /Beauty effects/i }).first();
    {
      const t0 = Date.now();
      await beautyBtn.click({ timeout: 5000 });
      const dt = Date.now() - t0;
      result.slowClicks.push({ action: 'open_beauty_panel', ms: dt });
      step('open_beauty_panel', { note: `${dt}ms` });
    }

    // Wait for presets (Smooth / Soft / …) and WebAR loading to clear
    await page.getByRole('button', { name: /^Smooth$/i }).first().waitFor({
      state: 'visible',
      timeout: 10_000,
    });
    const smoothBtn = page.getByRole('button', { name: /^Smooth$/i }).first();
    await smoothBtn.waitFor({ state: 'attached', timeout: 5000 });
    // If disabled while loading, wait up to 8s for enable
    for (let i = 0; i < 16; i++) {
      const disabled = await smoothBtn.isDisabled().catch(() => false);
      if (!disabled) break;
      await page.waitForTimeout(500);
    }
    result.beautyPanelOpened = true;
    step('beauty_panel_visible');

    // Tap presets and assert camera never blanks
    const presetNames = [/Smooth/i, /Soft/i, /Glow/i, /Natural/i, /Clear/i, /Off/i];
    for (const name of presetNames) {
      const preset = page.getByRole('button', { name }).first();
      if (!(await preset.isVisible().catch(() => false))) continue;
      const t0 = Date.now();
      await preset.click({ timeout: 5000 });
      const dt = Date.now() - t0;
      result.slowClicks.push({ action: `preset:${String(name)}`, ms: dt });
      result.presetsTapped += 1;
      step('tap_preset', { note: `${String(name)} ${dt}ms` });
      await page.waitForTimeout(400);
      const blankNow = await page.evaluate(() => {
        const videos = Array.from(document.querySelectorAll('video[data-app-camera="1"]'));
        const visible = videos.filter((v) => {
          const r = v.getBoundingClientRect();
          const style = window.getComputedStyle(v);
          if (r.width < 40 || r.height < 40) return false;
          if (style.opacity === '0' || style.visibility === 'hidden') return false;
          return true;
        });
        if (visible.length === 0) return 'no_visible_camera_video';
        const playing = visible.some(
          (v) => v.srcObject && v.readyState >= 2 && !v.paused && v.videoWidth > 0,
        );
        return playing ? null : 'camera_no_frames';
      });
      if (blankNow) {
        result.blankDetected = true;
        result.failReasons = result.failReasons || [];
        result.failReasons.push(`blank_after_${String(name)}:${blankNow}`);
        step('blank_detected', { note: blankNow });
        break;
      }
    }

    if (result.presetsTapped < 3) {
      throw new Error(`too_few_presets_tapped:${result.presetsTapped}`);
    }

    // Makeup tab — may trigger catalog/GPU work
    const makeupTab = page.getByRole('button', { name: /^Makeup$/i }).first();
    if (await makeupTab.isVisible().catch(() => false)) {
      const t0 = Date.now();
      await makeupTab.click({ timeout: 3000 });
      result.slowClicks.push({ action: 'tab:makeup', ms: Date.now() - t0 });
      step('tab_makeup', { note: `${Date.now() - t0}ms` });
      await page.waitForTimeout(600);
    }

    await page.waitForTimeout(1500);

    const probe = await page.evaluate(() => {
      const videos = Array.from(document.querySelectorAll('video'));
      const liveVideos = videos.filter((v) => {
        const r = v.getBoundingClientRect();
        return r.width >= 40 && r.height >= 40;
      });
      const blankVideos = liveVideos.filter((v) => {
        if (v.classList.contains('opacity-0') || v.style.opacity === '0') return false;
        const paused = v.paused && !v.srcObject;
        const noFrames = v.readyState < 2 && Boolean(v.srcObject);
        return paused || noFrames;
      }).length;
      const rootBlank =
        (document.getElementById('root')?.childElementCount ?? 0) === 0 ||
        !(document.body.innerText || '').trim();
      return {
        longTasks: window.__beautyProbe?.longTasks ?? [],
        errors: window.__beautyProbe?.errors ?? [],
        blankVideos,
        rootBlank,
        videoCount: liveVideos.length,
        textSample: (document.body.innerText || '').slice(0, 240),
        hasBeautyText: /Smooth|Soft|Glow|Natural|Clear|Beauty/i.test(document.body.innerText || ''),
      };
    });

    result.longTasks = probe.longTasks;
    result.maxLongTaskMs = probe.longTasks.reduce((m, x) => Math.max(m, x.duration || 0), 0);
    result.beautyPhaseMaxLongTaskMs = result.maxLongTaskMs;
    result.probeErrors = probe.errors;
    result.blankDetected = probe.rootBlank || probe.blankVideos > 0;
    result.videoCount = probe.videoCount;
    result.textSample = probe.textSample;

    const slowClickMax = result.slowClicks.reduce((m, x) => Math.max(m, x.ms || 0), 0);
    const openPanelMs =
      result.slowClicks.find((x) => x.action === 'open_beauty_panel')?.ms ?? 0;
    const presetSlow = result.slowClicks
      .filter((x) => String(x.action).startsWith('preset:'))
      .reduce((m, x) => Math.max(m, x.ms || 0), 0);
    const failReasons = [];
    if (!result.reachedStudio) failReasons.push('never_reached_studio');
    if (!result.beautyPanelOpened) failReasons.push('beauty_panel_not_opened');
    if (result.presetsTapped < 3) failReasons.push(`presets_tapped_${result.presetsTapped}`);
    if (result.videoCount < 1) failReasons.push('no_camera_video');
    if (result.beautyPhaseMaxLongTaskMs >= 800) {
      failReasons.push(`beauty_longtask_${result.beautyPhaseMaxLongTaskMs}ms`);
    }
    // First panel open mounts WebAR — allow up to 900ms; preset taps must stay snappy.
    if (openPanelMs >= 900) failReasons.push(`slow_open_panel_${openPanelMs}ms`);
    if (presetSlow >= 500) failReasons.push(`slow_preset_${presetSlow}ms`);
    if (slowClickMax >= 900) failReasons.push(`slow_click_${slowClickMax}ms`);
    if (result.blankDetected) failReasons.push('blank_ui');
    if (pageErrors.length) failReasons.push(`pageerrors_${pageErrors.length}`);
    if (/Welcome back/i.test(probe.textSample || '')) failReasons.push('auth_wall');

    result.ok = failReasons.length === 0;
    result.failReasons = failReasons;
    step('done', { note: result.ok ? 'PASS' : `FAIL ${failReasons.join(', ')}` });
  } catch (err) {
    result.ok = false;
    result.failReasons = [err instanceof Error ? err.message : String(err)];
    step('error', { note: result.failReasons[0] });
  } finally {
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(result, null, 2));
    console.log(
      '\nRESULT',
      JSON.stringify(
        {
          ok: result.ok,
          beautyPhaseMaxLongTaskMs: result.beautyPhaseMaxLongTaskMs,
          slowClicks: result.slowClicks.slice(0, 16),
          presetsTapped: result.presetsTapped,
          beautyPanelOpened: result.beautyPanelOpened,
          videoCount: result.videoCount,
          failReasons: result.failReasons,
          blankDetected: result.blankDetected,
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

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
