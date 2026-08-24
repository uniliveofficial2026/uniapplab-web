#!/usr/bin/env node
/**
 * Real two-account 1v1 PK activation trace.
 * Does not use force_demo, probes, or fake Practice rival.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const outDir = path.join(appRoot, '.local-dev/v14-parity');
const base = (process.argv[2] ?? process.env.V14_CAPTURE_URL ?? 'http://localhost:5173').replace(/\/$/, '');
const VW = 390;
const VH = 844;

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
  }).catch(() => {});
}

async function clickByText(page, re, timeout = 4000) {
  const btn = page.getByRole('button', { name: re }).first();
  if (await btn.isVisible().catch(() => false)) {
    await btn.click({ timeout }).catch(() => {});
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
        Array.from(document.querySelectorAll('button')).find((b) =>
          /skip/i.test(b.getAttribute('aria-label') || b.textContent || ''),
        );
      if (skip) {
        skip.click();
        return 'skip';
      }
      const next = document.querySelector('[aria-label="Next"]');
      if (next) {
        next.click();
        return 'next';
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

function attachNet(page, bucket) {
  page.on('response', async (res) => {
    const url = res.url();
    if (!/\/api\/live\/(pk|rooms)\//.test(url)) return;
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
          ? JSON.parse(
              JSON.stringify(body, (key, value) =>
                /token|authorization|secret/i.test(key) ? '[redacted]' : value,
              ),
            )
          : String(body || '').slice(0, 400),
    });
  });
}

async function snapshot(page) {
  return page.evaluate(() => {
    let userId = null;
    for (const key of Object.keys(localStorage)) {
      if (!/auth-token|supabase/i.test(key)) continue;
      try {
        const parsed = JSON.parse(localStorage.getItem(key) || '');
        userId =
          parsed?.user?.id ||
          parsed?.currentSession?.user?.id ||
          parsed?.session?.user?.id ||
          userId;
      } catch {
        /* ignore */
      }
    }
    return {
      href: location.href,
      userId,
      pkBattle: Boolean(document.querySelector('button[aria-label="PK battle"]')),
      pkRoom: document.querySelectorAll('[data-testid="one-vs-one-pk-room"], [data-ui-id="live.pk.1v1.room"]').length,
      overlay: document.querySelectorAll('.u1pk-overlay').length,
      accept: Boolean(
        Array.from(document.querySelectorAll('button')).find((b) => /accept pk/i.test(b.textContent || '')),
      ),
      hosts: Array.from(document.querySelectorAll('[data-pk-host-user-id]')).map((el) => ({
        userId: el.getAttribute('data-pk-host-user-id'),
        roomId: el.getAttribute('data-pk-host-room-id'),
        text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120),
      })),
      trace: window.__UNILIVE_PK_TRACE__ || null,
      body: (document.body.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 280),
    };
  });
}

async function loginEmail(page, email, password, notes) {
  await page.goto(`${base}/karaoke?launch=main`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(6000);
  await dismissDev(page);
  await skipGates(page);
  for (let i = 0; i < 24; i += 1) {
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
      hasEmail: Boolean(document.querySelector('[aria-label="Sign Up with Email"]')),
    })).catch(() => ({ hasEmail: false }));
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
        await demo.click({ timeout: 8000 }).catch(() => {});
        for (let wait = 0; wait < 40; wait += 1) {
          const karaokeReady = await page.getByText(/K-Star|Party Rooms|Trending/i).first().isVisible().catch(() => false);
          if (karaokeReady) break;
          await page.waitForTimeout(500);
        }
        break;
      }
    }
    const emailBox = page.locator('input[type="email"], input[autocomplete="email"]').first();
    const onSignup = (await page.getByRole('button', { name: /^sign up$/i }).count()) > 0;
    if (!onSignup && (await emailBox.isVisible().catch(() => false))) {
      await emailBox.fill(email).catch(() => {});
      await page.locator('input[type="password"]').first().fill(password).catch(() => {});
      await clickByText(page, /^Log in$/i);
      for (let wait = 0; wait < 40; wait += 1) {
        const karaokeReady = await page.getByText(/K-Star|Party Rooms|Trending/i).first().isVisible().catch(() => false);
        if (karaokeReady) break;
        await page.waitForTimeout(500);
      }
      break;
    }
    const karaoke = await page.getByText(/K-Star|Party Rooms|Trending/i).first().isVisible().catch(() => false);
    if (karaoke) break;
  }
  await skipGates(page);
  await dismissDev(page);
  notes.push({ step: 'after_login', email, snap: await snapshot(page) });
}

