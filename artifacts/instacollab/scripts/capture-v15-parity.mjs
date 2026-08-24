#!/usr/bin/env node
/**
 * Real-context 390×844 V15 parity captures.
 * Guests: solo/guest live → GuestManagementOverlay
 * Gifts/Stickers/Beauty: approved 1v1 PK chrome
 * Voice/Games: same PK room; open Room V14 sheets above PK overlay for capture
 * (does not redesign PK chrome).
 *
 * Usage: node scripts/capture-v15-parity.mjs [baseUrl]
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const outDir = path.join(appRoot, '.local-dev/v15-parity');
const specDir = path.join(appRoot, 'docs/v15-visual-spec');
const base = (process.argv[2] ?? process.env.V15_CAPTURE_URL ?? 'http://localhost:5173').replace(/\/$/, '');
const VW = 390;
const VH = 844;

const SHEETS = {
  guests: '11-guests.json',
  gifts: '09-gifts.json',
  stickers: '10-stickers.json',
  voice: '12-voice.json',
  beauty: '13-beauty.json',
  games: '14-games.json',
};

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

async function newCaptureContext(browser) {
  const context = await browser.newContext({
    viewport: { width: VW, height: VH },
    deviceScaleFactor: 1,
    permissions: ['camera', 'microphone'],
    colorScheme: 'dark',
  });
  await context.addInitScript(() => {
    try {
      localStorage.setItem('instacollab_dev_panel_open', '0');
    } catch {
      /* ignore */
    }
  });
  return context;
}

