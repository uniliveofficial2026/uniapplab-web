#!/usr/bin/env node
/**
 * Capture V14 live-tool panels from the REAL local live-room render path
 * (Room.tsx + RoomFooterTrayActions), not the V13 visual probe.
 *
 * Usage: node scripts/capture-live-tools-v14-screenshots.mjs [baseUrl]
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const outDir = path.join(appRoot, '.local-dev/live-tools-v14-screenshots');
const base = (process.argv[2] ?? process.env.V14_CAPTURE_URL ?? 'http://localhost:5173').replace(/\/$/, '');

const VIEWPORTS = [
  { w: 390, h: 844 },
  { w: 375, h: 812 },
  { w: 430, h: 932 },
];

const PANELS = [
  { id: 'gifts', labels: ['Send gift'] },
  { id: 'guests', labels: ['Guest management'] },
  { id: 'stickers', labels: ['Stickers'] },
  { id: 'voice', labels: ['Voice changer'] },
  { id: 'beauty', labels: ['Beauty', 'Turn on camera for beauty'] },
  { id: 'games', labels: ['Games'] },
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
  return chromium.launch({ headless: true, args });
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
    const close = Array.from(document.querySelectorAll('button')).find((b) => {
      const p = b.closest('div');
      return p && /Live dev/.test(p.textContent || '') && /close|×|x/i.test(b.getAttribute('aria-label') || b.textContent || '');
    });
    close?.click();
  }).catch(() => {});
}

async function clickByText(page, re, timeout = 4000) {
  const btn = page.getByRole('button', { name: re }).first();
  if (await btn.isVisible().catch(() => false)) {
    await btn.click({ timeout }).catch(() => {});
    return true;
  }
  const el = page.getByText(re, { exact: false }).first();
  if (await el.isVisible().catch(() => false)) {
    await el.click({ timeout }).catch(() => {});
    return true;
  }
  return false;
}

async function loginIfAuthWall(page) {
  const tryDemo = page.getByRole('button', { name: /try demo/i }).first();
  if (await tryDemo.isVisible().catch(() => false)) {
    await tryDemo.click({ timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(1500);
    return true;
  }
  return false;
}

async function skipGates(page) {
  for (let i = 0; i < 8; i++) {
    await loginIfAuthWall(page);
    const skip = page.getByRole('button', { name: /skip/i }).first();
    if (await skip.isVisible().catch(() => false)) {
      await skip.click().catch(() => {});
      await page.waitForTimeout(400);
      continue;
    }
    const skipAria = page.getByLabel(/skip onboarding/i).first();
    if (await skipAria.isVisible().catch(() => false)) {
      await skipAria.click().catch(() => {});
      await page.waitForTimeout(400);
      continue;
    }
    break;
  }
}

async function enterLiveRoom(page, notes) {
  // Authenticated local/dev room. Do not use force_demo for final visual validation.
  await page.goto(`${base}/karaoke?launch=main`, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });
  for (let i = 0; i < 25; i++) {
    await skipGates(page);
    await dismissDev(page);
    const ready = await page.getByText(/K-Star|Studio|Party Rooms|Trending|Karaoke/i).first().isVisible().catch(() => false);
    if (ready) break;
    await page.waitForTimeout(600);
  }
  await dismissDev(page);
  notes.push({ step: 'karaoke', url: page.url(), text: (await page.locator('body').innerText().catch(() => '')).slice(0, 120) });

  await clickByText(page, /^Party Rooms$/i) || await clickByText(page, /^Party$/i);
  await page.waitForTimeout(800);
  await dismissDev(page);
  await page.getByRole('button', { name: /Start Room|Create a Room|Create Room/i }).first().waitFor({ timeout: 20000 }).catch(() => {});

  const started =
    (await clickByText(page, /Start Room/i)) ||
    (await clickByText(page, /Create a Room/i)) ||
    (await clickByText(page, /Create Room/i));
  if (!started) {
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('instant-room-open', {
          detail: { path: '/room/create', entry: 'karaoke-party' },
        }),
      );
    }).catch(() => {});
  }
  await page.waitForTimeout(1500);
  await skipGates(page);
  await dismissDev(page);

  if (!(await page.locator('#create-room-name-live, button:has-text("Go Live"), button:has-text("Solo")').count())) {
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('instant-room-open', {
          detail: { path: '/room/create', entry: 'karaoke-party' },
        }),
      );
    }).catch(() => {});
    await page.waitForTimeout(1200);
  }

  notes.push({ step: 'create_or_room', url: page.url() });

  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const solo = btns.find((b) => /^\s*Solo\s*$/i.test((b.textContent || '').trim()));
    solo?.click();
  });
  await page.waitForTimeout(400);

  await page.evaluate(() => {
    const input = document.querySelector('#create-room-name-live, input[placeholder*="vibe"], input[placeholder*="Room"]');
    if (input && 'value' in input && !String(input.value || '').trim()) {
      const proto = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
      proto?.set?.call(input, 'V14 Capture Live');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });

  await clickByText(page, /^Go Live$/i) || await clickByText(page, /Go Live/i) || await clickByText(page, /Launch Room/i);
  await page.waitForTimeout(1200);
  await page.getByLabel(/skip countdown/i).click({ timeout: 1500 }).catch(() => {});
  await page.evaluate(() => {
    const skip = Array.from(document.querySelectorAll('button')).find((b) =>
      /skip countdown|tap to skip/i.test(`${b.getAttribute('aria-label') || ''} ${b.textContent || ''}`),
    );
    skip?.click();
  }).catch(() => {});

  for (let i = 0; i < 20; i++) {
    await dismissDev(page);
    const footer = await page.locator('.room-footer-tray, button[aria-label="Send gift"]').count();
    if (footer > 0 && /\/room\//.test(page.url()) && !/\/room\/create/.test(page.url())) break;
    await page.waitForTimeout(500);
  }

  notes.push({
    step: 'live_room',
    url: page.url(),
    gifts: await page.locator('button[aria-label="Send gift"]').count(),
    guests: await page.locator('button[aria-label="Guest management"]').count(),
    stickers: await page.locator('button[aria-label="Stickers"]').count(),
    games: await page.locator('button[aria-label="Games"]').count(),
    voice: await page.locator('button[aria-label="Voice changer"]').count(),
    beauty: await page.locator('button[aria-label="Beauty"]').count(),
    lt14: await page.locator('.lt14-sheet').count(),
  });
}

async function closeSheets(page) {
  await page.keyboard.press('Escape').catch(() => {});
  await page.evaluate(() => {
    const close = Array.from(document.querySelectorAll('button')).find((b) =>
      /close (gift|guests|sticker|voice|beauty|game)/i.test(b.getAttribute('aria-label') || ''),
    );
    close?.click();
  }).catch(() => {});
  await page.waitForTimeout(250);
}

async function openPanel(page, panel) {
  for (const label of panel.labels) {
    const loc = page.getByRole('button', { name: label, exact: true }).first();
    if (await loc.count()) {
      const disabled = await loc.isDisabled().catch(() => false);
      if (!disabled) {
        await loc.click({ timeout: 2500 }).catch(() => {});
        await page.waitForTimeout(500);
        if (await page.locator('.lt14-sheet').count()) return true;
      }
    }
  }
  if (panel.id === 'beauty') {
    await page.getByRole('button', { name: 'Guest management' }).click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(400);
    const beautify = page.getByRole('button', { name: /Beautify/i }).first();
    if (await beautify.count()) {
      await beautify.click({ timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(500);
      if (await page.locator('.lt14-sheet.lt14-beauty, .lt14-beauty').count()) return true;
    }
  }
  if (panel.id === 'voice') {
    const join = page.getByRole('button', { name: /Join a seat/i }).first();
    if (await join.count()) {
      await join.click({ timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(600);
    }
    const voice = page.getByRole('button', { name: 'Voice changer' }).first();
    if (await voice.count()) {
      await voice.click({ timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(500);
      if (await page.locator('.lt14-sheet').count()) return true;
    }
  }
  return (await page.locator('.lt14-sheet').count()) > 0;
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await launchBrowser();
  const notes = [];

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.w, height: vp.h },
      deviceScaleFactor: 2,
      permissions: ['camera', 'microphone'],
    });
    const page = await context.newPage();
    try {
      if (vp.w === 390) {
        // First viewport pays karaoke/room chunk cost; extra wait before Go Live.
        await page.waitForTimeout(1500);
      }
      await enterLiveRoom(page, notes);
      const overview = path.join(outDir, `live-room-${vp.w}x${vp.h}.png`);
      await page.screenshot({ path: overview, fullPage: false });
      notes.push({ viewport: `${vp.w}x${vp.h}`, overview, url: page.url() });

      for (const panel of PANELS) {
        await closeSheets(page);
        const opened = await openPanel(page, panel);
        await page.waitForTimeout(400);
        const sheet = page.locator('.lt14-sheet').first();
        const outPath = path.join(outDir, `actual-${panel.id}-${vp.w}x${vp.h}.png`);
        if (opened && (await sheet.count())) {
          await page.screenshot({ path: outPath, fullPage: false });
        } else {
          await page.screenshot({ path: outPath, fullPage: false });
        }
        notes.push({
          panel: panel.id,
          viewport: `${vp.w}x${vp.h}`,
          opened,
          sheetCount: await page.locator('.lt14-sheet').count(),
          path: outPath,
        });
        await closeSheets(page);
      }
    } catch (err) {
      notes.push({ viewport: `${vp.w}x${vp.h}`, error: err instanceof Error ? err.message : String(err) });
      await page.screenshot({ path: path.join(outDir, `error-${vp.w}x${vp.h}.png`) }).catch(() => {});
    }
    await context.close();
  }

  await browser.close();
  fs.writeFileSync(path.join(outDir, 'capture-notes.json'), JSON.stringify(notes, null, 2));
  console.log(JSON.stringify(notes, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