async function enterSoloLive(page, notes, roomName) {
  await page.goto(`${base}/karaoke?launch=main`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(4000);
  await skipGates(page);
  for (let i = 0; i < 25; i += 1) {
    await skipGates(page);
    await dismissDev(page);
    const ready = await page.getByText(/K-Star|Studio|Party Rooms|Trending|Karaoke/i).first().isVisible().catch(() => false);
    if (ready) break;
    await page.waitForTimeout(500);
  }
  await dismissDev(page);
  await clickByText(page, /^Party Rooms$/i) || await clickByText(page, /^Party$/i);
  await page.waitForTimeout(800);
  const started =
    (await clickByText(page, /Start Room/i)) ||
    (await clickByText(page, /Create a Room/i)) ||
    (await clickByText(page, /Create Room/i));
  if (!started) {
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('instant-room-open', { detail: { path: '/room/create', entry: 'karaoke-party' } }));
    }).catch(() => {});
    await page.waitForTimeout(1200);
  }
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const solo = btns.find((b) => /^\s*Solo\s*$/i.test((b.textContent || '').trim()));
    solo?.click();
  });
  await page.waitForTimeout(400);
  await page.evaluate((name) => {
    const input = document.querySelector('#create-room-name-live, input[placeholder*="vibe"], input[placeholder*="Room"]');
    if (input && 'value' in input) {
      const proto = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
      proto?.set?.call(input, name);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }, roomName);
  await clickByText(page, /^Go Live$/i) || await clickByText(page, /Go Live/i) || await clickByText(page, /Launch Room/i);
  await page.waitForTimeout(1000);
  await page.getByLabel(/skip countdown/i).click({ timeout: 1500 }).catch(() => {});
  await page.evaluate(() => {
    const skip = Array.from(document.querySelectorAll('button')).find((b) =>
      /skip countdown|tap to skip/i.test(`${b.getAttribute('aria-label') || ''} ${b.textContent || ''}`),
    );
    skip?.click();
  }).catch(() => {});
  let live = false;
  for (let i = 0; i < 30; i += 1) {
    await dismissDev(page);
    if (await page.getByRole('button', { name: 'PK battle' }).count()) {
      live = true;
      break;
    }
    await page.waitForTimeout(500);
  }
  notes.push({ step: 'live_room', roomName, live, snap: await snapshot(page) });
  return live;
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const notes = [];
  const netA = [];
  const netB = [];
  let failingStage = 'not_started';
  const browser = await launchBrowser();

  const hostCtx = await newContext(browser);
  const host = await hostCtx.newPage();
  attachNet(host, netA);
  await loginEmail(host, 'demo@unilive.app', 'demo123', notes);
  const hostLive = await enterSoloLive(host, notes, 'V14 Parity Host');
  if (!hostLive) failingStage = 'host_a_go_live';

  const guestCtx = await newContext(browser);
  const guest = await guestCtx.newPage();
  attachNet(guest, netB);
  await loginEmail(guest, 'sarah@unilive.app', 'demo123', notes);
  const guestLive = await enterSoloLive(guest, notes, 'V14 Parity Opponent');
  if (hostLive && !guestLive) failingStage = 'host_b_go_live';

  const hostSnap = await snapshot(host);
  const guestSnap = await snapshot(guest);
  notes.push({
    step: 'identities',
    hostA: { userId: hostSnap.userId, live: hostSnap.pkBattle },
    hostB: { userId: guestSnap.userId, live: guestSnap.pkBattle },
    sameUser: Boolean(hostSnap.userId && hostSnap.userId === guestSnap.userId),
  });
  if (hostSnap.userId && hostSnap.userId === guestSnap.userId) {
    failingStage = 'same_authenticated_user';
  }

  if (hostLive && guestLive && failingStage === 'not_started') {
    failingStage = 'host_discovery';
    await host.getByRole('button', { name: 'PK battle' }).first().click({ timeout: 4000 }).catch(() => {});
    await host.waitForTimeout(1200);
    let found = null;
    const guestId = guestSnap.userId || guestSnap.trace?.currentUserId || guestSnap.trace?.selfUserId || 'u2';
    const selfId = hostSnap.userId || hostSnap.trace?.selfUserId || 'u1';
    for (let i = 0; i < 24; i += 1) {
      const snap = await snapshot(host);
      notes.push({ step: 'pk_invite_poll', n: i, hosts: snap.hosts, trace: snap.trace, guestId, selfId });
      found =
        snap.hosts.find((row) => row.userId && row.userId === guestId) ||
        snap.hosts.find((row) => row.userId && row.userId !== selfId) ||
        snap.hosts.find((row) => /sarah|creative|parity opponent|live host/i.test(row.text || ''));
      if (found) break;
      await host.waitForTimeout(1000);
    }
    if (found) {
      failingStage = 'createPkChallenge';
      await host.locator(`[data-pk-host-user-id="${found.userId}"]`).first().click({ timeout: 3000 }).catch(() => {});
      await host.getByRole('button', { name: /send invite/i }).first().click({ timeout: 3000 }).catch(() => {});
      await host.waitForTimeout(1200);
      notes.push({ step: 'challenge_sent', snap: await snapshot(host), found });

      failingStage = 'challenge_accept';
      let accepted = false;
      for (let i = 0; i < 20; i += 1) {
        const accept = guest.getByRole('button', { name: /Accept PK/i }).first();
        if (await accept.isVisible().catch(() => false)) {
          await accept.click({ timeout: 4000 }).catch(() => {});
          accepted = true;
          break;
        }
        await guest.waitForTimeout(500);
      }
      notes.push({ step: 'accept_attempt', accepted, snap: await snapshot(guest) });
      if (accepted) {
        failingStage = 'pk_session_mount';
        await host.waitForTimeout(2000);
        const pk = await snapshot(host);
        notes.push({ step: 'pk_active', snap: pk });
        if (pk.pkRoom > 0) {
          failingStage = null;
          await host.screenshot({ path: path.join(outDir, 'pk-active-before-tools.png'), fullPage: false }).catch(() => {});
        }
      }
    } else {
      notes.push({ step: 'host_discovery_empty', snap: await snapshot(host), guestUserId: guestSnap.userId });
    }
  }

  const report = {
    base,
    failingStage,
    hostA: hostSnap,
    hostB: guestSnap,
    netA,
    netB,
    notes,
  };
  fs.writeFileSync(path.join(outDir, 'pk-trace.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({
    failingStage,
    hostA: { userId: hostSnap.userId, live: hostSnap.pkBattle, pkRoom: (await snapshot(host)).pkRoom },
    hostB: { userId: guestSnap.userId, live: guestSnap.pkBattle },
    netA: netA.length,
    netB: netB.length,
  }, null, 2));

  await hostCtx.close();
  await guestCtx.close();
  await browser.close();
  process.exit(failingStage ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
