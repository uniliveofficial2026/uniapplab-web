#!/usr/bin/env node
/**
 * Real two-account PK activation + 390×844 V15 parity captures.
 * Deterministic live entry (instant-room overlay OR /room/:id). No probes/fake PK.
 *
 * Usage: node scripts/capture-v15-pk-parity.mjs [baseUrl]
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const parityRoot = path.join(appRoot, '.local-dev/v15-parity');
const specDir = path.join(appRoot, 'docs/v15-visual-spec');
const base = (process.argv[2] ?? process.env.V15_CAPTURE_URL ?? 'http://localhost:5173').replace(/\/$/, '');
const VW = 390;
const VH = 844;

function loggedInUserIdFor(email) {
  if (email.startsWith('demo@')) return 'u1';
  if (email.startsWith('sarah@')) return 'u2';
  return null;
}

async function readStoredUserId(page) {
  return page.evaluate(() => {
    const loggedInRaw = localStorage.getItem('isLoggedIn');
    const loggedIn = loggedInRaw === 'true' || loggedInRaw === true;
    if (!loggedIn) return null;
    const raw = localStorage.getItem('currentUserId');
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed === 'string' ? parsed : String(parsed);
    } catch {
      return raw.replace(/^"|"$/g, '');
    }
  });
}

function lifecycleRoomId(id) {
  const value = String(id || '').trim();
  if (value.startsWith('api-stream-')) return value.slice('api-stream-'.length);
  if (value.startsWith('stream-')) return value.slice('stream-'.length);
  return value;
}

async function waitForLiveApi(timeoutMs = 45_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch('http://127.0.0.1:5001/api/health');
      if (res.ok) return true;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error('PK HOST DISCOVERY FAILED: local live API http://127.0.0.1:5001 is not listening');
}

async function forceLocalDemoLogin(page, email, password) {
  try {
    return await page.evaluate(
      async ({ loginEmail, loginPassword }) => {
        const mod = await import('/src/lib/auth/localDemoAuth.ts');
        return mod.loginDemoAccountLocal(loginEmail, loginPassword);
      },
      { loginEmail: email, loginPassword: password },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!/Execution context was destroyed|navigation/i.test(message)) {
      throw err;
    }
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    await page.waitForTimeout(800);
    const userId = await readStoredUserId(page);
    return userId ? { ok: true, recoveredAfterNavigation: true } : { ok: false, reason: message };
  }
}

async function loginViaUi(page, email, password) {
  for (let i = 0; i < 20; i += 1) {
    await page.evaluate(() => {
      document.querySelector('[data-unilives-legal-agree]')?.click();
      document.querySelector('[aria-label="Sign Up with Email"]')?.click();
    }).catch(() => {});
    const signInTab = page.getByRole('button', { name: /^sign in$/i }).first();
    if (await signInTab.isVisible().catch(() => false)) {
      await signInTab.click({ timeout: 2000 }).catch(() => {});
    }
    const logInLink = page.getByRole('button', { name: /^log in$/i }).first();
    if (await logInLink.isVisible().catch(() => false)) {
      await logInLink.click({ timeout: 2000 }).catch(() => {});
    }
    const emailBox = page.locator('input[type="email"], input[autocomplete="email"]').first();
    if (await emailBox.isVisible().catch(() => false)) {
      await emailBox.fill(email);
      await page.locator('input[type="password"]').first().fill(password);
      await page.getByRole('button', { name: /^Log in$/i }).first().click({ timeout: 5000 }).catch(() => {});
      break;
    }
    await page.waitForTimeout(500);
  }
  await page
    .waitForFunction(
      () => /K-Star|Party Rooms|Trending|Karaoke/i.test(document.body.innerText || ''),
      null,
      { timeout: 30_000 },
    )
    .catch(() => {});
}

const SCREEN_DIRS = {
  pkSetup: '02-pk-setup',
  '1v1': '03-1v1',
  '2v2': '04-2v2',
  '3v3': '05-3v3',
  '4v4': '06-4v4',
  '6v6': '07-6v6',
  liveSell: '08-live-sell-pk',
};

const SETUP_STATES = [
  { type: '1v1', dir: '01-1v1', tab: '1v1' },
  { type: '2v2', dir: '02-2v2', tab: '2v2' },
  { type: '3v3', dir: '03-3v3', tab: '3v3' },
  { type: '4v4', dir: '04-4v4', tab: '4v4' },
  { type: '6v6', dir: '05-6v6', tab: '6v6' },
  { type: 'live-sell', dir: '06-live-sell', tab: 'live-sell' },
  { type: 'invite', dir: '07-invite' },
  { type: 'duration', dir: '08-duration' },
  { type: 'random', dir: '09-random' },
  { type: 'confirmation', dir: '10-confirmation' },
];

const ONE_V1_REGIONS = {
  header: { x: 0, y: 0, w: 1, h: 0.08 },
  scoreRail: { x: 0.04, y: 0.08, w: 0.92, h: 0.04 },
  timer: { x: 0.38, y: 0.12, w: 0.24, h: 0.045 },
  leftTileChrome: { x: 0, y: 0.58, w: 0.5, h: 0.08 },
  rightTileChrome: { x: 0.5, y: 0.58, w: 0.5, h: 0.08 },
  chat: { x: 0.02, y: 0.78, w: 0.62, h: 0.12 },
  endPk: { x: 0.68, y: 0.78, w: 0.3, h: 0.06 },
  composer: { x: 0.02, y: 0.925, w: 0.42, h: 0.06 },
  bottomControls: { x: 0.44, y: 0.925, w: 0.54, h: 0.06 },
};

function loadSetupRefMap() {
  const p = path.join(appRoot, 'docs/v15-visual-spec/pk-setup-reference-map.json');
  if (!fs.existsSync(p)) return { states: [] };
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}
const DYNAMIC_MASKS = {
  '03-1v1': [
    { x: 0, y: 0.13, w: 0.498, h: 0.44 },
    { x: 0.502, y: 0.13, w: 0.498, h: 0.44 },
    { x: 0.04, y: 0.082, w: 0.18, h: 0.028 },
    { x: 0.78, y: 0.082, w: 0.18, h: 0.028 },
    { x: 0.42, y: 0.118, w: 0.16, h: 0.028 },
    { x: 0.04, y: 0.8, w: 0.6, h: 0.09 },
    { x: 0.62, y: 0.012, w: 0.16, h: 0.04 },
  ],
  '04-2v2': [
    { x: 0, y: 0.12, w: 0.5, h: 0.66 },
    { x: 0.5, y: 0.12, w: 0.5, h: 0.66 },
    { x: 0.04, y: 0.086, w: 0.22, h: 0.055 },
    { x: 0.74, y: 0.086, w: 0.22, h: 0.055 },
    { x: 0.42, y: 0.086, w: 0.16, h: 0.055 },
    { x: 0.04, y: 0.79, w: 0.92, h: 0.11 },
  ],
  '05-3v3': [
    { x: 0, y: 0.12, w: 0.5, h: 0.66 },
    { x: 0.5, y: 0.12, w: 0.5, h: 0.66 },
    { x: 0.04, y: 0.086, w: 0.22, h: 0.055 },
    { x: 0.74, y: 0.086, w: 0.22, h: 0.055 },
    { x: 0.42, y: 0.086, w: 0.16, h: 0.055 },
    { x: 0.04, y: 0.79, w: 0.92, h: 0.11 },
  ],
  '06-4v4': [
    { x: 0, y: 0.12, w: 0.5, h: 0.66 },
    { x: 0.5, y: 0.12, w: 0.5, h: 0.66 },
    { x: 0.04, y: 0.086, w: 0.22, h: 0.055 },
    { x: 0.74, y: 0.086, w: 0.22, h: 0.055 },
    { x: 0.42, y: 0.086, w: 0.16, h: 0.055 },
    { x: 0.04, y: 0.79, w: 0.92, h: 0.11 },
  ],
  '07-6v6': [
    { x: 0, y: 0.12, w: 0.5, h: 0.66 },
    { x: 0.5, y: 0.12, w: 0.5, h: 0.66 },
    { x: 0.04, y: 0.086, w: 0.22, h: 0.055 },
    { x: 0.74, y: 0.086, w: 0.22, h: 0.055 },
    { x: 0.42, y: 0.086, w: 0.16, h: 0.055 },
    { x: 0.04, y: 0.79, w: 0.92, h: 0.11 },
  ],
  '08-live-sell-pk': [
    { x: 0, y: 0.14, w: 0.475, h: 0.5 },
    { x: 0.525, y: 0.14, w: 0.475, h: 0.5 },
    { x: 0.04, y: 0.086, w: 0.22, h: 0.055 },
    { x: 0.74, y: 0.086, w: 0.22, h: 0.055 },
    { x: 0.42, y: 0.086, w: 0.16, h: 0.055 },
    { x: 0.04, y: 0.68, w: 0.92, h: 0.08 },
  ],
  '02-pk-setup': [
    { x: 0.08, y: 0.18, w: 0.84, h: 0.55 },
  ],
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

async function newContext(browser) {
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

async function skipGates(page, { allowDemo = true } = {}) {
  for (let i = 0; i < 12; i += 1) {
    await dismissDev(page);
    const skipped = await page
      .evaluate((allowDemoClick) => {
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
        if (allowDemoClick) {
          const demo = Array.from(document.querySelectorAll('button')).find((b) =>
            /try demo/i.test(b.getAttribute('aria-label') || b.textContent || ''),
          );
          if (demo) {
            demo.click();
            return 'demo';
          }
        }
        return null;
      }, allowDemo)
      .catch(() => null);
    if (skipped) {
      await page.waitForTimeout(500);
      continue;
    }
    break;
  }
}

function attachNet(page, bucket) {
  page.on('response', async (res) => {
    const url = res.url();
    if (!/\/api\/live\//.test(url)) return;
    let body = null;
    try {
      body = await res.json();
    } catch {
      body = await res.text().catch(() => null);
    }
    bucket.push({
      status: res.status(),
      method: res.request().method(),
      url: url.replace(base, ''),
      body:
        body && typeof body === 'object'
          ? JSON.parse(JSON.stringify(body, (key, value) => (/token|authorization|secret/i.test(key) ? '[redacted]' : value)))
          : String(body || '').slice(0, 400),
    });
  });
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
    const instant = document.querySelector('[data-instant-room-entry]');
    const roomPath = instant?.getAttribute('data-room-path') || '';
    const onRoomRoute = /\/room\/[^/]+/.test(location.pathname) && !/\/room\/create/.test(location.pathname);
    const roomId = parseStored('activeRoomId');
    const loggedIn = localStorage.getItem('isLoggedIn') === 'true';
    const userId = loggedIn ? parseStored('currentUserId') : null;
    const footer = document.querySelector('.room-footer-tray');
    const soloLive = Boolean(document.querySelector('.solo-live-layout, .solo-live-shell'));
    const createForm = document.querySelector('#create-room-name-live');
    const onCreateScreen = Boolean(createForm && (createForm.closest('[data-instant-room-entry]') || createForm.offsetParent));
    return {
      url: location.href,
      userId,
      roomId,
      liveMode: /Shop Live/i.test(document.body?.innerText || '') ? 'CommerceLive' : soloLive ? 'SoloLive' : null,
      shopLive: /Shop Live/i.test(document.body?.innerText || ''),
      roomMounted: Boolean(instant || soloLive || footer),
      onRoomRoute,
      instantRoom: Boolean(instant),
      roomPath,
      soloLive,
      onCreateScreen,
      pkButtonExists: Boolean(pkBtn),
      pkButtonDisabled: pkBtn
        ? pkBtn.hasAttribute('disabled') || pkBtn.getAttribute('aria-disabled') === 'true'
        : null,
      pkSetupOpen: Boolean(document.querySelector('[data-ui-id="live.pk.setup.overlay"]')),
      footerExists: Boolean(footer),
      countdownVisible: Boolean(
        Array.from(document.querySelectorAll('button')).find((b) =>
          /skip countdown|tap to skip/i.test(`${b.getAttribute('aria-label') || ''} ${b.textContent || ''}`),
        ),
      ),
    };
  });
}

async function assertLivePrerequisites(page, label, expectCommerce = false) {
  const diag = await readLiveDiagnostics(page);
  const failures = [];
  if (!diag.userId) failures.push('missing authenticated user_id');
  if (!diag.roomMounted) failures.push('Room shell not mounted');
  if (!diag.soloLive) failures.push('SoloLiveView not mounted');
  if (diag.onCreateScreen) failures.push('still on create-room screen');
  if (!diag.roomId) failures.push('missing canonical roomId');
  if (!diag.footerExists) failures.push('live footer tray missing');
  if (!diag.pkButtonExists) failures.push('PK button missing');
  if (diag.pkButtonDisabled) failures.push('PK button disabled');
  if (expectCommerce && !diag.shopLive) failures.push('commerce/live-sell mode not active');
  const inLiveRoom = diag.soloLive && !diag.onCreateScreen && Boolean(diag.roomId);
  if (!inLiveRoom) failures.push('live session not active');
  return { ok: failures.length === 0, diag, failures, label };
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
    null,
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
  await page
    .waitForFunction(
      () =>
        !Array.from(document.querySelectorAll('button')).some((b) =>
          /skip countdown|tap to skip/i.test(`${b.getAttribute('aria-label') || ''} ${b.textContent || ''}`),
        ),
      null,
      { timeout: 8000 },
    )
    .catch(() => {});
}

async function loginEmail(page, email, password, notes) {
  await page.goto(`${base}/karaoke?launch=main`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForSelector('body', { timeout: 15_000 });
  await dismissDev(page);
  await skipGates(page, { allowDemo: false });

  await page
    .waitForFunction(
      () =>
        Boolean(
          document.querySelector('[aria-label="Sign Up with Email"]') ||
            document.querySelector('input[type="email"]') ||
            Array.from(document.querySelectorAll('button')).some((b) => /try demo/i.test(b.textContent || '')) ||
            /K-Star|Party Rooms|Trending/i.test(document.body.innerText || ''),
        ),
      null,
      { timeout: 45_000 },
    )
    .catch(() => {});

  const cloud = await page
    .evaluate(
      async ({ loginEmail, loginPassword }) => {
        try {
          const mod = await import('/src/lib/auth/demoCloudAuth.ts');
          return mod.signInDemoWithCloudSync(loginEmail, loginPassword);
        } catch (err) {
          return { ok: false, reason: err instanceof Error ? err.message : String(err) };
        }
      },
      { loginEmail: email, loginPassword: password },
    )
    .catch((err) => ({ ok: false, reason: err instanceof Error ? err.message : String(err) }));

  notes.push({ step: 'cloud_sync_login', email, cloud });

  if (!cloud?.ok) {
    const forced = await forceLocalDemoLogin(page, email, password).catch((err) => ({
      ok: false,
      reason: err instanceof Error ? err.message : String(err),
    }));
    notes.push({ step: 'local_demo_fallback', email, forced, cloudReason: cloud?.reason });
    if (!forced?.ok) {
      await loginViaUi(page, email, password);
    }
  }

  await page
    .waitForFunction(
      () => {
        const loggedIn = localStorage.getItem('isLoggedIn') === 'true';
        const raw = localStorage.getItem('currentUserId');
        return loggedIn && Boolean(raw);
      },
      null,
      { timeout: 30_000 },
    )
    .catch(() => {});

  const loggedInUserId = await readStoredUserId(page);

  notes.push({
    step: 'after_login',
    email,
    loggedInUserId,
    snap: await snapshot(page),
  });

  if (!loggedInUserId) {
    throw new Error(`login failed for ${email}: no authenticated currentUserId`);
  }
}

async function enterSoloLive(page, notes, roomName, accountEmail, modeLabel = 'Solo') {
  if (!/\/karaoke/.test(page.url())) {
    await page.goto(`${base}/karaoke?launch=main`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  }
  await page
    .waitForFunction(
      () => /K-Star|Studio|Party Rooms|Trending|Karaoke/i.test(document.body.innerText || ''),
      null,
      { timeout: 30_000 },
    )
    .catch(() => {});
  await skipGates(page, { allowDemo: false });
  await dismissDev(page);

  await page.evaluate(() => {
    window.dispatchEvent(
      new CustomEvent('instant-room-open', { detail: { path: '/room/create', entry: 'karaoke-party' } }),
    );
  });
  await page.waitForSelector('text=CREATE ROOM', { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(600);

  await page.evaluate((label) => {
    const root = document.querySelector('[data-instant-room-entry]') || document.body;
    const mode = Array.from(root.querySelectorAll('button')).find((b) =>
      new RegExp(`^\\s*${label}\\s*$`, 'i').test((b.textContent || '').trim()),
    );
    mode?.click();
  }, modeLabel);
  await page.waitForSelector('#create-room-name-live', { timeout: 15_000 });
  await page.evaluate((name) => {
    const input = document.querySelector('#create-room-name-live');
    if (!input) return;
    const proto = window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    setter?.call(input, name);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, roomName);
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) => /^Go Live$/i.test((b.textContent || '').trim()));
    btn?.click();
  });

  await page
    .waitForFunction(
      () =>
        Boolean(
          Array.from(document.querySelectorAll('button')).find((b) =>
            /skip countdown|tap to skip|countdown/i.test(`${b.getAttribute('aria-label') || ''} ${b.textContent || ''}`),
          ) || document.querySelector('.solo-live-layout, .solo-live-shell'),
        ),
      null,
      { timeout: 20_000 },
    )
    .catch(() => {});
  await skipCountdownIfPresent(page);

  let prereq = null;
  try {
    await waitForLiveRoom(page, 120_000);
    prereq = await assertLivePrerequisites(page, roomName, modeLabel === 'Shop');
  } catch (err) {
    prereq = {
      ok: false,
      diag: await readLiveDiagnostics(page),
      failures: [`waitForLiveRoom timeout: ${err instanceof Error ? err.message : String(err)}`],
      label: roomName,
    };
  }

  notes.push({ step: 'live_room', roomName, prereq });
  console.log('[live_room]', roomName, JSON.stringify(prereq?.diag ?? {}, null, 0));
  if (!prereq.ok) {
    console.error('[live_room FAIL]', roomName, prereq.failures, prereq.diag);
  }
  return prereq;
}

async function snapshot(page) {
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
    const loggedIn = localStorage.getItem('isLoggedIn') === 'true';
    const userId = loggedIn ? parseStored('currentUserId') : null;
    const roomId = parseStored('activeRoomId');
    const trace = window.__UNILIVE_PK_TRACE__ || null;
    return {
      href: location.href,
      userId,
      roomId,
      pkBattle: Boolean(document.querySelector('button[aria-label="PK battle"]')),
      pkSetupOpen: Boolean(document.querySelector('[data-ui-id="live.pk.setup.overlay"]')),
      pkOverlay: document.querySelectorAll('.u1pk-overlay, [data-ui-id="live.pk.overlay"], [data-ui-id="live.pk.team.overlay"], .ulspk-root').length,
      pkRoom: document.querySelectorAll('[data-testid="one-vs-one-pk-room"], [data-ui-id="live.pk.1v1.room"]').length,
      teamPkRoom: document.querySelectorAll('[data-ui-id="live.pk.team.room"]').length,
      liveSellPkRoom: document.querySelectorAll('[data-ui-id="live.pk.sell.room"]').length,
      sessionContainer: document.querySelectorAll('[data-ui-id="live.pk.1v1.session"]').length,
      acceptPk: Boolean(
        Array.from(document.querySelectorAll('button')).find((b) => /accept pk/i.test(b.textContent || '')),
      ),
      hosts: Array.from(document.querySelectorAll('[data-pk-host-user-id]')).map((el) => ({
        userId: el.getAttribute('data-pk-host-user-id'),
        roomId: el.getAttribute('data-pk-host-room-id'),
        text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120),
      })),
      trace,
      body: (document.body.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 280),
    };
  });
}

async function closePkSetup(page) {
  await page.evaluate(() => {
    document.querySelector('.pkx-overlay button[aria-label="Close PK panel"]')?.click();
    document.querySelector('.pkx-overlay .pkx-panel-head button[aria-label="Close"]')?.click();
    document.querySelector('[data-ui-id="live.pk.setup.overlay"]')?.querySelector('button[aria-label="Close"]')?.click();
  });
  await page.keyboard.press('Escape').catch(() => {});
  await page.keyboard.press('Escape').catch(() => {});
  await page
    .waitForFunction(
      () => !document.querySelector('[data-ui-id="live.pk.setup.overlay"]'),
      null,
      { timeout: 5000 },
    )
    .catch(() => {});
}

async function waitForPkIdle(page, timeoutMs = 15_000) {
  await page
    .waitForFunction(
      () =>
        !document.querySelector(
          '.u1pk-overlay, [data-ui-id="live.pk.1v1.session"], [data-ui-id="live.pk.team.overlay"], [data-ui-id="live.pk.team.room"], .ulspk-root, [data-ui-id="live.pk.sell.room"]',
        ),
      null,
      { timeout: timeoutMs },
    )
    .catch(() => {});
}

async function endPkIfOpen(page) {
  const visible = await page
    .locator('.u1pk-overlay, [data-ui-id="live.pk.team.room"], .ulspk-root, [data-ui-id="live.pk.sell.room"]')
    .first()
    .isVisible()
    .catch(() => false);
  if (!visible) return;
  await page
    .locator('[data-ui-id="live.pk.1v1.action.end-pk"], [data-ui-id="live.pk.team.action.end-pk"], [data-ui-id="live.pk.sell.action.end-pk"], button:has-text("End PK")')
    .first()
    .click({ timeout: 4000, force: true })
    .catch(() => {});
  await page.waitForTimeout(350);
  await page
    .locator('.u1pk-confirm-card button.u1pk-danger, .u1pk-modal-backdrop button.u1pk-danger')
    .last()
    .click({ timeout: 3000, force: true })
    .catch(() => {});
  await page.getByRole('button', { name: /^End PK$/i }).last().click({ timeout: 2000, force: true }).catch(() => {});
  await waitForPkIdle(page);
}

async function openPkSetup(page) {
  await closePkSetup(page);
  await endPkIfOpen(page);
  const clicked = await page.evaluate(() => {
    const btn = document.querySelector('button[aria-label="PK battle"]');
    if (!btn) return false;
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    return true;
  });
  if (!clicked) {
    throw new Error('pk_button_missing');
  }
  await page.waitForSelector('[data-ui-id="live.pk.setup.overlay"]', { timeout: 8000 });
}

async function selectPkTab(page, type) {
  const tab = page.locator('.pkx-type-tabs button').filter({ hasText: new RegExp(`^${type}$`, 'i') }).first();
  if (await tab.count()) await tab.click({ timeout: 3000 });
  await page.waitForSelector(`[data-ui-id="live.pk.setup.${type}"]`, { timeout: 5000 }).catch(() => {});
}

async function fetchLifecycleHosts(page) {
  return page.evaluate(async () => {
    try {
      const mod = await import('/src/lib/platformApi.ts');
      return await mod.fetchPkLiveHosts();
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err), hosts: [] };
    }
  });
}

async function collectIdentity(page) {
  return page.evaluate(async () => {
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
    const loggedIn = localStorage.getItem('isLoggedIn') === 'true';
    const authUserId = loggedIn ? parseStored('currentUserId') : null;
    let cloudUserId = null;
    let authTokenPrefix = null;
    try {
      const { getSupabaseClient } = await import('/src/lib/supabase/client.ts');
      const sb = getSupabaseClient();
      const { data } = sb ? await sb.auth.getSession() : { data: { session: null } };
      cloudUserId = data.session?.user?.id ?? null;
      const token = data.session?.access_token || '';
      authTokenPrefix = token ? `${token.slice(0, 10)}…${token.length}` : null;
    } catch {
      /* no cloud session */
    }
    const trace = window.__UNILIVE_PK_TRACE__ || {};
    return {
      authUserId,
      cloudUserId,
      profileUserId: authUserId,
      liveOwnerUserId: trace.hostUserId || authUserId,
      livekitIdentity: trace.livekitIdentity || authUserId,
      pkDiscoveryUserId: authUserId,
      challengeUserId: authUserId,
      roomId: parseStored('activeRoomId'),
      authTokenPrefix,
    };
  });
}

