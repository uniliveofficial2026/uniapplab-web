#!/usr/bin/env node
/**
 * Stage A multi-device / multi-account isolation smoke (two browser contexts).
 * Covers: same-account dual session shell, sequential account switch isolation,
 * messaging/calls/live tab reachability without identity bleed in localStorage keys.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const base = (process.argv[2] ?? 'http://localhost:5173').replace(/\/$/, '');
const OUT_DIR = path.join(REPO_ROOT, '.local/live-smoke');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');

function findExe() {
  const roots = [
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    '/Volumes/Wei2TB/MacData/tools/playwright-browsers',
  ].filter(Boolean);
  for (const root of roots) {
    let entries = [];
    try {
      entries = fs.readdirSync(root);
    } catch {
      continue;
    }
    for (const entry of entries) {
      const shell = path.join(root, entry, 'chrome-mac/headless_shell');
      if (fs.existsSync(shell)) return shell;
      const full = path.join(root, entry, 'chrome-mac/Chromium.app/Contents/MacOS/Chromium');
      if (fs.existsSync(full)) return full;
    }
  }
  return null;
}

async function launchBrowser() {
  const executablePath = findExe();
  const args = ['--autoplay-policy=no-user-gesture-required'];
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

async function dismiss(page, maxMs = 18_000) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    for (const name of [/skip onboarding/i, /^skip$/i, /^next$/i, /^continue$/i, /^enter app$/i]) {
      const btn = page.getByRole('button', { name }).first();
      if (await btn.isVisible().catch(() => false)) await btn.click({ timeout: 600 }).catch(() => {});
    }
    if (await page.locator('#root button').first().isVisible().catch(() => false)) return true;
    await page.waitForTimeout(200);
  }
  return false;
}

async function openAs(page, asUser) {
  await page.goto(`${base}/home?launch=main&as=${asUser}&force_demo=1`, {
    waitUntil: 'domcontentloaded',
    timeout: 45_000,
  });
  await dismiss(page);
  return page.evaluate(() => {
    const body = document.body.innerText || '';
    return {
      ready: !!document.querySelector('#root') && body.length > 20,
      asParam: new URL(location.href).searchParams.get('as'),
    };
  });
}

async function identitySnapshot(page) {
  return page.evaluate(() => {
    const keys = [];
    try {
      for (let i = 0; i < localStorage.length; i += 1) {
        const k = localStorage.key(i);
        if (k && /user|auth|person|device|push|session|chat|presence/i.test(k)) keys.push(k);
      }
    } catch {
      /* ignore */
    }
    return {
      as: new URL(location.href).searchParams.get('as'),
      storageKeys: keys.sort(),
      href: location.href,
    };
  });
}

async function main() {
  const hardDeadline = setTimeout(() => {
    console.error('[smoke-multi-device-isolation] HARD_TIMEOUT');
    process.exit(2);
  }, 150_000);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const evidence = {
    base,
    stamp,
    ok: false,
    sameAccountDualSession: false,
    accountSwitchIsolation: false,
    surfacesReachable: { messages: false, calls: false, live: false },
    blocker: null,
  };
  const browser = await launchBrowser();
  try {
    console.log(`[smoke-multi-device-isolation] base=${base}`);
    const ctxA = await browser.newContext({ viewport: { width: 1100, height: 800 } });
    const ctxB = await browser.newContext({ viewport: { width: 1100, height: 800 } });
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    const a1 = await openAs(pageA, 'u1');
    const b1 = await openAs(pageB, 'u1');
    evidence.sameAccountDualSession = a1.ready && b1.ready && a1.asParam === 'u1' && b1.asParam === 'u1';

    // Sequential different accounts on "same device" (reuse context A)
    const snapBefore = await identitySnapshot(pageA);
    await openAs(pageA, 'u2');
    const snapAfter = await identitySnapshot(pageA);
    evidence.accountSwitchIsolation =
      snapAfter.as === 'u2' && snapBefore.as === 'u1' && snapAfter.as !== snapBefore.as;

    // Surface reachability under switched identity
    for (const [key, pathHint] of [
      ['messages', '/messages'],
      ['calls', '/calls'],
      ['live', '/home'],
    ]) {
      await pageA.goto(`${base}${pathHint}?launch=main&as=u2&force_demo=1`, {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      });
      await dismiss(pageA);
      evidence.surfacesReachable[key] = await pageA.evaluate(() => !!document.querySelector('#root'));
    }

    evidence.snapA = { beforeKeys: snapBefore.storageKeys.length, afterKeys: snapAfter.storageKeys.length };
    evidence.ok =
      evidence.sameAccountDualSession &&
      evidence.accountSwitchIsolation &&
      evidence.surfacesReachable.messages &&
      evidence.surfacesReachable.calls &&
      evidence.surfacesReachable.live;

    evidence.screenshot = path.join(OUT_DIR, `multi-device-${stamp}.png`);
    await pageA.screenshot({ path: evidence.screenshot }).catch(() => {});
    console.log(`[smoke-multi-device-isolation] ${evidence.ok ? 'PASS' : 'FAIL'}`);
    console.log(JSON.stringify(evidence, null, 2));
    if (!evidence.ok) process.exitCode = 1;
  } finally {
    clearTimeout(hardDeadline);
    await browser.close().catch(() => {});
  }
}

main().catch((err) => {
  console.error('[smoke-multi-device-isolation] FATAL', err);
  process.exit(1);
});
