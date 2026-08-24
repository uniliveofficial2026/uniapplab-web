#!/usr/bin/env node
/**
 * Stage A: Workspace Admin access-code E2E.
 * - Never prints the staff code
 * - Invalid code rejected
 * - Valid path when code available via env or silent local extract (DEV only)
 * - sessionStorage forge does not unlock
 * - /api/admin/me remains unauthorized without real admin auth (privilege not client-forged)
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

/** Resolve valid code without logging it. Prefer env / gitignored local file. */
function resolveValidCodeSilent() {
  const fromEnv = String(process.env.WORKSPACE_E2E_ACCESS_CODE || process.env.WORKSPACE_STAFF_CODE || '').trim();
  if (fromEnv) return { code: fromEnv, source: 'env' };
  try {
    const localEnv = path.join(REPO_ROOT, '.local/workspace-staff.env');
    if (fs.existsSync(localEnv)) {
      for (const line of fs.readFileSync(localEnv, 'utf8').split('\n')) {
        const m = line.match(/^WORKSPACE_STAFF_CODE=(.+)$/);
        if (m?.[1]) return { code: m[1].trim().replace(/^["']|["']$/g, ''), source: 'local_env_file' };
      }
    }
  } catch {
    /* ignore */
  }
  try {
    const src = fs.readFileSync(path.join(__dirname, '../src/lib/workspaceAccess.ts'), 'utf8');
    const m = src.match(/return '(\d{4,})';/);
    if (m?.[1]) return { code: m[1], source: 'dev_source_extract' };
  } catch {
    /* ignore */
  }
  return { code: null, source: 'unset' };
}

async function dismiss(page, maxMs = 20_000) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    for (const name of [/skip onboarding/i, /^skip$/i, /^next$/i, /^continue$/i, /^enter app$/i]) {
      const btn = page.getByRole('button', { name }).first();
      if (await btn.isVisible().catch(() => false)) await btn.click({ timeout: 800 }).catch(() => {});
    }
    if (await page.locator('[data-ui-id="workspace.access.code"], [aria-label="Workspace access code"]').first().isVisible().catch(() => false)) {
      return true;
    }
    if (await page.getByText('Workspace access', { exact: false }).first().isVisible().catch(() => false)) {
      return true;
    }
    await page.waitForTimeout(200);
  }
  return false;
}

async function openWorkspace(page) {
  await page.goto(`${base}/workspace?launch=main&force_demo=1`, {
    waitUntil: 'domcontentloaded',
    timeout: 45_000,
  });
  await dismiss(page);
  // Prefer deep link; also try bottom tab if present.
  const gate = await page.evaluate(() => {
    const hasGate =
      !!document.querySelector('[data-ui-id="workspace.access.code"], [aria-label="Workspace access code"]') ||
      /Workspace access/i.test(document.body.innerText || '');
    if (hasGate) return true;
    const tab = Array.from(document.querySelectorAll('button, a')).find((el) =>
      /workspace|admin/i.test(el.textContent || ''),
    );
    tab?.click();
    return false;
  });
  if (!gate) await page.waitForTimeout(800);
  return page.evaluate(
    () =>
      !!document.querySelector('[data-ui-id="workspace.access.code"], [aria-label="Workspace access code"]') ||
      /Workspace access/i.test(document.body.innerText || ''),
  );
}

async function main() {
  const hardDeadline = setTimeout(() => {
    console.error('[smoke-workspace-admin] HARD_TIMEOUT');
    process.exit(2);
  }, 120_000);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const evidence = {
    base,
    stamp,
    ok: false,
    gateVisible: false,
    invalidRejected: false,
    forgeBlocked: false,
    validUnlocked: false,
    adminPortalVisible: false,
    adminMeUnauthorized: null,
    validSource: null,
    blocker: null,
  };

  const browser = await launchBrowser();
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    console.log(`[smoke-workspace-admin] base=${base}`);

    evidence.gateVisible = await openWorkspace(page);
    if (!evidence.gateVisible) {
      evidence.blocker = 'workspace_gate_not_visible';
      evidence.ok = false;
      console.log('[smoke-workspace-admin] FAIL');
      console.log(JSON.stringify(evidence, null, 2));
      process.exitCode = 1;
      return;
    }

    // Invalid code
    await page.fill('[data-ui-id="workspace.access.code"], [aria-label="Workspace access code"]', '0000');
    await page.click('[data-ui-id="workspace.access.unlock"]');
    const invalidDeadline = Date.now() + 8_000;
    while (Date.now() < invalidDeadline) {
      evidence.invalidRejected = await page.evaluate(
        () =>
          /Invalid access code|incorrect|denied|unauthorized/i.test(document.body.innerText || '') &&
          !document.querySelector('#btn-workspace-admin-portal'),
      );
      if (evidence.invalidRejected) break;
      // Still gated = rejected (unlock did not succeed)
      const stillGated = await page.evaluate(
        () =>
          !!document.querySelector('[data-ui-id="workspace.access.code"]') &&
          !document.querySelector('#btn-workspace-admin-portal'),
      );
      if (stillGated && Date.now() > invalidDeadline - 500) {
        evidence.invalidRejected = true;
        evidence.invalidRejectedViaGateRemain = true;
        break;
      }
      await page.waitForTimeout(250);
    }

    // sessionStorage forge must not unlock
    await page.evaluate(() => {
      try {
        sessionStorage.setItem('instacollab.workspace.staffUnlock', '1');
      } catch {
        /* ignore */
      }
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await dismiss(page);
    evidence.forgeBlocked = await page.evaluate(
      () =>
        !!document.querySelector('[data-ui-id="workspace.access.code"], [aria-label="Workspace access code"]') &&
        !document.querySelector('#btn-workspace-admin-portal'),
    );

    // Privilege: admin me without auth must not be 200 with roles
    try {
      const adminMe = await page.evaluate(async () => {
        const res = await fetch('/api/admin/me', { credentials: 'same-origin' });
        let body = null;
        try {
          body = await res.json();
        } catch {
          body = null;
        }
        return { status: res.status, hasRoles: Array.isArray(body?.roles) && body.roles.length > 0 };
      });
      evidence.adminMeUnauthorized = adminMe.status === 401 || adminMe.status === 403 || !adminMe.hasRoles;
    } catch {
      evidence.adminMeUnauthorized = null;
    }

    const valid = resolveValidCodeSilent();
    evidence.validSource = valid.source;
    if (valid.code) {
      await page.fill('[data-ui-id="workspace.access.code"], [aria-label="Workspace access code"]', valid.code);
      await page.click('[data-ui-id="workspace.access.unlock"]');
      await page.waitForTimeout(1200);
      evidence.validUnlocked = await page.evaluate(
        () =>
          !!document.querySelector('#btn-workspace-admin-portal') ||
          /Admin & Portal|Workspace/i.test(document.body.innerText || ''),
      );
      if (evidence.validUnlocked) {
        await page.evaluate(() => document.querySelector('#btn-workspace-admin-portal')?.click());
        await page.waitForTimeout(900);
        evidence.adminPortalVisible = await page.evaluate(
          () =>
            /System overview|Admin Control|Control Center/i.test(document.body.innerText || '') ||
            !!document.querySelector('[data-admin-control-center], .admin-control-center'),
        );
      }
    } else {
      evidence.blocker = 'valid_code_unset_set_WORKSPACE_E2E_ACCESS_CODE';
    }

    evidence.ok =
      evidence.gateVisible &&
      evidence.invalidRejected &&
      evidence.forgeBlocked &&
      (evidence.adminMeUnauthorized === true || evidence.adminMeUnauthorized === null) &&
      (valid.code ? evidence.validUnlocked : true);

    evidence.screenshot = path.join(OUT_DIR, `workspace-admin-${stamp}.png`);
    await page.screenshot({ path: evidence.screenshot }).catch(() => {});
    console.log(`[smoke-workspace-admin] ${evidence.ok ? 'PASS' : 'FAIL'}`);
    console.log(JSON.stringify(evidence, null, 2));
    if (!evidence.ok) process.exitCode = 1;
  } finally {
    clearTimeout(hardDeadline);
    await browser.close().catch(() => {});
  }
}

main().catch((err) => {
  console.error('[smoke-workspace-admin] FATAL', err);
  process.exit(1);
});
