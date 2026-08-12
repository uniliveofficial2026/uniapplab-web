#!/usr/bin/env node
/**
 * Smoke: K-Star profile → manage tab must not hit React #301.
 * Usage: node scripts/smoke-manage-tab.mjs [baseUrl]
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'http://localhost:5173';
const errors = [];

function findPlaywrightChromiumExecutable() {
  const roots = [
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    path.join(os.homedir(), '.cache/ms-playwright'),
    path.join(process.cwd(), '.local/playwright-browsers'),
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
      const full = path.join(
        root,
        entry,
        'chrome-mac/Chromium.app/Contents/MacOS/Chromium',
      );
      if (fs.existsSync(full)) return full;
    }
  }
  return null;
}

async function launchSmokeBrowser() {
  const executablePath = findPlaywrightChromiumExecutable();
  if (executablePath) {
    try {
      return await chromium.launch({ headless: true, executablePath });
    } catch {
      /* incomplete playwright bundle — fall through */
    }
  }
  return chromium.launch({ channel: 'chrome', headless: true });
}

async function ensureDemoMainApp(page) {
  // Desktop width so sidebar labels (Karaoke) are visible; mobile bottom nav is icon-only.
  await page.setViewportSize({ width: 1280, height: 900 });

  await page.goto(`${base}/karaoke?launch=main&as=u1&force_demo=1`, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });

  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const skipOnboarding = page.getByRole('button', { name: /skip onboarding/i });
    if (await skipOnboarding.isVisible().catch(() => false)) {
      await skipOnboarding.click();
    }

    const skip = page.getByRole('button', { name: /^skip$/i });
    if (await skip.isVisible().catch(() => false)) {
      await skip.click();
    }

    const next = page.getByRole('button', { name: /^next$/i });
    if (await next.isVisible().catch(() => false)) {
      await next.click();
    }

    const switchBtn = page.getByText('Switch as @designer_dude');
    if (await switchBtn.isVisible().catch(() => false)) {
      await switchBtn.click();
    }

    const profileEntry = page.locator('button:has(img[alt="Profile"])').first();
    const karaokeNav = page.getByRole('button', { name: /^Karaoke$/i }).first();
    const karaokeLabel = page.getByText('Karaoke', { exact: true }).first();
    const ready =
      (await profileEntry.isVisible().catch(() => false)) ||
      (await karaokeNav.isVisible().catch(() => false)) ||
      (await karaokeLabel.isVisible().catch(() => false));
    if (ready) return;

    await page.waitForTimeout(1500);
  }

  await page.locator('button:has(img[alt="Profile"])').first().waitFor({
    state: 'visible',
    timeout: 5_000,
  });
}

async function openKaraokeManageTab(page) {
  await ensureDemoMainApp(page);

  const karaokeNav = page.getByRole('button', { name: /^Karaoke$/i }).first();
  if (await karaokeNav.isVisible().catch(() => false)) {
    await karaokeNav.click();
  } else {
    const karaokeLabel = page.getByText('Karaoke', { exact: true }).first();
    if (await karaokeLabel.isVisible().catch(() => false)) {
      await karaokeLabel.click();
    }
  }

  const profileEntry = page.locator('button:has(img[alt="Profile"])').first();
  await profileEntry.waitFor({ state: 'visible', timeout: 30_000 });
  await profileEntry.click();
  await page.getByRole('button', { name: /^Manage$/i }).waitFor({
    state: 'visible',
    timeout: 30_000,
  });
  await page.getByRole('button', { name: /^Manage$/i }).click();

  await page
    .getByText(/Rooms you own, co-own|Create New Room|My Rooms|Co-owner/i)
    .first()
    .waitFor({
      state: 'visible',
      timeout: 30_000,
    });
  await page.waitForTimeout(1000);
}

async function main() {
  const browser = await launchSmokeBrowser();
  const page = await browser.newPage();

  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    const text = msg.text();
    if (
      /Minified React error #301|Too many re-renders|Maximum update depth/i.test(text)
    ) {
      errors.push(`console: ${text}`);
    }
  });

  await openKaraokeManageTab(page);

  const manageCopy = page.getByText(/Rooms you own, co-own, or admin/i);
  const createRoom = page.getByText('Create New Room');
  const visible =
    (await manageCopy.isVisible().catch(() => false)) ||
    (await createRoom.isVisible().catch(() => false));

  await browser.close();

  if (errors.length > 0) {
    console.error('FAIL — React render loop detected:');
    for (const e of errors) console.error(' ', e);
    process.exit(1);
  }

  if (!visible) {
    console.error('FAIL — manage tab UI did not appear (check auth / karaoke mount).');
    process.exit(1);
  }

  console.log('PASS — manage tab loaded without React #301.');
}

main().catch((err) => {
  console.error('FAIL — smoke script error:', err);
  process.exit(1);
});
