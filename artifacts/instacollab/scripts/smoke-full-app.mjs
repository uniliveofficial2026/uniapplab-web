#!/usr/bin/env node
/**
 * Full-app live smoke across every primary shell screen.
 * Collects real pageerrors, error-boundary UI, and blank shells.
 *
 * Usage: node scripts/smoke-full-app.mjs [baseUrl]
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const base = (process.argv[2] ?? 'http://127.0.0.1:5173').replace(/\/$/, '');
const OUT_DIR = path.join(REPO_ROOT, '.local/live-smoke');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');

const SCREENS = [
  { id: 'home', path: '/home' },
  { id: 'search', path: '/explore' },
  { id: 'reels', path: '/reels' },
  { id: 'messages', path: '/messages' },
  { id: 'notifications', path: '/notifications' },
  { id: 'workspace', path: '/workspace' },
  { id: 'dating', path: '/dating' },
  { id: 'profile', path: '/profile' },
  { id: 'live', path: '/live', cautious: true },
  { id: 'karaoke', path: '/karaoke' },
  { id: 'rooms', path: '/party', cautious: true },
  { id: 'local-games', path: '/games' },
  { id: 'third-party-games', path: '/games/web' },
  { id: 'wallet', path: '/wallet' },
  { id: 'youtube', path: '/youtube' },
];

const IGNORE_CONSOLE = [
  /Download the React DevTools/i,
  /\[vite\]/i,
  /favicon\.ico/i,
  /Failed to load resource:.*\b(404|401|403|400)\b/i,
  /net::ERR_/i,
  /ResizeObserver loop/i,
  /\[cache-first\]/i,
  /\[cloud-systems\]/i,
  /\[sync\]/i,
  /\[net:/i,
  /\[instant-task\]/i,
  /\[gift-wallet/i,
  /Speed Insights/i,
  /third-party cookie/i,
  /Allow attribute will take precedence/i,
  /was preloaded using link preload but not used/i,
  /\[cloud-auth\]/i,
  /\[supabase\]/i,
  /\[firebase\]/i,
  /WebSocket connection/i,
  /Failed to fetch/i,
  /AbortError/i,
  /The play\(\) request was interrupted/i,
  /NotAllowedError/i,
  /Permission denied/i,
  /getUserMedia/i,
  /Access to fetch at 'https:\/\/pub-/i,
  /r2\.dev\//i,
  /\/__ux\/signal/i,
  /\/api\/youtube\//i,
];

const IGNORE_PAGE_ERROR = [
  /Loading chunk .* failed/i,
  /ChunkLoadError/i,
  /NotAllowedError/i,
  /Permission denied/i,
];

function findPlaywrightChromiumExecutable() {
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

async function launchBrowser() {
  const executablePath = findPlaywrightChromiumExecutable();
  const args = [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    '--autoplay-policy=no-user-gesture-required',
  ];
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

function shouldIgnore(list, text) {
  return list.some((re) => re.test(text));
}

async function dismissLaunchOverlays(page, maxMs = 20_000) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const skipOnboarding = page.getByRole('button', { name: /skip onboarding/i }).first();
    if (await skipOnboarding.isVisible().catch(() => false)) {
      await skipOnboarding.click({ timeout: 1_500 }).catch(() => undefined);
    }

    for (const name of [/^skip$/i, /^next$/i, /^continue$/i, /^enter app$/i, /^get started$/i]) {
      const btn = page.getByRole('button', { name }).first();
      if (await btn.isVisible().catch(() => false)) {
        await btn.click({ timeout: 1_500 }).catch(() => undefined);
      }
    }
    const switchBtn = page.getByText(/Switch as @designer_dude/i);
    if (await switchBtn.isVisible().catch(() => false)) {
      await switchBtn.click({ timeout: 1_500 }).catch(() => undefined);
    }

    const ready =
      (await page.locator('#root').locator('nav, [role="navigation"], main, [data-app-shell]').first().isVisible().catch(() => false)) ||
      (await page.getByText('Karaoke', { exact: true }).first().isVisible().catch(() => false)) ||
      (await page.locator('button, a, input').first().isVisible().catch(() => false));
    if (ready) return true;
    await page.waitForTimeout(250);
  }
  return false;
}

async function hasRealErrorBoundary(page) {
  const crashTitle = page.getByText('Something went wrong', { exact: true });
  if (!(await crashTitle.isVisible().catch(() => false))) return false;
  const retry = page.getByRole('button', { name: /try again|reload app/i });
  return retry.isVisible().catch(() => false);
}

async function probeScreen(page, screen, bag, { first }) {
  const url = `${base}${screen.path}?launch=main&as=u1&force_demo=1`;
  const started = Date.now();
  const beforePage = bag.pageErrors.length;
  const beforeConsole = bag.consoleErrors.length;

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25_000 });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    bag.failures.push({ screen: screen.id, kind: 'navigation', detail: detail.slice(0, 200) });
    return {
      id: screen.id,
      path: screen.path,
      ms: Date.now() - started,
      ok: false,
      errorBoundary: false,
      blank: true,
    };
  }

  if (first) {
    await dismissLaunchOverlays(page, 20_000);
  } else {
    await dismissLaunchOverlays(page, 3_000);
  }

  // A few animation frames to settle React + lazy chunks.
  await page.waitForTimeout(screen.cautious ? 1_200 : 700);

  const errorBoundary = await hasRealErrorBoundary(page);
  const rootChildCount = await page.locator('#root *').count().catch(() => 0);
  const bodyLen = ((await page.locator('body').innerText().catch(() => '')) || '').trim().length;
  const blank = rootChildCount < 3 || bodyLen < 8;

  if (!screen.cautious) {
    await page.mouse.wheel(0, 320).catch(() => undefined);
    await page.waitForTimeout(150);
  }

  // Karaoke sub-surfaces (known crash hotspots).
  if (screen.id === 'karaoke') {
    for (const name of ['Sing', 'Challenge', 'Duets', 'Live']) {
      const tab = page.getByRole('button', { name: new RegExp(`^${name}$`, 'i') }).first();
      if (await tab.isVisible().catch(() => false)) {
        await tab.click({ timeout: 2_000 }).catch(() => undefined);
        await page.waitForTimeout(450);
        if (await hasRealErrorBoundary(page)) {
          bag.failures.push({
            screen: screen.id,
            kind: 'error_boundary',
            detail: `Karaoke sub-tab "${name}" crashed`,
          });
        }
      }
    }
  }

  const shot = path.join(OUT_DIR, `${stamp}-${screen.id}.png`);
  await page.screenshot({ path: shot, fullPage: false }).catch(() => undefined);

  const newPage = bag.pageErrors.slice(beforePage);
  const newConsole = bag.consoleErrors.slice(beforeConsole);

  if (errorBoundary) {
    const msg = (await page.locator('body').innerText().catch(() => '')) || '';
    bag.failures.push({
      screen: screen.id,
      kind: 'error_boundary',
      detail: msg.replace(/\s+/g, ' ').slice(0, 240),
    });
  }
  if (blank) {
    bag.failures.push({
      screen: screen.id,
      kind: 'blank_screen',
      detail: `rootChildren=${rootChildCount} bodyLen=${bodyLen}`,
    });
  }
  for (const err of newPage) {
    bag.failures.push({ screen: screen.id, kind: 'pageerror', detail: err });
  }
  for (const err of newConsole) {
    bag.failures.push({ screen: screen.id, kind: 'console_error', detail: err });
  }

  const ms = Date.now() - started;
  if (ms > 10_000) {
    bag.warnings.push({ screen: screen.id, kind: 'slow_settle', detail: `${ms}ms` });
  }

  return {
    id: screen.id,
    path: screen.path,
    ms,
    ok: !errorBoundary && !blank && newPage.length === 0 && newConsole.length === 0,
    errorBoundary,
    blank,
    pageErrors: newPage.length,
    consoleErrors: newConsole.length,
    screenshot: shot,
  };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const bag = {
    pageErrors: [],
    consoleErrors: [],
    consoleWarnings: [],
    failures: [],
    warnings: [],
  };

  console.log(`[smoke-full-app] base=${base}`);
  console.log(`[smoke-full-app] out=${OUT_DIR}`);

  const browser = await launchBrowser();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    permissions: ['camera', 'microphone'],
  });
  const page = await context.newPage();

  page.on('pageerror', (err) => {
    const text = err?.stack || err?.message || String(err);
    if (shouldIgnore(IGNORE_PAGE_ERROR, text)) return;
    bag.pageErrors.push(text.slice(0, 800));
  });

  page.on('console', (msg) => {
    const type = msg.type();
    const text = msg.text();
    if (type === 'error') {
      if (shouldIgnore(IGNORE_CONSOLE, text)) return;
      bag.consoleErrors.push(text.slice(0, 500));
    } else if (type === 'warning') {
      if (shouldIgnore(IGNORE_CONSOLE, text)) return;
      bag.consoleWarnings.push(text.slice(0, 400));
    }
  });

  page.on('response', (response) => {
    const status = response.status();
    if (status < 400) return;
    const url = response.url();
    // Ignore expected soft misses / third-party / demo-mode cloud noise.
    if (
      /favicon|chrome-extension|googletagmanager|google-analytics|vercel\.live|hot-update|speed-insights/i.test(url) ||
      /storage\.googleapis\.com\/gtv-videos-bucket/i.test(url) ||
      /supabase\.co\/auth\/v1\/health/i.test(url) ||
      /\/api\/(automation|platform\/brand|health|stream\/|ux\/signals|youtube\/)/i.test(url) ||
      /supabase\.co\/rest\/v1\/(profiles|streams)/i.test(url) ||
      /r2\.dev\//i.test(url)
    ) {
      return;
    }
    // Demo-mode auth/API 401s are expected without a cloud session.
    if ((status === 401 || status === 403) && /\/api\/|supabase\.co/i.test(url)) return;
    bag.consoleErrors.push(`HTTP ${status} ${url.slice(0, 220)}`);
  });

  page.on('requestfailed', (request) => {
    const url = request.url();
    const err = request.failure()?.errorText || 'failed';
    if (/favicon|chrome-extension|net::ERR_ABORTED|ERR_BLOCKED_BY_ORB/i.test(`${url} ${err}`)) return;
    if (/websocket|realtime|livekit|gtv-videos-bucket|r2\.dev|api\.uniapplab\.com/i.test(url)) return;
    if (/\/api\/(automation|platform\/brand|stream\/|ux\/signals)/i.test(url)) return;
    bag.consoleErrors.push(`REQFAIL ${err} ${url.slice(0, 200)}`);
  });

  const results = [];
  for (let i = 0; i < SCREENS.length; i += 1) {
    const screen = SCREENS[i];
    process.stdout.write(`  → ${screen.id.padEnd(18)} `);
    const row = await probeScreen(page, screen, bag, { first: i === 0 });
    results.push(row);
    console.log(`${row.ok ? 'ok' : 'FAIL'} ${row.ms}ms` +
      (row.errorBoundary ? ' [boundary]' : '') +
      (row.blank ? ' [blank]' : '') +
      (row.pageErrors ? ` [pageerr=${row.pageErrors}]` : '') +
      (row.consoleErrors ? ` [cerr=${row.consoleErrors}]` : ''));
  }

  await browser.close();

  const uniqueFailures = [];
  const seen = new Set();
  for (const f of bag.failures) {
    const key = `${f.screen}|${f.kind}|${String(f.detail).slice(0, 120)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueFailures.push(f);
  }

  const report = {
    base,
    stamp,
    screens: results,
    failureCount: uniqueFailures.length,
    failures: uniqueFailures,
    warningCount: bag.warnings.length + new Set(bag.consoleWarnings).size,
    slowScreens: bag.warnings,
    consoleWarnings: [...new Set(bag.consoleWarnings)].slice(0, 40),
  };

  const reportPath = path.join(OUT_DIR, `${stamp}-report.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log('\n──────── summary ────────');
  console.log(`passed: ${results.filter((r) => r.ok).length}/${results.length}`);
  console.log(`failures: ${uniqueFailures.length}`);
  console.log(`report: ${reportPath}`);
  if (uniqueFailures.length) {
    console.log('\nFailures:');
    for (const f of uniqueFailures.slice(0, 60)) {
      console.log(`  [${f.screen}] ${f.kind}: ${String(f.detail).slice(0, 180)}`);
    }
  }

  process.exit(uniqueFailures.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
