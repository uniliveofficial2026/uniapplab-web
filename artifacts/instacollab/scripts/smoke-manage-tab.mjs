#!/usr/bin/env node
/**
 * Smoke: K-Star profile → manage tab must not hit React #301.
 * Usage: node scripts/smoke-manage-tab.mjs [baseUrl]
 */
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'http://localhost:5173';
const errors = [];

async function openKaraokeManageTab(page) {
  await page.goto(`${base}/?launch=main`, { waitUntil: 'networkidle', timeout: 60_000 });
  await page.getByRole('button', { name: 'Karaoke', exact: true }).click();
  await page.getByText('Party Rooms', { exact: false }).first().waitFor({
    state: 'visible',
    timeout: 30_000,
  });
  await page.evaluate(() => {
    window.dispatchEvent(
      new CustomEvent('karaoke-profile-open', {
        detail: { profileTab: 'manage' },
      }),
    );
  });
  await page.waitForTimeout(2500);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
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
  const myRooms = page.getByText('My Rooms');
  const coOwner = page.getByText('Co-owner', { exact: true });
  const visible =
    (await manageCopy.isVisible().catch(() => false)) ||
    (await myRooms.isVisible().catch(() => false)) ||
    (await coOwner.isVisible().catch(() => false));

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