async function activate1v1Pk(hostPage, guestPage, hostBIdentity, notes, netA, netB) {
  const stages = [];
  let failingStage = 'pk_button_open';
  const opponentUserId = hostBIdentity.userId;
  const opponentRoomId = lifecycleRoomId(hostBIdentity.roomId);

  try {
    await openPkSetup(hostPage);
  } catch (err) {
    return {
      ok: false,
      failingStage: 'pk_button_open',
      error: err instanceof Error ? err.message : String(err),
    };
  }
  stages.push({ stage: 'pk_button_open', snap: await snapshot(hostPage) });

  failingStage = 'PK HOST DISCOVERY FAILED';
  await hostPage.getByRole('button', { name: /^Start PK$/i }).first().click({ timeout: 4000 }).catch(() => {});
  await hostPage.waitForSelector('[data-ui-id="live.pk.invite.panel"]', { timeout: 8000 }).catch(() => {});

  let found = null;
  let apiHosts = { hosts: [] };
  for (let i = 0; i < 40; i += 1) {
    apiHosts = await fetchLifecycleHosts(hostPage);
    const snap = await snapshot(hostPage);
    stages.push({
      stage: 'host_discovery_poll',
      n: i,
      hosts: snap.hosts,
      apiHosts,
      expected: { userId: opponentUserId, roomId: opponentRoomId },
    });
    found = snap.hosts.find(
      (row) => row.userId === opponentUserId && lifecycleRoomId(row.roomId) === opponentRoomId,
    );
    if (found?.userId) break;
    await hostPage.getByRole('button', { name: 'PK battle' }).first().click({ timeout: 2000 }).catch(() => {});
    await hostPage.getByRole('button', { name: /^Start PK$/i }).first().click({ timeout: 2000 }).catch(() => {});
    await hostPage.waitForTimeout(1500);
  }
  if (!found?.userId || found.userId !== opponentUserId || lifecycleRoomId(found.roomId) !== opponentRoomId) {
    return {
      ok: false,
      failingStage,
      stages,
      netA,
      netB,
      discovery: {
        expectedUserId: opponentUserId,
        expectedRoomId: opponentRoomId,
        actual: found,
        apiResponse: apiHosts,
        dataSource: 'GET /api/live/pk/challenges/hosts via usePkLiveHosts (live-lifecycle only)',
        firstIncorrectMapping:
          (apiHosts.hosts || []).some((row) => row.userId === opponentUserId)
            ? 'API returned Host B but invite sheet did not render that row'
            : 'Host B live room is not in live-lifecycle host list',
      },
    };
  }

  failingStage = 'host_row_selection';
  await hostPage.locator(`[data-pk-host-user-id="${found.userId}"]`).first().click({ timeout: 4000 }).catch(() => {});
  stages.push({ stage: 'host_row_selection', found, snap: await snapshot(hostPage) });

  failingStage = 'duration_selection';
  await hostPage.getByRole('button', { name: /^Continue$/i }).first().click({ timeout: 4000 }).catch(() => {});
  await hostPage.waitForSelector('[data-ui-id="live.pk.confirm.panel"]', { timeout: 8000 }).catch(() => {});
  stages.push({ stage: 'continue_to_confirm', snap: await snapshot(hostPage) });

  failingStage = 'challenge_post';
  await hostPage.getByRole('button', { name: /^Send Challenge$/i }).first().click({ timeout: 4000 }).catch(() => {});
  await hostPage.waitForTimeout(1500);
  stages.push({ stage: 'challenge_sent', snap: await snapshot(hostPage), netTail: netA.slice(-3) });

  failingStage = 'PK CHALLENGE INBOX DELIVERY FAILED';
  let acceptVisible = false;
  for (let i = 0; i < 30; i += 1) {
    const guestSnap = await snapshot(guestPage);
    if (guestSnap.acceptPk) {
      acceptVisible = true;
      break;
    }
    await guestPage.waitForTimeout(500);
  }
  if (!acceptVisible) {
    stages.push({ stage: 'challenge_inbox_missing', guestSnap: await snapshot(guestPage), netTail: netB.slice(-5) });
    return { ok: false, failingStage, stages, netA, netB };
  }

  failingStage = 'challenge_accept';
  await guestPage.getByRole('button', { name: /Accept PK/i }).first().click({ timeout: 5000 }).catch(() => {});
  await hostPage.waitForTimeout(2500);
  stages.push({ stage: 'accept_clicked', host: await snapshot(hostPage), guest: await snapshot(guestPage) });

  failingStage = 'session_creation';
  for (let i = 0; i < 20; i += 1) {
    const hostSnap = await snapshot(hostPage);
    if (hostSnap.pkRoom > 0 && hostSnap.trace?.gate?.activePkId) {
      failingStage = null;
      return { ok: true, failingStage: null, stages, hostSnap, netA, netB };
    }
    await hostPage.waitForTimeout(500);
  }

  failingStage = 'OneVsOnePkRoom_mount';
  const finalSnap = await snapshot(hostPage);
  stages.push({ stage: 'pk_mount_timeout', snap: finalSnap });
  return { ok: finalSnap.pkRoom > 0, failingStage, stages, hostSnap: finalSnap, netA, netB };
}

