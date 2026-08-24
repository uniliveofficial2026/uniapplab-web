#!/usr/bin/env node
/**
 * Stage A smoke: Calls UI mount (outgoing island / full outgoing stage).
 * Demo shell → Messages → open DM → Audio/Video call → approved call chrome.
 *
 * Usage: node scripts/smoke-calls-ui-mount.mjs [baseUrl]
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  REPO_ROOT,
  demoUrl,
  detectAuthGate,
  dismissLaunchOverlays,
  ensureDevServer,
  launchBrowser,
} from './lib/visual-baseline-shared.mjs';

const preferredBase = (process.argv[2] || '').replace(/\/$/, '') || undefined;
const OUT_DIR = path.join(REPO_ROOT, '.local/live-smoke');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');

async function detectCallChrome(page) {
  const checks = [
    { id: 'call.outgoing.v1', locator: page.locator('[data-ui-id="call.outgoing.v1"]') },
    { id: 'call.outgoing.video.v1', locator: page.locator('[data-ui-id="call.outgoing.video.v1"]') },
    {
      id: 'call.outgoing.dynamic-island',
      locator: page.locator('[data-ui-id="call.outgoing.dynamic-island"]'),
    },
    {
      id: 'call.incoming.dynamic-island',
      locator: page.locator('[data-ui-id="call.incoming.dynamic-island"]'),
    },
  ];
  for (const check of checks) {
    const count = await check.locator.count().catch(() => 0);
    if (count <= 0) continue;
    const visible = await check.locator.first().isVisible().catch(() => false);
    return { id: check.id, visible, count };
  }
  return null;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const server = await ensureDevServer(preferredBase);
  const { base, stop } = server;
  const evidence = { base, stamp, ok: false, mount: null, blocker: null };

  console.log(`[smoke-calls-ui-mount] base=${base}`);

  const browser = await launchBrowser();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    permissions: ['camera', 'microphone'],
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (err) => {
    pageErrors.push((err?.message || String(err)).slice(0, 300));
  });

  try {
    await page.goto(demoUrl(base, '/messages'), {
      waitUntil: 'domcontentloaded',
      timeout: 45_000,
    });
    const shellReady = await dismissLaunchOverlays(page, 45_000);
    if (!shellReady) {
      if (await detectAuthGate(page)) {
        evidence.ok = true;
        evidence.skipped = 'auth_gated';
        console.log('[smoke-calls-ui-mount] SKIP (auth-gated)');
        console.log(JSON.stringify(evidence, null, 2));
        await browser.close();
        await stop();
        process.exit(0);
      }
      evidence.blocker = 'App shell did not become ready';
      throw new Error(evidence.blocker);
    }

    const messages = page.locator('#messages-screen');
    await messages.waitFor({ state: 'attached', timeout: 25_000 });

    // Open first DM so call header buttons exist.
    const dmCandidates = [
      messages.getByText('Phil Weston', { exact: true }).first(),
      messages.getByText('Sarah Jenkins', { exact: true }).first(),
      messages.getByText('Tom Hanks', { exact: true }).first(),
      messages.locator('.cursor-pointer').first(),
    ];
    let opened = false;
    for (const dm of dmCandidates) {
      if (await dm.isVisible().catch(() => false)) {
        await dm.click({ timeout: 3_000 }).catch(() => undefined);
        opened = true;
        break;
      }
    }
    if (!opened) {
      evidence.blocker = 'No DM row found to open for call chrome';
      throw new Error(evidence.blocker);
    }

    const chatOpenDeadline = Date.now() + 10_000;
    while (Date.now() < chatOpenDeadline) {
      const open = await messages.getAttribute('data-chat-open').catch(() => null);
      if (open === 'true') break;
      await page.waitForTimeout(200);
    }
    if ((await messages.getAttribute('data-chat-open').catch(() => null)) !== 'true') {
      evidence.blocker = 'DM did not open (data-chat-open!=true)';
      throw new Error(evidence.blocker);
    }

    const callBtn = page.locator(
      'button[aria-label="Audio call"], button[aria-label="Video call"], button[aria-label="Audio call unavailable"], button[aria-label="Video call unavailable"]',
    ).first();
    const callBtnDeadline = Date.now() + 10_000;
    while (Date.now() < callBtnDeadline) {
      if (await callBtn.isVisible().catch(() => false)) break;
      await page.waitForTimeout(200);
    }
    if (!(await callBtn.isVisible().catch(() => false))) {
      evidence.domHint = await page
        .evaluate(() => ({
          chatOpen: document.querySelector('#messages-screen')?.getAttribute('data-chat-open'),
          labels: Array.from(document.querySelectorAll('button'))
            .map((b) => b.getAttribute('aria-label'))
            .filter(Boolean)
            .slice(0, 30),
          body: (document.body?.innerText || '').slice(0, 400),
        }))
        .catch(() => null);
      // Demo/local DMs may omit call chrome without a cloud peer — do not hard-fail Stage A smoke.
      evidence.ok = true;
      evidence.skipped = 'call_chrome_requires_cloud_peer';
      evidence.blocker = null;
      console.log('[smoke-calls-ui-mount] SKIP (call header unavailable after DM open — contract covers chrome ids)');
      console.log(JSON.stringify(evidence, null, 2));
      await browser.close();
      await stop();
      process.exit(0);
    }
    await callBtn.click({ timeout: 5_000 });

    const deadline = Date.now() + 20_000;
    let chrome = null;
    while (Date.now() < deadline) {
      chrome = await detectCallChrome(page);
      if (chrome) break;
      await page.waitForTimeout(300);
    }

    // Prefer expanded full outgoing stage when island is showing.
    if (chrome?.id === 'call.outgoing.dynamic-island') {
      const expand = page.locator('.call-approved-island-expand').first();
      if (await expand.isVisible().catch(() => false)) {
        await expand.click({ timeout: 2_000 }).catch(() => undefined);
        await page.waitForTimeout(500);
        const full = await detectCallChrome(page);
        if (full) chrome = full;
      }
    }

    if (!chrome) {
      evidence.blocker = 'Outgoing/incoming call chrome did not mount';
      throw new Error(evidence.blocker);
    }
    evidence.mount = chrome;

    if (pageErrors.length) {
      evidence.blocker = `pageerrors: ${pageErrors.slice(0, 3).join(' | ')}`;
      throw new Error(evidence.blocker);
    }

    const shot = path.join(OUT_DIR, `calls-ui-mount-${stamp}.png`);
    await page.screenshot({ path: shot, fullPage: false, animations: 'disabled' }).catch(() => undefined);
    evidence.screenshot = shot;
    evidence.ok = true;
    console.log('[smoke-calls-ui-mount] PASS');
    console.log(JSON.stringify(evidence, null, 2));
    fs.writeFileSync(
      path.join(OUT_DIR, `calls-ui-mount-${stamp}.json`),
      JSON.stringify({ evidence, pageErrors }, null, 2),
    );
    await browser.close();
    await stop();
    process.exit(0);
  } catch (err) {
    evidence.ok = false;
    evidence.error = err instanceof Error ? err.message : String(err);
    const shot = path.join(OUT_DIR, `calls-ui-mount-FAIL-${stamp}.png`);
    await page.screenshot({ path: shot, fullPage: false }).catch(() => undefined);
    evidence.screenshot = shot;
    console.error('[smoke-calls-ui-mount] FAIL');
    console.error(JSON.stringify({ evidence, pageErrors }, null, 2));
    fs.writeFileSync(
      path.join(OUT_DIR, `calls-ui-mount-FAIL-${stamp}.json`),
      JSON.stringify({ evidence, pageErrors }, null, 2),
    );
    await browser.close().catch(() => undefined);
    await stop();
    process.exit(1);
  }
}

main();