async function dismissDev(page) {
  await page.getByRole('button', { name: 'Hide panel' }).click({ timeout: 800 }).catch(() => {});
  await page.evaluate(() => {
    try {
      localStorage.setItem('instacollab_dev_panel_open', '0');
      window.dispatchEvent(new CustomEvent('dev-panel-close'));
    } catch {
      /* ignore */
    }
    for (const el of document.querySelectorAll('div')) {
      const t = el.textContent || '';
      if (t.includes('Live dev') && (t.includes('Switch as') || t.includes('Ctrl+Shift+D'))) {
        el.style.display = 'none';
        el.style.pointerEvents = 'none';
      }
    }
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

async function skipGates(page) {
  for (let i = 0; i < 12; i += 1) {
    await dismissDev(page);
    const skipped = await page.evaluate(() => {
      const skip =
        document.querySelector('[aria-label="Skip onboarding"]') ||
        Array.from(document.querySelectorAll('button')).find((b) => /skip/i.test(b.getAttribute('aria-label') || b.textContent || ''));
      if (skip) {
        skip.click();
        return 'skip';
      }
      const next = document.querySelector('[aria-label="Next"]');
      if (next) {
        next.click();
        return 'next';
      }
      const demo = Array.from(document.querySelectorAll('button')).find((b) => /try demo/i.test(b.getAttribute('aria-label') || b.textContent || ''));
      if (demo) {
        demo.click();
        return 'demo';
      }
      return null;
    }).catch(() => null);
    if (skipped) {
      await page.waitForTimeout(500);
      continue;
    }
    break;
  }
}

async function loginEmail(page, email, password, notes) {
  await page.goto(`${base}/karaoke?launch=main`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(6000);
  await dismissDev(page);
  await skipGates(page);
  for (let i = 0; i < 20; i += 1) {
    await dismissDev(page);
    await page.waitForTimeout(350);
    await page.evaluate(() => {
      const actions = document.querySelector('[data-unilives-princess-actions]');
      if (actions && actions.getAttribute('data-agreed') !== 'true') {
        document.querySelector('[data-unilives-legal-agree]')?.click();
      }
    }).catch(() => {});
    await page.waitForTimeout(150);
    const welcomeState = await page.evaluate(() => ({
      agreed: document.querySelector('[data-unilives-princess-actions]')?.getAttribute('data-agreed') || null,
      hasEmail: Boolean(document.querySelector('[aria-label="Sign Up with Email"]')),
    })).catch(() => ({ agreed: null, hasEmail: false }));
    if (welcomeState.hasEmail) {
      await page.evaluate(() => {
        document.querySelector('[aria-label="Sign Up with Email"]')?.click();
      }).catch(() => {});
      await page.waitForTimeout(500);
    }
    const signInTab = page.getByRole('button', { name: /^sign in$/i }).first();
    if (await signInTab.isVisible().catch(() => false)) {
      await signInTab.click().catch(() => {});
      await page.waitForTimeout(250);
    }
    const logInLink = page.getByRole('button', { name: /^log in$/i }).first();
    if (await logInLink.isVisible().catch(() => false)) {
      const signupCta = await page.getByRole('button', { name: /^sign up$/i }).count();
      if (signupCta) {
        await logInLink.click().catch(() => {});
        await page.waitForTimeout(400);
      }
    }
    if (email.startsWith('demo@')) {
      const demo = page.getByRole('button', { name: /try demo/i }).first();
      if (await demo.isVisible().catch(() => false)) {
        await demo.click({ timeout: 4000 }).catch(() => {});
        await page.waitForTimeout(1600);
        break;
      }
    }
    const emailBox = page.locator('input[type="email"], input[autocomplete="email"]').first();
    const onSignup = (await page.getByRole('button', { name: /^sign up$/i }).count()) > 0;
    if (!onSignup && (await emailBox.isVisible().catch(() => false))) {
      await emailBox.fill(email).catch(() => {});
      await page.locator('input[type="password"]').first().fill(password).catch(() => {});
      await clickByText(page, /^Log in$/i);
      await page.waitForTimeout(1600);
      break;
    }
    const karaoke = await page.getByText(/K-Star|Party Rooms|Trending/i).first().isVisible().catch(() => false);
    if (karaoke) break;
  }
  await skipGates(page);
  await dismissDev(page);
  notes.push({
    step: 'after_login',
    email,
    url: page.url(),
    welcomeState: await page.evaluate(() => ({
      agreed: document.querySelector('[data-unilives-princess-actions]')?.getAttribute('data-agreed') || null,
      title: document.title,
      buttons: Array.from(document.querySelectorAll('button')).slice(0, 12).map((b) => b.getAttribute('aria-label') || (b.textContent || '').trim().slice(0, 40)),
    })).catch(() => null),
    text: (await page.locator('body').innerText().catch(() => '')).slice(0, 280),
  });
  await page.screenshot({ path: path.join(outDir, `debug-login-${email.split('@')[0]}.png`), fullPage: false }).catch(() => {});
}

async function readLiveDiagnostics(page) {
  return page.evaluate(() => {
    const parseStored = (key) => {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      try {
        const parsed = JSON.parse(raw);
        return typeof parsed === 'string' ? parsed : String(parsed);
      } catch {
        return raw.replace(/^"|"$/g, '');
      }
    };
    const pkBtn = document.querySelector('button[aria-label="PK battle"]');
    const soloLive = Boolean(document.querySelector('.solo-live-layout, .solo-live-shell'));
    const createForm = document.querySelector('#create-room-name-live');
    const onCreateScreen = Boolean(createForm && createForm.offsetParent);
    return {
      url: location.href,
      userId: parseStored('currentUserId'),
      roomId: parseStored('activeRoomId'),
      liveMode: soloLive ? 'SoloLive' : null,
      roomMounted: Boolean(document.querySelector('[data-instant-room-entry], .solo-live-layout, .room-footer-tray')),
      soloLive,
      onCreateScreen,
      pkButtonExists: Boolean(pkBtn),
      pkButtonDisabled: pkBtn
        ? pkBtn.hasAttribute('disabled') || pkBtn.getAttribute('aria-disabled') === 'true'
        : null,
      pkSetupOpen: Boolean(document.querySelector('[data-ui-id="live.pk.setup.overlay"]')),
      footerExists: Boolean(document.querySelector('.room-footer-tray')),
    };
  });
}

async function waitForLiveRoom(page, timeoutMs = 120_000) {
  await page.waitForFunction(
    () => {
      const pkBtn = document.querySelector('button[aria-label="PK battle"]');
      const footer = document.querySelector('.room-footer-tray');
      const soloLive = document.querySelector('.solo-live-layout, .solo-live-shell');
      const createForm = document.querySelector('#create-room-name-live');
      const onCreate = Boolean(createForm && createForm.offsetParent);
      const raw = localStorage.getItem('activeRoomId');
      const roomId = raw ? raw.replace(/^"|"$/g, '') : '';
      return Boolean(pkBtn && footer && soloLive && roomId && !onCreate);
    },
    { timeout: timeoutMs },
  );
}

async function skipCountdownIfPresent(page) {
  await page.getByLabel(/skip countdown/i).click({ timeout: 1500 }).catch(() => {});
  await page
    .evaluate(() => {
      const skip = Array.from(document.querySelectorAll('button')).find((b) =>
        /skip countdown|tap to skip/i.test(`${b.getAttribute('aria-label') || ''} ${b.textContent || ''}`),
      );
      skip?.click();
    })
    .catch(() => {});
}

async function enterSoloLive(page, notes, roomName) {
  await page.goto(`${base}/karaoke?launch=main`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page
    .waitForFunction(
      () => /K-Star|Studio|Party Rooms|Trending|Karaoke/i.test(document.body.innerText || ''),
      { timeout: 30_000 },
    )
    .catch(() => {});
  await skipGates(page);
  await dismissDev(page);
  await clickByText(page, /^Party Rooms$/i) || (await clickByText(page, /^Party$/i));
  await page
    .waitForFunction(
      () =>
        Array.from(document.querySelectorAll('button')).some((b) =>
          /Start Room|Create a Room|Create Room/i.test(b.textContent || ''),
        ),
      { timeout: 15_000 },
    )
    .catch(() => {});
  const started =
    (await clickByText(page, /Start Room/i)) ||
    (await clickByText(page, /Create a Room/i)) ||
    (await clickByText(page, /Create Room/i));
  if (!started) {
    await page
      .evaluate(() => {
        window.dispatchEvent(
          new CustomEvent('instant-room-open', { detail: { path: '/room/create', entry: 'karaoke-party' } }),
        );
      })
      .catch(() => {});
    await page
      .waitForFunction(
        () =>
          Boolean(
            document.querySelector('#create-room-name-live, input[placeholder*="vibe"], input[placeholder*="Room"]'),
          ),
        { timeout: 10_000 },
      )
      .catch(() => {});
  }
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const solo = btns.find((b) => /^\s*Solo\s*$/i.test((b.textContent || '').trim()));
    solo?.click();
  });
  await page
    .waitForFunction(
      () =>
        Boolean(
          document.querySelector('#create-room-name-live, input[placeholder*="vibe"], input[placeholder*="Room"]'),
        ),
      { timeout: 8000 },
    )
    .catch(() => {});
  await page.evaluate((name) => {
    const input = document.querySelector('#create-room-name-live, input[placeholder*="vibe"], input[placeholder*="Room"]');
    if (input && 'value' in input) {
      const proto = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
      proto?.set?.call(input, name);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, roomName);
  await clickByText(page, /^Go Live$/i) || (await clickByText(page, /Go Live/i)) || (await clickByText(page, /Launch Room/i));
  await page
    .waitForFunction(
      () =>
        Boolean(
          Array.from(document.querySelectorAll('button')).find((b) =>
            /skip countdown|tap to skip|countdown/i.test(`${b.getAttribute('aria-label') || ''} ${b.textContent || ''}`),
          ) || document.querySelector('.solo-live-layout, .solo-live-shell'),
        ),
      { timeout: 20_000 },
    )
    .catch(() => {});
  await skipCountdownIfPresent(page);

  let diag = null;
  let ok = false;
  let failures = [];
  try {
    await waitForLiveRoom(page, 120_000);
    diag = await readLiveDiagnostics(page);
    failures = [];
    if (!diag.userId) failures.push('missing user_id');
    if (!diag.soloLive) failures.push('SoloLiveView not mounted');
    if (diag.onCreateScreen) failures.push('still on create-room screen');
    if (!diag.roomId) failures.push('missing roomId');
    if (!diag.footerExists) failures.push('footer missing');
    if (!diag.pkButtonExists) failures.push('PK button missing');
    if (diag.pkButtonDisabled) failures.push('PK button disabled');
    const inLiveRoom = diag.soloLive && !diag.onCreateScreen && Boolean(diag.roomId);
    if (!inLiveRoom) failures.push('not in live room');
    ok = failures.length === 0;
  } catch (err) {
    diag = await readLiveDiagnostics(page);
    failures = [`waitForLiveRoom: ${err instanceof Error ? err.message : String(err)}`];
  }
  notes.push({ step: 'live_room', roomName, ok, failures, diag });
  if (!ok) {
    console.error('[enterSoloLive FAIL]', roomName, failures, diag);
  }
  return ok;
}

async function closeSheets(page) {
  await page.keyboard.press('Escape').catch(() => {});
  await page.evaluate(() => {
    const close = Array.from(document.querySelectorAll('button')).find((b) =>
      /close (gift|guests|sticker|voice|beauty|game)/i.test(b.getAttribute('aria-label') || ''),
    );
    close?.click();
  }).catch(() => {});
  await page.waitForTimeout(200);
}

async function raiseV15Sheets(page) {
  await page.evaluate(() => {
    document.querySelectorAll('.lt15-overlay, .lt15-sheet').forEach((el) => {
      el.style.zIndex = '20000';
    });
  }).catch(() => {});
}

async function openGuests(page) {
  const loc = page.getByRole('button', { name: 'Guest management' }).first();
  if (await loc.count()) await loc.click({ timeout: 2500 }).catch(() => {});
  await page.waitForTimeout(500);
  return (await page.locator('.lt15-sheet.lt15-guests, .lt15-overlay--guests .lt15-sheet').count()) > 0;
}

async function openPkPanel(page, id) {
  await closeSheets(page);
  if (id === 'gifts') {
    await page.locator('[data-ui-id="live.pk.1v1.action.gift"]').first().click({ timeout: 2500 }).catch(() => {});
  } else if (id === 'stickers') {
    await page.locator('[data-ui-id="live.pk.1v1.action.sticker"]').first().click({ timeout: 2500 }).catch(() => {});
  } else if (id === 'beauty') {
    await page.locator('[data-ui-id="live.pk.1v1.action.beauty"]').first().click({ timeout: 2500 }).catch(() => {});
  } else if (id === 'voice') {
    await page.getByRole('button', { name: 'Voice changer' }).first().click({ force: true, timeout: 2500 }).catch(() => {});
  } else if (id === 'games') {
    await page.getByRole('button', { name: 'Games' }).first().click({ force: true, timeout: 2500 }).catch(() => {});
  }
  await page.waitForTimeout(600);
  await raiseV15Sheets(page);
  return (await page.locator('.lt15-sheet').count()) > 0;
}

async function connectPk(hostPage, guestPage, notes, guestUserId) {
  await hostPage.getByRole('button', { name: 'PK battle' }).first().click({ timeout: 4000 }).catch(() => {});
  await hostPage.waitForSelector('[data-ui-id="live.pk.setup.overlay"]', { timeout: 8000 }).catch(() => {});
  await hostPage.getByRole('button', { name: /^Start PK$/i }).first().click({ timeout: 4000 }).catch(() => {});
  await hostPage.waitForSelector('[data-ui-id="live.pk.invite.panel"]', { timeout: 8000 }).catch(() => {});

  let found = null;
  for (let i = 0; i < 24; i += 1) {
    const rows = await hostPage.locator('[data-pk-host-user-id]').evaluateAll((els) =>
      els.map((el) => ({
        userId: el.getAttribute('data-pk-host-user-id'),
        text: (el.textContent || '').slice(0, 80),
      })),
    );
    found =
      rows.find((row) => row.userId && row.userId === guestUserId) ||
      rows.find((row) => /sarah|creative/i.test(row.text || '')) ||
      rows[0];
    if (found?.userId) break;
    await hostPage.waitForTimeout(1000);
  }
  if (!found?.userId) {
    notes.push({ step: 'pk_invite', error: 'host_discovery_empty' });
    return false;
  }

  await hostPage.locator(`[data-pk-host-user-id="${found.userId}"]`).first().click({ timeout: 3000 }).catch(() => {});
  await hostPage.getByRole('button', { name: /^Continue$/i }).first().click({ timeout: 2500 }).catch(() => {});
  await hostPage.waitForSelector('[data-ui-id="live.pk.confirm.panel"]', { timeout: 8000 }).catch(() => {});
  await hostPage.getByRole('button', { name: /^Send Challenge$/i }).first().click({ timeout: 2500 }).catch(() => {});

  notes.push({
    step: 'pk_invite',
    found,
    hostText: (await hostPage.locator('body').innerText().catch(() => '')).slice(0, 240),
  });

  for (let i = 0; i < 30; i += 1) {
    const accept = guestPage.getByRole('button', { name: /Accept PK/i }).first();
    if (await accept.isVisible().catch(() => false)) {
      await accept.click({ timeout: 3000 }).catch(() => {});
      break;
    }
    await guestPage.waitForTimeout(500);
  }
  await hostPage.waitForTimeout(2500);
  const pk = await hostPage.locator('[data-testid="one-vs-one-pk-room"], [data-ui-id="live.pk.1v1.room"]').count();
  notes.push({ step: 'pk_active', pkRoom: pk });
  return pk > 0;
}

async function shot(page, dest) {
  await dismissDev(page);
  await page.screenshot({ path: dest, fullPage: false });
}

function sheetMask(panel) {
  const spec = JSON.parse(fs.readFileSync(path.join(specDir, SHEETS[panel]), 'utf8'));
  const top = Math.round((spec.sheet?.n?.y ?? 0) * VH);
  const height = Math.round((spec.sheet?.n?.h ?? 1) * VH);
  return { top, bottom: Math.min(VH, top + height) };
}

async function writeCompare(panel) {
  const refPath = path.join(outDir, `${panel}-reference.png`);
  const actPath = path.join(outDir, `${panel}-actual.png`);
  if (!fs.existsSync(refPath) || !fs.existsSync(actPath)) return false;
  const ref = await sharp(refPath).resize(VW, VH, { fit: 'fill' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const act = await sharp(actPath).resize(VW, VH, { fit: 'fill' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const n = VW * VH * 4;
  const overlay = Buffer.alloc(n);
  const diff = Buffer.alloc(n);
  const { top, bottom } = sheetMask(panel);
  for (let i = 0; i < n; i += 4) {
    const px = (i / 4) | 0;
    const y = (px / VW) | 0;
    const outside = y < top || y >= bottom;
    overlay[i] = Math.round(ref.data[i] * 0.5 + act.data[i] * 0.5);
    overlay[i + 1] = Math.round(ref.data[i + 1] * 0.5 + act.data[i + 1] * 0.5);
    overlay[i + 2] = Math.round(ref.data[i + 2] * 0.5 + act.data[i + 2] * 0.5);
    overlay[i + 3] = 255;
    if (outside) {
      diff[i] = 0;
      diff[i + 1] = 0;
      diff[i + 2] = 0;
      diff[i + 3] = 255;
      continue;
    }
    diff[i] = Math.abs(ref.data[i] - act.data[i]);
    diff[i + 1] = Math.abs(ref.data[i + 1] - act.data[i + 1]);
    diff[i + 2] = Math.abs(ref.data[i + 2] - act.data[i + 2]);
    diff[i + 3] = 255;
  }
  await sharp(overlay, { raw: { width: VW, height: VH, channels: 4 } }).png().toFile(path.join(outDir, `${panel}-overlay.png`));
  await sharp(diff, { raw: { width: VW, height: VH, channels: 4 } }).png().toFile(path.join(outDir, `${panel}-diff.png`));
  return true;
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const notes = [];
  const browser = await launchBrowser();

  const hostCtx = await newCaptureContext(browser);
  const host = await hostCtx.newPage();
  await loginEmail(host, 'demo@unilive.app', 'demo123', notes);
  const hostLive = await enterSoloLive(host, notes, 'V15 Parity Host');
  if (!hostLive) {
    fs.writeFileSync(path.join(outDir, 'capture-notes.json'), JSON.stringify({ notes, error: 'host_a_go_live_failed' }, null, 2));
    await browser.close();
    process.exit(1);
  }

  const guestsOpened = await openGuests(host);
  await raiseV15Sheets(host);
  await shot(host, path.join(outDir, 'guests-actual.png'));
  notes.push({ panel: 'guests', opened: guestsOpened, pk: false });
  await closeSheets(host);

  const guestCtx = await newCaptureContext(browser);
  const guest = await guestCtx.newPage();
  await loginEmail(guest, 'sarah@unilive.app', 'demo123', notes);
  const guestLive = await enterSoloLive(guest, notes, 'V15 Parity Opponent');
  const guestUserId = await guest.evaluate(() => localStorage.getItem('currentUserId')).catch(() => null);

  const pk = guestLive ? await connectPk(host, guest, notes, guestUserId) : false;
  notes.push({ pk });
  if (pk) {
    await shot(host, path.join(outDir, '1v1-actual.png'));
    await shot(host, path.join(outDir, 'pk-setup-actual.png'));
  }

  for (const id of ['gifts', 'stickers', 'voice', 'beauty', 'games']) {
    const opened = pk ? await openPkPanel(host, id) : false;
    await shot(host, path.join(outDir, `${id}-actual.png`));
    notes.push({
      panel: id,
      opened,
      pk,
      sheetCount: await host.locator('.lt15-sheet').count(),
      pkRoom: await host.locator('[data-testid="one-vs-one-pk-room"]').count(),
    });
    await closeSheets(host);
  }

  await hostCtx.close();
  await guestCtx.close();
  await browser.close();

  const compares = {};
  for (const id of Object.keys(SHEETS)) {
    compares[id] = await writeCompare(id);
  }
  fs.writeFileSync(path.join(outDir, 'capture-notes.json'), JSON.stringify({ notes, compares, base }, null, 2));
  console.log(JSON.stringify({ notes, compares }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
