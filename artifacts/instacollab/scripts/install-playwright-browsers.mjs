#!/usr/bin/env node
/**
 * Install Playwright Chromium into a stable user cache.
 * Uses curl + unzip (Playwright's own installer can hang after download on some Mac setups).
 *
 * Usage (from repo root):
 *   pnpm run playwright:install
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDir, '..');
function resolveBrowsersPath() {
  const envPath = process.env.PLAYWRIGHT_BROWSERS_PATH?.trim();
  if (envPath && !/cursor-sandbox-cache/i.test(envPath)) {
    return envPath;
  }
  return path.join(os.homedir(), '.cache/ms-playwright');
}

const browsersPath = resolveBrowsersPath();

const CHROMIUM_REVISION = '1148';
const CHROMIUM_ZIP_URL = `https://playwright.azureedge.net/builds/chromium/${CHROMIUM_REVISION}/chromium-mac-arm64.zip`;
const SYSTEM_CHROME =
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

function removeDirLock(root) {
  try {
    fs.rmSync(path.join(root, '__dirlock'), { force: true, recursive: true });
  } catch {
    /* ignore */
  }
}

function chromiumDir() {
  return path.join(browsersPath, `chromium-${CHROMIUM_REVISION}`);
}

function chromiumExecutable() {
  return path.join(
    chromiumDir(),
    'chrome-mac/Chromium.app/Contents/MacOS/Chromium',
  );
}

function chromiumFramework() {
  return path.join(
    chromiumDir(),
    'chrome-mac/Chromium.app/Contents/Frameworks/Chromium Framework.framework',
  );
}

function directorySizeBytes(target) {
  const result = spawnSync('du', ['-sk', target], { encoding: 'utf8' });
  if (result.status !== 0) return 0;
  const kb = Number.parseInt(String(result.stdout).split(/\s+/)[0], 10);
  return Number.isFinite(kb) ? kb * 1024 : 0;
}

function isCompleteChromiumBundle() {
  const marker = path.join(chromiumDir(), 'INSTALLATION_COMPLETE');
  const exe = chromiumExecutable();
  const framework = chromiumFramework();
  try {
    return (
      fs.existsSync(marker) &&
      fs.existsSync(exe) &&
      fs.existsSync(framework) &&
      directorySizeBytes(chromiumDir()) > 100 * 1024 * 1024
    );
  } catch {
    return false;
  }
}

function findChromiumExecutable() {
  const exe = chromiumExecutable();
  if (fs.existsSync(exe)) return exe;
  return null;
}

function systemChromeAvailable() {
  try {
    return fs.existsSync(SYSTEM_CHROME);
  } catch {
    return false;
  }
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with code ${result.status ?? 1}`);
  }
}

function manualInstallChromium() {
  const targetDir = chromiumDir();
  const marker = path.join(targetDir, 'INSTALLATION_COMPLETE');
  const zipPath = path.join(os.tmpdir(), `playwright-chromium-${CHROMIUM_REVISION}.zip`);

  fs.rmSync(targetDir, { force: true, recursive: true });
  fs.mkdirSync(targetDir, { recursive: true });
  removeDirLock(browsersPath);

  console.log(`Downloading Chromium ${CHROMIUM_REVISION}…`);
  run('curl', ['-fL', '--retry', '3', '--retry-delay', '2', CHROMIUM_ZIP_URL, '-o', zipPath]);

  console.log('Extracting Chromium…');
  run('unzip', ['-qo', zipPath, '-d', targetDir]);
  fs.rmSync(zipPath, { force: true });

  const exe = chromiumExecutable();
  if (!fs.existsSync(exe)) {
    throw new Error(`Chromium binary missing after extract: ${exe}`);
  }
  if (!fs.existsSync(chromiumFramework())) {
    throw new Error('Chromium Framework missing after extract');
  }
  if (directorySizeBytes(targetDir) < 100 * 1024 * 1024) {
    throw new Error('Chromium bundle looks incomplete after extract');
  }

  fs.writeFileSync(marker, '');
  return exe;
}

function tryPlaywrightCliInstall() {
  const localCli = path.join(appRoot, 'node_modules/playwright/cli.js');
  if (!fs.existsSync(localCli)) return false;

  removeDirLock(browsersPath);
  const result = spawnSync(
    process.execPath,
    [localCli, 'install', 'chromium'],
    {
      cwd: appRoot,
      env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: browsersPath },
      stdio: 'inherit',
      timeout: 240_000,
    },
  );
  return result.status === 0 && isCompleteChromiumBundle();
}

function main() {
  fs.mkdirSync(browsersPath, { recursive: true });
  removeDirLock(browsersPath);

  if (isCompleteChromiumBundle()) {
    const exe = findChromiumExecutable();
    console.log('Playwright Chromium already installed:', exe);
    console.log(`PLAYWRIGHT_BROWSERS_PATH=${browsersPath}`);
    return;
  }

  console.log(`Installing Playwright Chromium → ${browsersPath}`);

  let exe = null;
  try {
    exe = manualInstallChromium();
  } catch (manualErr) {
    console.warn('Manual Chromium install failed:', manualErr.message);
    console.log('Trying Playwright CLI installer…');
    if (!tryPlaywrightCliInstall()) {
      if (systemChromeAvailable()) {
        console.log('Using system Google Chrome for smoke tests:', SYSTEM_CHROME);
        console.log('Smoke tests will still run via channel: chrome.');
        return;
      }
      console.error('Could not install Playwright Chromium and system Chrome was not found.');
      process.exit(1);
    }
    exe = findChromiumExecutable();
  }

  if (!exe) {
    console.error('Install finished but Chromium executable was not found.');
    process.exit(1);
  }

  console.log('Playwright Chromium ready:', exe);
  console.log(`PLAYWRIGHT_BROWSERS_PATH=${browsersPath}`);
}

main();
