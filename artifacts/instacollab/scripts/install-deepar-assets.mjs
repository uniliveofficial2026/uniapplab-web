#!/usr/bin/env node
/**
 * Install DeepAR SDK + free filter pack from official zip downloads.
 *
 * Looks for archives in (first match wins):
 *   1. DEEPAR_SDK_ZIP / DEEPAR_EFFECTS_ZIP env vars
 *   2. vendor/archives/ inside the app
 *   3. ~/Downloads/DeepAR-Web-v5.6.22.zip and ~/Downloads/free_package.zip
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { getAppRoot } from './resolveProjectEnv.mjs';

const appRoot = getAppRoot(import.meta.dirname);
const archivesDir = path.join(appRoot, 'vendor/archives');
const resourcesDir = path.join(appRoot, 'public/deepar-resources');
const effectsDir = path.join(appRoot, 'public/effects');
const marker = path.join(appRoot, 'public/.deepar-assets-installed.json');

const DEFAULT_SDK = path.join(os.homedir(), 'Downloads/DeepAR-Web-v5.6.22.zip');
const DEFAULT_EFFECTS = path.join(os.homedir(), 'Downloads/free_package.zip');

function resolveArchive(envVar, vendorName, fallback) {
  if (process.env[envVar]?.trim()) return process.env[envVar].trim();
  const vendorPath = path.join(archivesDir, vendorName);
  if (fs.existsSync(vendorPath)) return vendorPath;
  if (fs.existsSync(fallback)) return fallback;
  return null;
}

function copyRecursive(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.name.startsWith('._') || entry.name === '.DS_Store') continue;
    const from = path.join(src, entry.name);
    const to = path.join(dst, entry.name);
    if (entry.isDirectory()) copyRecursive(from, to);
    else fs.copyFileSync(from, to);
  }
}

function extractZip(zipPath, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  execSync(
    `unzip -oq "${zipPath}" -d "${destDir}" -x "__MACOSX/*" "*/._*" "*/.DS_Store"`,
    { stdio: 'pipe' },
  );
}

function findSdkLibRoot(extractRoot) {
  const direct = path.join(extractRoot, 'lib');
  if (fs.existsSync(direct)) return direct;
  for (const name of fs.readdirSync(extractRoot)) {
    const candidate = path.join(extractRoot, name, 'lib');
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error('DeepAR SDK zip: lib/ folder not found');
}

function overlayNpmBuiltinEffects() {
  try {
    const require = createRequire(path.join(appRoot, 'package.json'));
    const npmEffects = path.join(path.dirname(require.resolve('deepar/package.json')), 'effects');
    if (!fs.existsSync(npmEffects)) return;
    const dest = path.join(resourcesDir, 'effects');
    fs.mkdirSync(dest, { recursive: true });
    for (const name of fs.readdirSync(npmEffects)) {
      const from = path.join(npmEffects, name);
      const to = path.join(dest, name);
      if (fs.existsSync(to)) continue;
      if (fs.statSync(from).isDirectory()) copyRecursive(from, to);
      else fs.copyFileSync(from, to);
    }
  } catch {
    /* npm deepar optional overlay */
  }
}

function installSdk(sdkZip) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'deepar-sdk-'));
  try {
    extractZip(sdkZip, tmp);
    const libRoot = findSdkLibRoot(tmp);
    console.log(`[deepar] Installing SDK from ${path.basename(sdkZip)}`);
    fs.rmSync(resourcesDir, { recursive: true, force: true });
    copyRecursive(libRoot, resourcesDir);
    overlayNpmBuiltinEffects();
    console.log('[deepar] SDK → public/deepar-resources');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

function installEffects(effectsZip) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'deepar-fx-'));
  try {
    extractZip(effectsZip, tmp);
    fs.rmSync(effectsDir, { recursive: true, force: true });
    fs.mkdirSync(effectsDir, { recursive: true });

    let count = 0;
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith('._') || entry.name === '__MACOSX' || entry.name === '.DS_Store') {
          continue;
        }
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
          continue;
        }
        if (!entry.name.endsWith('.deepar')) continue;
        const dest = path.join(effectsDir, entry.name);
        fs.copyFileSync(full, dest);
        count += 1;
      }
    };
    walk(tmp);

    if (count === 0) throw new Error('No .deepar files found in free package zip');
    console.log(`[deepar] ${count} filters → public/effects`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

function cacheArchives(sdkZip, effectsZip) {
  fs.mkdirSync(archivesDir, { recursive: true });
  for (const [src, name] of [
    [sdkZip, 'DeepAR-Web-v5.6.22.zip'],
    [effectsZip, 'free_package.zip'],
  ]) {
    const dest = path.join(archivesDir, name);
    if (path.resolve(src) === path.resolve(dest)) continue;
    if (!fs.existsSync(dest) || fs.statSync(dest).mtimeMs < fs.statSync(src).mtimeMs) {
      fs.copyFileSync(src, dest);
      console.log(`[deepar] Cached ${name} → vendor/archives/`);
    }
  }
}

const sdkZip = resolveArchive('DEEPAR_SDK_ZIP', 'DeepAR-Web-v5.6.22.zip', DEFAULT_SDK);
const effectsZip = resolveArchive('DEEPAR_EFFECTS_ZIP', 'free_package.zip', DEFAULT_EFFECTS);

if (!sdkZip) {
  console.error('[deepar] SDK zip not found.');
  console.error('  Place DeepAR-Web-v5.6.22.zip in ~/Downloads or vendor/archives/');
  process.exit(1);
}

if (!effectsZip) {
  console.error('[deepar] Free filters zip not found.');
  console.error('  Place free_package.zip in ~/Downloads or vendor/archives/');
  process.exit(1);
}

cacheArchives(sdkZip, effectsZip);
installSdk(sdkZip);
installEffects(effectsZip);

fs.writeFileSync(
  marker,
  JSON.stringify(
    {
      installedAt: new Date().toISOString(),
      sdkZip: path.basename(sdkZip),
      effectsZip: path.basename(effectsZip),
      version: '5.6.22',
    },
    null,
    2,
  ),
);

console.log('[deepar] Install complete');
