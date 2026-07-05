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

const downloadsDir = path.join(os.homedir(), 'Downloads');

const DEFAULT_SDK_CANDIDATES = [
  path.join(downloadsDir, 'DeepAR-Web-v5.6.22.zip'),
  path.join(downloadsDir, 'DeepAR-Web-v5.6.22 (1).zip'),
];
const DEFAULT_EFFECTS_CANDIDATES = [
  path.join(downloadsDir, 'free_package.zip'),
  path.join(downloadsDir, 'free_package (1).zip'),
];
const DEFAULT_BEAUTY_CANDIDATES = [
  path.join(downloadsDir, 'beauty-presets.zip'),
  path.join(downloadsDir, 'beauty-presets (1).zip'),
];

function firstExisting(paths) {
  for (const candidate of paths) {
    if (candidate && fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function resolveArchive(envVar, vendorName, fallbacks) {
  if (process.env[envVar]?.trim()) return process.env[envVar].trim();
  const vendorPath = path.join(archivesDir, vendorName);
  if (fs.existsSync(vendorPath)) return vendorPath;
  return firstExisting(Array.isArray(fallbacks) ? fallbacks : [fallbacks]);
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

const QUICKSTART_BASE =
  'https://raw.githubusercontent.com/DeepARSDK/quickstart-web-js-npm/main/public';

function installQuickstartExtras() {
  const quickstartEffects = [
    {
      url: `${QUICKSTART_BASE}/effects/ray-ban-wayfarer.deepar`,
      dest: path.join(effectsDir, 'ray-ban-wayfarer.deepar'),
    },
  ];

  for (const { url, dest } of quickstartEffects) {
    if (fs.existsSync(dest)) continue;
    try {
      execSync(`curl -fsSL "${url}" -o "${dest}"`, { stdio: 'pipe' });
      console.log(`[deepar] Quickstart effect → public/effects/${path.basename(dest)}`);
    } catch (err) {
      console.warn(`[deepar] Failed to download ${path.basename(dest)}:`, err.message);
    }
  }
}

function installEffectPreviews(effectsZip) {
  try {
    execSync(`node "${path.join(appRoot, 'scripts/render-deepar-sdk-previews.mjs')}"`, {
      stdio: 'inherit',
      env: process.env,
    });
  } catch (err) {
    console.warn('[deepar] SDK preview render skipped:', err.message);
  }

  try {
    execSync(`node "${path.join(appRoot, 'scripts/extract-deepar-previews.mjs')}"`, {
      stdio: 'inherit',
      env: { ...process.env, DEEPAR_EFFECTS_ZIP: effectsZip },
    });
  } catch (err) {
    console.warn('[deepar] Preview extraction failed (carousel demo thumbs missing):', err.message);
  }
}

function installBeautyPluginAssets() {
  try {
    const require = createRequire(path.join(appRoot, 'package.json'));
    const beautyPkg = path.dirname(require.resolve('@deepar/beauty/package.json'));
    const dist = path.join(beautyPkg, 'dist');
    if (!fs.existsSync(dist)) {
      console.warn('[deepar] @deepar/beauty dist not found — Beauty looks unavailable');
      return;
    }
    const dest = path.join(appRoot, 'public/deepar-beauty');
    fs.rmSync(dest, { recursive: true, force: true });
    copyRecursive(dist, dest);
    console.log('[deepar] Beauty plugin → public/deepar-beauty');
  } catch (err) {
    console.warn('[deepar] Beauty plugin install skipped:', err.message);
  }
}

/** Map carousel effect ids → beauty-presets zip filenames. */
const BEAUTY_PREVIEW_MAP = {
  'look-cute': 'cute.zip',
  'look-after-dark': 'after-dark.zip',
  'look-night-out': 'night-out.zip',
  'look-kim-classic': 'kim-classic.zip',
  'look-caramel-kiss': 'caramel-kiss.zip',
  'look-spring-petals': 'spring-petals.zip',
  'look-midnight-stunner': 'midnight-stunner.zip',
  'look-happy-tears': 'happy-tears.zip',
  'look-starry-night': 'starry-night-seduction.zip',
  'look-lash-delight': 'lash-delight.zip',
  'look-black-hearts': 'black-hearts.zip',
  'look-cateye-maple': 'cateye-maple.zip',
  'look-gelid-breeze': 'gelid-breeze.zip',
  'look-twilight-hues': 'twilight-hues.zip',
  'look-misty-enchantment': 'misty-enchantment.zip',
  'look-skyline-glamour': 'skyline-glamour-stripes.zip',
  'beauty-light-touchup': 'light-touchup-fair-skin.zip',
  'beauty-rosy': 'rosy.zip',
  'beauty-glowing': 'glowing.zip',
  'beauty-light-blush': 'light-blush.zip',
  'beauty-gelid': 'gelid.zip',
};

/** Prefer distinctive makeup assets over shared contour masks. */
const BEAUTY_PREVIEW_BOOST = [
  'eyelash', 'lashes', 'eyeshadow', 'lipstick', 'shade', 'smokey', 'cateye',
  'kim', 'cotton', 'dashing', 'spark', 'strike', 'specmask', 'blue', 'pink',
  'gorgeous', 'sexy', 'luxe', 'matte', 'nude',
];
const BEAUTY_PREVIEW_PENALTY = ['oval', 'round', 'wide', 'long', 'lower', 'triangle', 'basic'];

function scoreBeautyPreviewAsset(name, size) {
  const low = name.toLowerCase();
  let score = size / 1000;
  for (const key of BEAUTY_PREVIEW_BOOST) {
    if (low.includes(key)) score += 50;
  }
  for (const key of BEAUTY_PREVIEW_PENALTY) {
    if (low.includes(key)) score -= 30;
  }
  return score;
}

function extractBeautyPreviews(beautyDir) {
  const previewsDir = path.join(effectsDir, 'previews');
  fs.mkdirSync(previewsDir, { recursive: true });
  let count = 0;

  for (const [effectId, zipName] of Object.entries(BEAUTY_PREVIEW_MAP)) {
    const zipPath = path.join(beautyDir, zipName);
    if (!fs.existsSync(zipPath)) continue;
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'deepar-bp-'));
    try {
      extractZip(zipPath, tmp);
      const assets = [];
      const walk = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          if (entry.name.startsWith('._') || entry.name === '.DS_Store') continue;
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            walk(full);
            continue;
          }
          if (!/\.(png|jpe?g|webp)$/i.test(entry.name)) continue;
          assets.push(full);
        }
      };
      walk(tmp);
      if (!assets.length) continue;
      assets.sort(
        (a, b) =>
          scoreBeautyPreviewAsset(path.basename(b), fs.statSync(b).size) -
          scoreBeautyPreviewAsset(path.basename(a), fs.statSync(a).size),
      );
      fs.copyFileSync(assets[0], path.join(previewsDir, `${effectId}.png`));
      count += 1;
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }

  console.log(`[deepar] ${count} beauty look previews → public/effects/previews/`);
}