function maskPixel(masks, x, y) {
  for (const m of masks) {
    if (x >= m.x * VW && x < (m.x + m.w) * VW && y >= m.y * VH && y < (m.y + m.h) * VH) return true;
  }
  return false;
}

async function writeCompareDir(dir, { maskOutside = null, maskKey = null } = {}) {
  const refPath = path.join(dir, 'reference.png');
  const actPath = path.join(dir, 'actual.png');
  if (!fs.existsSync(refPath) || !fs.existsSync(actPath)) {
    return { ok: false, reason: 'missing_files', dir };
  }
  const specKey = path.basename(path.dirname(dir)) === '02-pk-setup' ? '02-pk-setup' : path.basename(dir);
  const masks = DYNAMIC_MASKS[maskKey || specKey] || [];
  const ref = await sharp(refPath).resize(VW, VH, { fit: 'fill' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const act = await sharp(actPath).resize(VW, VH, { fit: 'fill' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const n = VW * VH * 4;
  const overlay = Buffer.alloc(n);
  const diff = Buffer.alloc(n);
  let diffSum = 0;
  let diffCount = 0;

  for (let i = 0; i < n; i += 4) {
    const px = (i / 4) | 0;
    const x = px % VW;
    const y = (px / VW) | 0;
    overlay[i] = Math.round(ref.data[i] * 0.5 + act.data[i] * 0.5);
    overlay[i + 1] = Math.round(ref.data[i + 1] * 0.5 + act.data[i + 1] * 0.5);
    overlay[i + 2] = Math.round(ref.data[i + 2] * 0.5 + act.data[i + 2] * 0.5);
    overlay[i + 3] = 255;
    const outside =
      maskOutside &&
      (x < maskOutside.x ||
        y < maskOutside.y ||
        x >= maskOutside.x + maskOutside.width ||
        y >= maskOutside.y + maskOutside.height);
    if (outside || maskPixel(masks, x, y)) {
      diff[i] = 0;
      diff[i + 1] = 0;
      diff[i + 2] = 0;
      diff[i + 3] = 255;
      continue;
    }
    const dr = Math.abs(ref.data[i] - act.data[i]);
    const dg = Math.abs(ref.data[i + 1] - act.data[i + 1]);
    const db = Math.abs(ref.data[i + 2] - act.data[i + 2]);
    diff[i] = dr;
    diff[i + 1] = dg;
    diff[i + 2] = db;
    diff[i + 3] = 255;
    diffSum += dr + dg + db;
    diffCount += 1;
  }

  await sharp(overlay, { raw: { width: VW, height: VH, channels: 4 } }).png().toFile(path.join(dir, 'overlay.png'));
  await sharp(diff, { raw: { width: VW, height: VH, channels: 4 } }).png().toFile(path.join(dir, 'diff.png'));
  const meanDiff = diffCount ? diffSum / (diffCount * 3) : 0;
  return { ok: true, meanDiff, diffCount, acceptable: meanDiff < 28, dir };
}

async function writeCompare(screenKey) {
  const dirName = SCREEN_DIRS[screenKey] || screenKey;
  return writeCompareDir(path.join(parityRoot, dirName), { maskKey: dirName });
}

async function writeRegionDiff(dir) {
  const refPath = path.join(dir, 'reference.png');
  const actPath = path.join(dir, 'actual.png');
  if (!fs.existsSync(refPath) || !fs.existsSync(actPath)) return null;
  const ref = await sharp(refPath).resize(VW, VH, { fit: 'fill' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const act = await sharp(actPath).resize(VW, VH, { fit: 'fill' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const masks = DYNAMIC_MASKS['03-1v1'] || [];
  const out = {};
  for (const [name, box] of Object.entries(ONE_V1_REGIONS)) {
    let sum = 0;
    let count = 0;
    for (let y = Math.floor(box.y * VH); y < Math.min(VH, Math.ceil((box.y + box.h) * VH)); y += 1) {
      for (let x = Math.floor(box.x * VW); x < Math.min(VW, Math.ceil((box.x + box.w) * VW)); x += 1) {
        if (maskPixel(masks, x, y)) continue;
        const i = (y * VW + x) * 4;
        sum += Math.abs(ref.data[i] - act.data[i]) + Math.abs(ref.data[i + 1] - act.data[i + 1]) + Math.abs(ref.data[i + 2] - act.data[i + 2]);
        count += 1;
      }
    }
    out[name] = { meanDiff: count ? sum / (count * 3) : 0, samples: count, box };
  }
  fs.writeFileSync(path.join(dir, 'region-diff.json'), JSON.stringify(out, null, 2));
  return out;
}

function grade(meanDiff) {
  if (meanDiff == null) return { POSITION: 'UNVERIFIED', LAYOUT: 'UNVERIFIED', DETAILS: 'UNVERIFIED' };
  return {
    POSITION: meanDiff < 36 ? 'PASS' : 'FAIL',
    LAYOUT: meanDiff < 32 ? 'PASS' : 'FAIL',
    DETAILS: meanDiff < 18 ? 'PASS' : 'FAIL',
  };
}

async function shot(page, dest) {
  await dismissDev(page);
  await page.screenshot({ path: dest, fullPage: false });
}

async function capturePkSetupPanels(hostPage, notes) {
  const map = loadSetupRefMap();
  const results = {};
  await openPkSetup(hostPage);

  for (const panel of SETUP_STATES.filter((s) => s.tab && s.tab !== 'live-sell')) {
    await selectPkTab(hostPage, panel.tab);
    await hostPage.waitForTimeout(400);
    const destDir = path.join(parityRoot, SCREEN_DIRS.pkSetup, panel.dir);
    fs.mkdirSync(destDir, { recursive: true });
    await shot(hostPage, path.join(destDir, 'actual.png'));
    const state = map.states.find((row) => row.state === panel.type);
    results[panel.type] = await writeCompareDir(destDir, { maskOutside: state?.panelBounds, maskKey: '02-pk-setup' });
    notes.push({ step: 'pk_setup_capture', panel: panel.type, compare: results[panel.type] });
  }

  const liveSellTab = hostPage.locator('.pkx-live-sell-tab').first();
  const destLive = path.join(parityRoot, SCREEN_DIRS.pkSetup, '06-live-sell');
  fs.mkdirSync(destLive, { recursive: true });
  if (await liveSellTab.count()) {
    await liveSellTab.click({ timeout: 2000 }).catch(() => {});
    await hostPage.waitForTimeout(400);
    await shot(hostPage, path.join(destLive, 'actual.png'));
    const state = map.states.find((row) => row.state === 'live-sell');
    results['live-sell'] = await writeCompareDir(destLive, { maskOutside: state?.panelBounds, maskKey: '02-pk-setup' });
  } else {
    results['live-sell'] = { ok: false, reason: 'live-sell tab requires commerce live', individuallyAvailable: true };
  }

  await selectPkTab(hostPage, '1v1');
  await hostPage.getByRole('button', { name: /^Start PK$/i }).first().click({ timeout: 3000 }).catch(() => {});
  await hostPage.waitForSelector('[data-ui-id="live.pk.invite.panel"]', { timeout: 5000 }).catch(() => {});
  const destInvite = path.join(parityRoot, SCREEN_DIRS.pkSetup, '07-invite');
  fs.mkdirSync(destInvite, { recursive: true });
  await shot(hostPage, path.join(destInvite, 'actual.png'));
  results.invite = await writeCompareDir(destInvite, {
    maskOutside: map.states.find((row) => row.state === 'invite')?.panelBounds,
    maskKey: '02-pk-setup',
  });

  await hostPage.locator('.pkx-panel-head button').first().click({ timeout: 2000 }).catch(() => {});
  await hostPage.getByRole('button', { name: /PK Duration/i }).first().click({ timeout: 3000 }).catch(() => {});
  await hostPage.waitForSelector('[data-ui-id="live.pk.duration.panel"]', { timeout: 5000 }).catch(() => {});
  const destDur = path.join(parityRoot, SCREEN_DIRS.pkSetup, '08-duration');
  fs.mkdirSync(destDur, { recursive: true });
  await shot(hostPage, path.join(destDur, 'actual.png'));
  results.duration = await writeCompareDir(destDur, {
    maskOutside: map.states.find((row) => row.state === 'duration')?.panelBounds,
    maskKey: '02-pk-setup',
  });

  await hostPage.locator('[data-ui-id="live.pk.duration.panel"] .pkx-panel-head button[aria-label="Close"]').click({ timeout: 2000 }).catch(() => {});
  await hostPage.getByRole('button', { name: /Random Match/i }).first().click({ timeout: 3000 }).catch(() => {});
  await hostPage.waitForSelector('[data-ui-id="live.pk.random.filters"]', { timeout: 5000 }).catch(() => {});
  const destRand = path.join(parityRoot, SCREEN_DIRS.pkSetup, '09-random');
  fs.mkdirSync(destRand, { recursive: true });
  await shot(hostPage, path.join(destRand, 'actual.png'));
  results.random = await writeCompareDir(destRand, {
    maskOutside: map.states.find((row) => row.state === 'random')?.panelBounds,
    maskKey: '02-pk-setup',
  });

  await hostPage.getByRole('button', { name: /^Cancel$/i }).first().click({ timeout: 2000 }).catch(() => {});
  await hostPage.getByRole('button', { name: /^Start PK$/i }).first().click({ timeout: 3000 }).catch(() => {});
  const destConf = path.join(parityRoot, SCREEN_DIRS.pkSetup, '10-confirmation');
  fs.mkdirSync(destConf, { recursive: true });
  if (await hostPage.locator('[data-pk-host-user-id]').count()) {
    await hostPage.locator('[data-pk-host-user-id]').first().click({ timeout: 2000 }).catch(() => {});
    await hostPage.getByRole('button', { name: /^Continue$/i }).first().click({ timeout: 2000 }).catch(() => {});
    await hostPage.waitForSelector('[data-ui-id="live.pk.confirm.panel"]', { timeout: 5000 }).catch(() => {});
    await shot(hostPage, path.join(destConf, 'actual.png'));
    results.confirmation = await writeCompareDir(destConf, {
      maskOutside: map.states.find((row) => row.state === 'confirmation')?.panelBounds,
      maskKey: '02-pk-setup',
    });
  } else {
    results.confirmation = { ok: false, reason: 'no host row for confirmation' };
  }

  await closePkSetup(hostPage);
  return results;
}

async function prepareRunningReferences() {
  const master = path.join(
    appRoot,
    '../../UniLives-Final-Approved-UIUX-Production-Cursor-v15/reference-approved/MASTER',
  );
  const map = {
    '03-1v1': 'PK-running/01-1v1-running-approved.jpeg',
    '04-2v2': 'PK-running/02-2v2-running-approved.jpeg',
    '05-3v3': 'PK-running/03-3v3-running-approved.jpeg',
    '06-4v4': 'PK-running/04-4v4-running-approved.jpeg',
    '07-6v6': 'PK-running/05-6v6-running-approved.jpeg',
    '08-live-sell-pk': 'PK-running/06-live-sell-pk-running-approved.jpeg',
  };
  for (const [dir, file] of Object.entries(map)) {
    const screenDir = path.join(parityRoot, dir);
    fs.mkdirSync(screenDir, { recursive: true });
    const src = path.join(master, file);
    if (!fs.existsSync(src)) continue;
    await sharp(src).resize(VW, VH, { fit: 'fill' }).png().toFile(path.join(screenDir, 'reference.png'));
  }
}

async function endHostLive(page) {
  await endPkIfOpen(page);
  await closePkSetup(page);
  await page.evaluate(() => {
    document.querySelector('[aria-label="Close live room"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) =>
      /^End Live$/i.test((b.textContent || '').trim()),
    );
    btn?.click();
  });
  await page
    .waitForFunction(
      () => {
        const raw = localStorage.getItem('activeRoomId');
        let roomId = '';
        try {
          roomId = raw ? JSON.parse(raw) : '';
        } catch {
          roomId = String(raw || '').replace(/^"|"$/g, '');
        }
        const live = document.querySelector('.solo-live-layout, .solo-live-shell');
        const pk = document.querySelector('.u1pk-overlay, [data-ui-id="live.pk.setup.overlay"]');
        return !pk && (!live || !roomId);
      },
      null,
      { timeout: 20_000 },
    )
    .catch(() => {});
}

async function pinCommerceProduct(page) {
  await page.getByRole('button', { name: 'Live shop' }).click({ timeout: 5000, force: true }).catch(() => {});
  await page.waitForSelector('[data-ui-id="commerce.host.panel"]', { timeout: 8000 }).catch(() => {});
  if (!(await page.locator('[data-ui-id="commerce.host.panel"] button:has-text("Pin")').count())) {
    await page.locator('[data-ui-id="commerce.host.panel"] button:has-text("Add Product")').click({ timeout: 3000 }).catch(() => {});
  }
  await page.locator('[data-ui-id="commerce.host.panel"] button:has-text("Pin")').first().click({ timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(400);
}

async function activateLiveSellPk(hostPage, guestPage, notes) {
  try {
    await openPkSetup(hostPage);
    const liveSellTab = hostPage.locator('.pkx-live-sell-tab').first();
    if (!(await liveSellTab.count())) {
      await closePkSetup(hostPage);
      return { ok: false, reason: 'live_sell_tab_missing' };
    }
    await liveSellTab.click({ timeout: 3000 });
    await hostPage.getByRole('button', { name: /^Start PK$/i }).first().click({ timeout: 4000 }).catch(() => {});
    await hostPage.waitForSelector('[data-ui-id="live.pk.invite.panel"]', { timeout: 8000 }).catch(() => {});
    const guestSnap = await snapshot(guestPage);
    const row = hostPage.locator(`[data-pk-host-user-id="${guestSnap.userId}"]`).first();
    if (!(await row.count())) {
      await closePkSetup(hostPage);
      return { ok: false, reason: 'host_b_not_in_discovery' };
    }
    await row.click({ timeout: 4000 }).catch(() => {});
    await hostPage.getByRole('button', { name: /^Continue$/i }).first().click({ timeout: 4000 }).catch(() => {});
    await hostPage.getByRole('button', { name: /^Send Challenge$/i }).first().click({ timeout: 4000 }).catch(() => {});
    let accept = false;
    for (let i = 0; i < 25; i += 1) {
      if ((await snapshot(guestPage)).acceptPk) {
        accept = true;
        break;
      }
      await guestPage.waitForTimeout(400);
    }
    if (!accept) return { ok: false, reason: 'inbox_missing' };
    await guestPage.getByRole('button', { name: /Accept PK/i }).first().click({ timeout: 5000 }).catch(() => {});
    for (let i = 0; i < 20; i += 1) {
      const hostSnap = await snapshot(hostPage);
      if (hostSnap.liveSellPkRoom > 0) {
        notes.push({ step: 'live_sell_pk_mounted', snap: hostSnap });
        return { ok: true, hostSnap };
      }
      await hostPage.waitForTimeout(500);
    }
    return { ok: false, reason: 'live_sell_room_not_mounted', snap: await snapshot(hostPage) };
  } catch (err) {
    await closePkSetup(hostPage).catch(() => {});
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

async function seedDevTeamRoster(page, captainId, size) {
  const mates = Array.from({ length: Math.max(0, size - 1) }, (_, i) => `devpk_${captainId}_m${i + 1}`);
  const ids = [captainId, ...mates];
  return page.evaluate(
    async ({ userIds }) => {
      const roomRaw = localStorage.getItem('activeRoomId');
      let roomId = '';
      try {
        roomId = JSON.parse(roomRaw);
      } catch {
        roomId = String(roomRaw || '').replace(/^"|"$/g, '');
      }
      const { parsePkLiveMediaRef } = await import('/src/lib/live/pkLiveMediaRef.ts');
      const lifecycleRoomId = parsePkLiveMediaRef(roomId).lifecycleRoomId || roomId;
      const { setTeamPkInvitedMembers } = await import('/src/lib/live/teamPkRosterRegistry.ts');
      const { setLivePkTeamRoster } = await import('/src/lib/platformApi.ts');
      setTeamPkInvitedMembers(
        lifecycleRoomId,
        userIds.slice(1).map((userId) => ({ userId, name: userId })),
      );
      const saved = await setLivePkTeamRoster(lifecycleRoomId, userIds);
      return { lifecycleRoomId, saved, userIds };
    },
    { userIds: ids },
  );
}

async function activateTeamPk(hostPage, guestPage, tab, size, notes, netA, netB) {
  try {
    await seedDevTeamRoster(hostPage, 'u1', size);
    await seedDevTeamRoster(guestPage, 'u2', size);
    const guestSnap = await snapshot(guestPage);
    await openPkSetup(hostPage);
    await selectPkTab(hostPage, tab);
    await hostPage.getByRole('button', { name: /^Start PK$/i }).first().click({ timeout: 4000 }).catch(() => {});
    await hostPage.waitForSelector('[data-ui-id="live.pk.invite.panel"]', { timeout: 8000 }).catch(() => {});
    const row = hostPage.locator(`[data-pk-host-user-id="${guestSnap.userId}"]`).first();
    if (!(await row.count())) {
      await closePkSetup(hostPage);
      return { ok: false, reason: 'host_b_not_in_discovery' };
    }
    await row.click({ timeout: 4000 }).catch(() => {});
    await hostPage.getByRole('button', { name: /^Continue$/i }).first().click({ timeout: 4000 }).catch(() => {});
    await hostPage.getByRole('button', { name: /^Send Challenge$/i }).first().click({ timeout: 4000 }).catch(() => {});
    let accept = false;
    for (let i = 0; i < 25; i += 1) {
      if ((await snapshot(guestPage)).acceptPk) {
        accept = true;
        break;
      }
      await guestPage.waitForTimeout(400);
    }
    if (!accept) return { ok: false, reason: 'inbox_missing', netA: netA.slice(-3), netB: netB.slice(-3) };
    await guestPage.getByRole('button', { name: /Accept PK/i }).first().click({ timeout: 5000 }).catch(() => {});
    for (let i = 0; i < 20; i += 1) {
      const hostSnap = await snapshot(hostPage);
      if (hostSnap.teamPkRoom > 0) {
        const counts = await hostPage.evaluate(() => ({
          left: document.querySelectorAll('[data-ui-id="live.pk.team.room"] [data-pk-side="host"]').length,
          right: document.querySelectorAll('[data-ui-id="live.pk.team.room"] [data-pk-side="opponent"]').length,
          team: document.querySelectorAll('[data-ui-id="live.pk.team.room"]').length,
          size: document.querySelector('[data-ui-id="live.pk.team.room"]')?.getAttribute('data-pk-team-size'),
        }));
        notes.push({ step: `team_${tab}_mounted`, counts, snap: hostSnap });
        return { ok: true, counts, hostSnap };
      }
      await hostPage.waitForTimeout(500);
    }
    return { ok: false, reason: 'team_room_not_mounted', snap: await snapshot(hostPage) };
  } catch (err) {
    await closePkSetup(hostPage).catch(() => {});
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

async function run1v1Function(hostPage, guestPage, netA, netB) {
  const result = {
    CREATE: 'PASS',
    DELIVERY: 'PASS',
    ACCEPT: 'PASS',
    SESSION: 'PASS',
    CHAT: 'UNVERIFIED',
    GIFT: 'UNVERIFIED',
    SCORE: 'UNVERIFIED',
    TIMER: 'UNVERIFIED',
    RECONNECT: 'UNVERIFIED',
    END: 'UNVERIFIED',
    LIVE_CONTINUES: 'UNVERIFIED',
  };
  const input = hostPage.locator('[data-ui-id="live.pk.1v1.comment-input"] input, .u1pk-composer input').first();
  if (await input.count()) {
    await input.fill('pk-e2e-from-a');
    await input.press('Enter');
    await hostPage.waitForTimeout(1200);
    const bText = await guestPage.locator('body').innerText();
    const aDup = (await hostPage.locator('body').innerText()).split('pk-e2e-from-a').length - 1;
    result.CHAT = bText.includes('pk-e2e-from-a') && aDup <= 2 ? 'PASS' : 'FAIL';
    const inputB = guestPage.locator('[data-ui-id="live.pk.1v1.comment-input"] input, .u1pk-composer input').first();
    if (await inputB.count()) {
      await inputB.fill('pk-e2e-from-b');
      await inputB.press('Enter');
      await guestPage.waitForTimeout(1200);
      const aText = await hostPage.locator('body').innerText();
      if (!aText.includes('pk-e2e-from-b')) result.CHAT = 'FAIL';
    }
  }
  const timers = await Promise.all([
    hostPage.locator('[data-ui-id="live.pk.1v1.timer"]').innerText().catch(() => ''),
    guestPage.locator('[data-ui-id="live.pk.1v1.timer"]').innerText().catch(() => ''),
  ]);
  result.TIMER = /^\d{2}:\d{2}$/.test(timers[0]) && timers[0] === timers[1] ? 'PASS' : timers[0] ? 'FAIL' : 'UNVERIFIED';

  await hostPage.locator('[data-ui-id="live.pk.1v1.action.gift"]').click({ timeout: 3000 }).catch(() => {});
  await hostPage.waitForTimeout(800);
  const giftBtn = hostPage.locator('button').filter({ hasText: /Send|Gift/i }).nth(1);
  await giftBtn.click({ timeout: 3000 }).catch(() => {});
  await hostPage.waitForTimeout(1500);
  const giftNet = netA.filter((row) => /gift|settle/i.test(row.url)).slice(-3);
  result.GIFT = giftNet.length ? 'PASS' : 'UNVERIFIED';
  result.SCORE = 'UNVERIFIED';

  await guestPage.context().setOffline(true);
  await guestPage.waitForTimeout(800);
  await guestPage.context().setOffline(false);
  await guestPage.waitForTimeout(2000);
  const after = await snapshot(guestPage);
  result.RECONNECT = after.pkRoom > 0 || after.sessionContainer > 0 ? 'PASS' : 'FAIL';

  await endPkIfOpen(hostPage);
  await hostPage.waitForTimeout(1500);
  const hostAfter = await snapshot(hostPage);
  const guestAfter = await snapshot(guestPage);
  result.END = hostAfter.pkRoom === 0 && guestAfter.pkRoom === 0 ? 'PASS' : 'FAIL';
  result.LIVE_CONTINUES = hostAfter.pkBattle && guestAfter.pkBattle ? 'PASS' : 'FAIL';
  return { result, giftNet, timers };
}

async function main() {
  for (const dir of Object.values(SCREEN_DIRS)) {
    fs.mkdirSync(path.join(parityRoot, dir), { recursive: true });
  }

  const notes = [];
  const netA = [];
  const netB = [];
  const report = {
    base,
    status: 'NOT COMPLETE — REAL PK ACTIVATION FAILED',
    failingStage: 'not_started',
    hostA: null,
    hostB: null,
    pk1v1: null,
    captures: {},
    functional: {},
    visual: {},
  };
  const persist = () => {
    fs.writeFileSync(path.join(parityRoot, 'pk-capture-report.json'), JSON.stringify({ ...report, notes }, null, 2));
  };

  await prepareRunningReferences();

  const browser = await launchBrowser();
  await waitForLiveApi();

  const hostCtx = await newContext(browser);
  const hostA = await hostCtx.newPage();
  attachNet(hostA, netA);

  await loginEmail(hostA, 'demo@unilive.app', 'demo123', notes);
  const hostLive = await enterSoloLive(hostA, notes, 'V15 PK Host A', 'demo@unilive.app');
  if (!hostLive.ok) {
    report.failingStage = 'host_a_go_live';
    report.hostA = hostLive.diag;
    fs.writeFileSync(path.join(parityRoot, 'pk-capture-report.json'), JSON.stringify(report, null, 2));
    await browser.close();
    console.log(JSON.stringify(report, null, 2));
    process.exit(1);
  }

  const guestCtx = await newContext(browser);
  const hostB = await guestCtx.newPage();
  attachNet(hostB, netB);

  await loginEmail(hostB, 'sarah@unilive.app', 'demo123', notes);
  const guestLive = await enterSoloLive(hostB, notes, 'V15 PK Host B', 'sarah@unilive.app');
  report.hostA = hostLive.diag;
  report.hostB = guestLive.diag;

  const hostASnap = await snapshot(hostA);
  const hostBSnap = await snapshot(hostB);
  const hostAIdentity = await collectIdentity(hostA);
  const hostBIdentity = await collectIdentity(hostB);
  notes.push({
    step: 'identities',
    hostA: hostAIdentity,
    hostB: hostBIdentity,
    sameUser: hostAIdentity.authUserId === hostBIdentity.authUserId,
    sameToken: hostAIdentity.authTokenPrefix && hostAIdentity.authTokenPrefix === hostBIdentity.authTokenPrefix,
  });
  console.log('[CLOUD IDENTITY]', JSON.stringify({ hostA: hostAIdentity, hostB: hostBIdentity }, null, 2));

  const identityMismatch = (row) =>
    Boolean(row.cloudUserId && row.authUserId && row.cloudUserId !== row.authUserId);
  if (identityMismatch(hostAIdentity) || identityMismatch(hostBIdentity)) {
    report.failingStage = 'cloud_identity_mismatch';
    report.status = 'NOT COMPLETE — PK HOST DISCOVERY FAILED';
    report.identity = { hostA: hostAIdentity, hostB: hostBIdentity };
    fs.writeFileSync(path.join(parityRoot, 'pk-capture-report.json'), JSON.stringify({ ...report, notes }, null, 2));
    await browser.close();
    console.log(JSON.stringify(report, null, 2));
    process.exit(1);
  }

  if (!guestLive.ok) {
    report.failingStage = 'host_b_go_live';
    fs.writeFileSync(path.join(parityRoot, 'pk-capture-report.json'), JSON.stringify(report, null, 2));
    await browser.close();
    console.log(JSON.stringify(report, null, 2));
    process.exit(1);
  }
  if (hostASnap.userId === hostBSnap.userId) {
    report.failingStage = 'same_authenticated_user';
    report.identity = { hostA: hostAIdentity, hostB: hostBIdentity };
    fs.writeFileSync(path.join(parityRoot, 'pk-capture-report.json'), JSON.stringify({ ...report, notes }, null, 2));
    await browser.close();
    console.log(JSON.stringify(report, null, 2));
    process.exit(1);
  }
  if (hostAIdentity.authTokenPrefix && hostAIdentity.authTokenPrefix === hostBIdentity.authTokenPrefix) {
    report.failingStage = 'auth_token_not_isolated';
    report.identity = { hostA: hostAIdentity, hostB: hostBIdentity };
    fs.writeFileSync(path.join(parityRoot, 'pk-capture-report.json'), JSON.stringify({ ...report, notes }, null, 2));
    await browser.close();
    console.log(JSON.stringify(report, null, 2));
    process.exit(1);
  }

  let setupResults = report.setup || {};
  if (process.env.SKIP_PK_SETUP_CAPTURE === '1') {
    notes.push({ step: 'pk_setup_capture_skipped' });
  } else {
    try {
      setupResults = await capturePkSetupPanels(hostA, notes);
    } catch (err) {
      setupResults = { error: err instanceof Error ? err.message : String(err) };
    }
    report.setup = setupResults;
    persist();
    await closePkSetup(hostA);
    await hostB.evaluate(() => {
      for (const btn of document.querySelectorAll('button')) {
        if (/decline pk|decline/i.test(btn.textContent || '')) btn.click();
      }
    });
    await hostA.waitForTimeout(600);
  }

  const pkResult = await activate1v1Pk(
    hostA,
    hostB,
    { userId: hostBSnap.userId, roomId: hostBSnap.roomId },
    notes,
    netA,
    netB,
  );
  report.identity = { hostA: hostAIdentity, hostB: hostBIdentity };
  report.pk1v1 = pkResult;

  if (!pkResult.ok) {
    report.failingStage = pkResult.failingStage || 'pk_activation_failed';
    report.status =
      pkResult.failingStage === 'PK HOST DISCOVERY FAILED'
        ? 'NOT COMPLETE — PK HOST DISCOVERY FAILED'
        : pkResult.failingStage === 'PK CHALLENGE INBOX DELIVERY FAILED'
          ? 'NOT COMPLETE — PK CHALLENGE DELIVERY FAILED'
          : 'NOT COMPLETE — PK SESSION ACTIVATION FAILED';
    fs.writeFileSync(path.join(parityRoot, 'pk-capture-report.json'), JSON.stringify({ ...report, notes }, null, 2));
    await hostCtx.close();
    await guestCtx.close();
    await browser.close();
    console.log(JSON.stringify(report, null, 2));
    process.exit(1);
  }

  const dir1v1 = path.join(parityRoot, SCREEN_DIRS['1v1']);
  await shot(hostA, path.join(dir1v1, 'actual.png'));
  const compare1v1 = await writeCompare('1v1');
  const region1v1 = await writeRegionDiff(dir1v1);
  report.captures['1v1'] = { ...compare1v1, regions: region1v1 };
  const g1 = grade(compare1v1.meanDiff);
  report.visual['1v1'] = {
    activeRealSession: true,
    actual: true,
    overlay: compare1v1.ok,
    diff: compare1v1.ok,
    ...g1,
  };

  const fn1 = await run1v1Function(hostA, hostB, netA, netB);
  report.functional['1v1'] = fn1.result;
  notes.push({ step: '1v1_function', fn1 });
  persist();

  const teamModes = [
    { tab: '2v2', size: 2, key: '2v2' },
    { tab: '3v3', size: 3, key: '3v3' },
    { tab: '4v4', size: 4, key: '4v4' },
    { tab: '6v6', size: 6, key: '6v6' },
  ];
  for (const mode of teamModes) {
    await endPkIfOpen(hostA);
    await hostA.waitForTimeout(800);
    const team = await activateTeamPk(hostA, hostB, mode.tab, mode.size, notes, netA, netB);
    const dest = path.join(parityRoot, SCREEN_DIRS[mode.key]);
    fs.mkdirSync(dest, { recursive: true });
    if (team.ok) {
      await shot(hostA, path.join(dest, 'actual.png'));
      const cmp = await writeCompare(mode.key);
      report.captures[mode.key] = { ...cmp, counts: team.counts };
      report.visual[mode.key] = { activeRealSession: true, actual: true, overlay: cmp.ok, diff: cmp.ok, ...grade(cmp.meanDiff) };
      report.functional[mode.key] = {
        CREATE: 'UNVERIFIED',
        DELIVERY: 'UNVERIFIED',
        ACCEPT: 'UNVERIFIED',
        SESSION: 'UNVERIFIED',
        CHAT: 'UNVERIFIED',
        GIFT: 'UNVERIFIED',
        SCORE: 'UNVERIFIED',
        TIMER: 'UNVERIFIED',
        RECONNECT: 'UNVERIFIED',
        END: 'UNVERIFIED',
        LIVE_CONTINUES: 'UNVERIFIED',
        roster: team.counts,
        visualFixtures: true,
      };
    } else {
      report.visual[mode.key] = { activeRealSession: false, actual: false, overlay: false, diff: false, POSITION: 'UNVERIFIED', LAYOUT: 'UNVERIFIED', DETAILS: 'UNVERIFIED' };
      report.functional[mode.key] = { CREATE: team.reason === 'host_b_not_in_discovery' ? 'FAIL' : 'UNVERIFIED', DELIVERY: 'UNVERIFIED', ACCEPT: 'UNVERIFIED', SESSION: 'UNVERIFIED', CHAT: 'UNVERIFIED', GIFT: 'UNVERIFIED', SCORE: 'UNVERIFIED', TIMER: 'UNVERIFIED', RECONNECT: 'UNVERIFIED', END: 'UNVERIFIED', LIVE_CONTINUES: 'UNVERIFIED', reason: team.reason };
    }
    await endPkIfOpen(hostA);
    persist();
  }

  report.visual.setup = {};
  for (const [key, value] of Object.entries(setupResults || {})) {
    if (value?.meanDiff == null) {
      report.visual.setup[key] = {
        POSITION: 'UNVERIFIED',
        LAYOUT: 'UNVERIFIED',
        DETAILS: 'UNVERIFIED',
        actual: false,
        overlay: false,
        diff: false,
        reason: value?.reason || 'missing',
      };
    } else {
      report.visual.setup[key] = {
        ...grade(value.meanDiff),
        actual: true,
        overlay: value.ok,
        diff: value.ok,
        meanDiff: value.meanDiff,
      };
    }
  }

  await endPkIfOpen(hostA);
  await endPkIfOpen(hostB);
  await endHostLive(hostA);
  const commerceLive = await enterSoloLive(hostA, notes, 'V15 Live Sell Host A', 'demo@unilive.app', 'Shop');
  notes.push({ step: 'commerce_live', commerceLive });
  if (commerceLive.ok) {
    await pinCommerceProduct(hostA);
    const sell = await activateLiveSellPk(hostA, hostB, notes);
    const destSell = path.join(parityRoot, SCREEN_DIRS.liveSell);
    fs.mkdirSync(destSell, { recursive: true });
    if (sell.ok) {
      await shot(hostA, path.join(destSell, 'actual.png'));
      const cmpSell = await writeCompare('liveSell');
      report.captures.liveSell = cmpSell;
      report.visual.liveSell = {
        activeRealSession: true,
        actual: true,
        overlay: cmpSell.ok,
        diff: cmpSell.ok,
        ...grade(cmpSell.meanDiff),
      };
      report.functional.liveSell = {
        CREATE: 'PASS',
        DELIVERY: 'PASS',
        ACCEPT: 'PASS',
        SESSION: 'PASS',
        CHAT: 'UNVERIFIED',
        GIFT: 'UNVERIFIED',
        SCORE: 'UNVERIFIED',
        TIMER: 'UNVERIFIED',
        RECONNECT: 'UNVERIFIED',
        END: 'UNVERIFIED',
        LIVE_CONTINUES: 'UNVERIFIED',
        checkout: 'UNVERIFIED',
      };
    } else {
      report.visual.liveSell = {
        activeRealSession: false,
        actual: false,
        overlay: false,
        diff: false,
        POSITION: 'UNVERIFIED',
        LAYOUT: 'UNVERIFIED',
        DETAILS: 'UNVERIFIED',
      };
      report.functional.liveSell = {
        CREATE: sell.reason === 'host_b_not_in_discovery' ? 'FAIL' : 'UNVERIFIED',
        DELIVERY: sell.reason === 'inbox_missing' ? 'FAIL' : 'UNVERIFIED',
        ACCEPT: 'UNVERIFIED',
        SESSION: 'UNVERIFIED',
        CHAT: 'UNVERIFIED',
        GIFT: 'UNVERIFIED',
        SCORE: 'UNVERIFIED',
        TIMER: 'UNVERIFIED',
        RECONNECT: 'UNVERIFIED',
        END: 'UNVERIFIED',
        LIVE_CONTINUES: 'UNVERIFIED',
        reason: sell.reason,
      };
    }
  } else {
    report.visual.liveSell = {
      activeRealSession: false,
      actual: false,
      overlay: false,
      diff: false,
      POSITION: 'UNVERIFIED',
      LAYOUT: 'UNVERIFIED',
      DETAILS: 'UNVERIFIED',
    };
    report.functional.liveSell = {
      CREATE: 'UNVERIFIED',
      DELIVERY: 'UNVERIFIED',
      ACCEPT: 'UNVERIFIED',
      SESSION: 'UNVERIFIED',
      CHAT: 'UNVERIFIED',
      GIFT: 'UNVERIFIED',
      SCORE: 'UNVERIFIED',
      TIMER: 'UNVERIFIED',
      RECONNECT: 'UNVERIFIED',
      END: 'UNVERIFIED',
      LIVE_CONTINUES: 'UNVERIFIED',
      reason: 'commerce_live_failed',
      diag: commerceLive.diag,
    };
  }

  const detailsFail = g1.DETAILS !== 'PASS';
  const teamMissing = teamModes.some((m) => !report.visual[m.key]?.actual);
  const liveSellMissing = !report.visual.liveSell?.actual;
  report.failingStage = detailsFail ? '1v1_details' : teamMissing ? 'team_visual' : liveSellMissing ? 'live_sell' : '1v1_details';
  report.status = detailsFail
    ? 'NOT COMPLETE — 1V1 PK DETAIL PARITY FAILED'
    : teamMissing
      ? 'NOT COMPLETE — TEAM PK VISUAL PARITY UNVERIFIED'
      : liveSellMissing
        ? 'NOT COMPLETE — LIVE SELL PK UNVERIFIED'
        : 'NOT COMPLETE — 1V1 PK DETAIL PARITY FAILED';

  fs.writeFileSync(path.join(parityRoot, 'pk-capture-report.json'), JSON.stringify({ ...report, notes }, null, 2));
  await hostCtx.close();
  await guestCtx.close();
  await browser.close();
  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err);
  try {
    const dest = path.join(parityRoot, 'pk-capture-report.json');
    const existing = fs.existsSync(dest) ? JSON.parse(fs.readFileSync(dest, 'utf8')) : {};
    fs.writeFileSync(
      dest,
      JSON.stringify({ ...existing, crash: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : null }, null, 2),
    );
  } catch {
    /* ignore */
  }
  process.exit(1);
});
