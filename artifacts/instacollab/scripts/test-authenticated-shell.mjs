#!/usr/bin/env node
/**
 * Authenticated production shell crawl (browser).
 * Uses cloud demo accounts that provision via Supabase (not local-only IDB demo).
 *
 * Env overrides:
 *   UNILIVE_E2E_EMAIL / UNILIVE_E2E_PASSWORD
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const outDir = path.resolve('../../docs/full-app-recovery/evidence');
fs.mkdirSync(outDir, { recursive: true });

const EMAIL = (process.env.UNILIVE_E2E_EMAIL || 'demo@unilive.app').trim();
const PASSWORD = (process.env.UNILIVE_E2E_PASSWORD || 'demo123').trim();
const BASE = process.env.UNILIVE_E2E_BASE || 'https://app.uniapplab.com';

const result = {
  base: BASE,
  email: EMAIL.replace(/^(.).+(@.*)$/, '$1***$2'),
  steps: [],
  networkFailures: [],
  consoleErrors: [],
  apiSamples: [],
  shell: {},
  status: 'FAIL',
};

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
});
const page = await context.newPage();

page.on('console', (msg) => {
  if (msg.type() === 'error') result.consoleErrors.push(msg.text().slice(0, 240));
});
page.on('response', (res) => {
  const u = res.url();
  const st = res.status();
  if (u.includes('/api/') && st) {
    result.apiSamples.push({ status: st, url: u.slice(0, 180) });
  }
  if (
    st >= 400 &&
    (/\.(js|css|wasm|webm|svga|woff2?)(\?|$)/i.test(u) || u.includes('/api/'))
  ) {
    result.networkFailures.push({ status: st, url: u.slice(0, 200) });
  }
  if (/localhost|127\.0\.0\.1|vercel\.app/i.test(u) && !u.includes('chrome-extension')) {
    result.networkFailures.push({ status: st, url: `FORBIDDEN_HOST:${u.slice(0, 200)}` });
  }
});

async function shot(name) {
  const p = path.join(outDir, `auth-${name}.png`);
  await page.screenshot({ path: p, fullPage: false });
  result.steps.push({ name, url: page.url(), screenshot: p });
}

async function clickIf(role, name, opts = {}) {
  const loc = page.getByRole(role, { name });
  if ((await loc.count()) > 0) {
    await loc.first().click({ force: true, timeout: 5000, ...opts });
    await page.waitForTimeout(700);
    return true;
  }
  return false;
}

try {
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(5000);
  await shot('01-boot');

  // Clear through onboarding if present
  for (let i = 0; i < 5; i++) {
    if (await clickIf('button', 'Next')) continue;
    if (await clickIf('button', 'Get started')) break;
    if (await clickIf('button', 'Skip onboarding')) break;
    break;
  }
  await shot('02-auth-or-shell');

  // If already signed in, skip login
  const alreadyHome =
    (await page.getByRole('button', { name: /Home|Feed/i }).count()) > 0 ||
    (await page.locator('[data-tab="home"], [aria-label="Home"]').count()) > 0;

  if (!alreadyHome) {
    await clickIf('button', /Agree to Terms/i);
    // Prefer email login path
    const signup = page.getByRole('button', { name: /Sign Up with Email|Sign in with Email|Email/i });
    if ((await signup.count()) > 0) {
      await signup.first().click({ force: true });
      await page.waitForTimeout(800);
    }
    // Switch to Log in if on signup form
    await clickIf('button', /^Log in$/i);
    await clickIf('link', /^Log in$/i);

    const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="Email" i]').first();
    const passInput = page.locator('input[type="password"]').first();
    await emailInput.waitFor({ timeout: 15000 });
    await emailInput.fill(EMAIL);
    await passInput.fill(PASSWORD);
    await shot('03-login-filled');

    // Submit
    if (!(await clickIf('button', /^Log in$/i))) {
      await clickIf('button', /Sign in|Sign up|Continue/i);
    }
    await page.waitForTimeout(5000);
  }

  await shot('04-after-login');

  // Authenticated API probes from page context (uses real session cookies/tokens)
  const apiProbe = await page.evaluate(async () => {
    const out = {};
    async function hit(path, init) {
      try {
        const r = await fetch(path, { credentials: 'include', ...(init || {}) });
        const text = await r.text();
        let body = text.slice(0, 200);
        try {
          body = JSON.parse(text);
        } catch {
          /* keep text */
        }
        out[path] = { status: r.status, body };
      } catch (e) {
        out[path] = { status: 0, error: String(e) };
      }
    }
    await hit('/api/chat/threads');
    await hit('/api/me/identities');
    await hit('/api/gifts/catalog');
    await hit('/api/presence/offline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    await hit('/api/v1/health');
    // bootstrap websocket must not be localhost after client sanitize
    try {
      const b = await fetch('/api/app-config/bootstrap').then((r) => r.json());
      out.bootstrapWebsocket = b?.public?.websocketOrigin || null;
    } catch (e) {
      out.bootstrapWebsocket = String(e);
    }
    return out;
  });
  result.authenticatedApi = apiProbe;

  // Navigate major shell destinations via bottom/tab UI when available
  const tabs = ['Home', 'Reels', 'Messages', 'Live', 'Profile', 'Marketplace', 'Wallet', 'Discover'];
  for (const tab of tabs) {
    const clicked =
      (await clickIf('button', new RegExp(`^${tab}$`, 'i'))) ||
      (await clickIf('link', new RegExp(`^${tab}$`, 'i'))) ||
      (await page.locator(`[aria-label="${tab}"]`).first().click({ force: true, timeout: 1500 }).then(() => true).catch(() => false));
    result.shell[tab] = { clicked: Boolean(clicked), url: page.url() };
    if (clicked) {
      await page.waitForTimeout(1200);
      await shot(`tab-${tab.toLowerCase()}`);
    }
  }

  const threadsOk = apiProbe['/api/chat/threads']?.status === 200;
  const identitiesOk = apiProbe['/api/me/identities']?.status === 200;
  const giftsOk = apiProbe['/api/gifts/catalog']?.status === 200;
  const ws = String(apiProbe.bootstrapWebsocket || '');
  const wsOk = ws && !/localhost|127\.0\.0\.1/i.test(ws);

  result.status =
    threadsOk && identitiesOk && giftsOk && wsOk ? 'PASS_AUTH_API' : 'FAIL';
  // Shell nav is separately scored — may still fail if tabs not found
  result.signedInShell = Object.values(result.shell).some((t) => t.clicked)
    ? 'PARTIAL_OR_PASS'
    : 'FAIL';

  fs.writeFileSync(path.join(outDir, 'auth-crawl-result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  if (result.status === 'FAIL') process.exitCode = 1;
} catch (err) {
  result.error = String(err?.stack || err);
  fs.writeFileSync(path.join(outDir, 'auth-crawl-result.json'), JSON.stringify(result, null, 2));
  console.error(result.error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