function installBeautyPresets(beautyZip) {
  if (!beautyZip) {
    console.log('[deepar] Beauty presets zip not found — skipping');
    return 0;
  }

  const beautyDir = path.join(effectsDir, 'beauty-presets');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'deepar-beauty-'));
  try {
    extractZip(beautyZip, tmp);
    fs.rmSync(beautyDir, { recursive: true, force: true });
    fs.mkdirSync(beautyDir, { recursive: true });

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
        if (!entry.name.endsWith('.zip')) continue;
        const id = entry.name.replace(/\.zip$/i, '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const dest = path.join(beautyDir, `${id}.zip`);
        fs.copyFileSync(full, dest);
        count += 1;
      }
    };
    walk(tmp);

    console.log(`[deepar] ${count} beauty presets → public/effects/beauty-presets`);
    extractBeautyPreviews(beautyDir);
    return count;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

function cacheArchives(sdkZip, effectsZip, beautyZip) {
  fs.mkdirSync(archivesDir, { recursive: true });
  const pairs = [
    [sdkZip, 'DeepAR-Web-v5.6.22.zip'],
    [effectsZip, 'free_package.zip'],
  ];
  if (beautyZip) pairs.push([beautyZip, 'beauty-presets.zip']);
  for (const [src, name] of pairs) {
    const dest = path.join(archivesDir, name);
    if (path.resolve(src) === path.resolve(dest)) continue;
    if (!fs.existsSync(dest) || fs.statSync(dest).mtimeMs < fs.statSync(src).mtimeMs) {
      fs.copyFileSync(src, dest);
      console.log(`[deepar] Cached ${name} → vendor/archives/`);
    }
  }
}

function assetsAlreadyInstalled() {
  if (process.env.DEEPAR_FORCE_INSTALL === '1') return false;
  if (!fs.existsSync(marker)) return false;
  const required = [
    path.join(resourcesDir, 'wasm/deepar.wasm'),
    path.join(resourcesDir, 'js/deepar.esm.js'),
    path.join(effectsDir, 'ray-ban-wayfarer.deepar'),
    path.join(appRoot, 'public/deepar-beauty/beauty-deepar.esm.js'),
  ];
  return required.every((file) => fs.existsSync(file));
}

if (assetsAlreadyInstalled()) {
  // Still repair missing beauty pre-look thumbs (look-*.png) from installed zips.
  const beautyDir = path.join(effectsDir, 'beauty-presets');
  const cutePreview = path.join(effectsDir, 'previews', 'look-cute.png');
  if (fs.existsSync(beautyDir) && !fs.existsSync(cutePreview)) {
    console.log('[deepar] Repairing missing beauty pre-look previews…');
    extractBeautyPreviews(beautyDir);
  }
  try {
    execSync('node scripts/ensure-effect-previews.mjs', { cwd: appRoot, stdio: 'inherit' });
  } catch {
    /* optional */
  }
  console.log('[deepar] Assets already installed — skip (set DEEPAR_FORCE_INSTALL=1 to reinstall)');
  process.exit(0);
}

const sdkZip = resolveArchive('DEEPAR_SDK_ZIP', 'DeepAR-Web-v5.6.22.zip', DEFAULT_SDK_CANDIDATES);
const effectsZip = resolveArchive('DEEPAR_EFFECTS_ZIP', 'free_package.zip', DEFAULT_EFFECTS_CANDIDATES);
const beautyZip = resolveArchive(
  'DEEPAR_BEAUTY_ZIP',
  'beauty-presets.zip',
  DEFAULT_BEAUTY_CANDIDATES,
);

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

cacheArchives(sdkZip, effectsZip, beautyZip);
installSdk(sdkZip);
installEffects(effectsZip);
installBeautyPluginAssets();
const beautyCount = installBeautyPresets(beautyZip);
installQuickstartExtras();
installEffectPreviews(effectsZip);

fs.writeFileSync(
  marker,
  JSON.stringify(
    {
      installedAt: new Date().toISOString(),
      sdkZip: path.basename(sdkZip),
      effectsZip: path.basename(effectsZip),
      beautyZip: beautyZip ? path.basename(beautyZip) : null,
      beautyPresetCount: beautyCount,
      version: '5.6.22',
    },
    null,
    2,
  ),
);

console.log('[deepar] Install complete');
try {
  execSync('node scripts/ensure-effect-previews.mjs', { cwd: appRoot, stdio: 'inherit' });
} catch {
  /* optional */
}
