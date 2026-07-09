#!/usr/bin/env node
/**
 * Extract official DeepAR demo preview images for the filter carousel.
 * → public/effects/previews/{effectId}.png
 *
 * Sources:
 *  - free_package.zip preview.png per filter
 *  - DeepAR web quickstart thumbs (makeup, aviators)
 *  - Embedded PNG textures in SDK built-in effects (lion, koala, …)
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { getAppRoot } from './resolveProjectEnv.mjs';

const appRoot = getAppRoot(import.meta.dirname);
const archivesDir = path.join(appRoot, 'vendor/archives');
const effectsZip =
  process.env.DEEPAR_EFFECTS_ZIP?.trim() ||
  (fs.existsSync(path.join(archivesDir, 'free_package.zip'))
    ? path.join(archivesDir, 'free_package.zip')
    : path.join(os.homedir(), 'Downloads/free_package.zip'));
const previewsDir = path.join(appRoot, 'public/effects/previews');
const sdkEffectsDir = path.join(appRoot, 'public/deepar-resources/effects');
const packEffectsDir = path.join(appRoot, 'public/effects');

const QUICKSTART_THUMBS =
  'https://raw.githubusercontent.com/DeepARSDK/quickstart-web-js-npm/main/public/thumbs';

/** .deepar filename → carousel effect id */
const EFFECT_ID_BY_FILE = {
  'MakeupLook.deepar': 'makeup',
  'viking_helmet.deepar': 'viking',
  'flower_face.deepar': 'flowers',
  'galaxy_background.deepar': 'galaxy',
  'Humanoid.deepar': 'humanoid',
  'Neon_Devil_Horns.deepar': 'devil-horns',
  'Fire_Effect.deepar': 'fire',
  'burning_effect.deepar': 'burning',
  'Stallone.deepar': 'stallone',
  'Hope.deepar': 'hope',
  'Snail.deepar': 'snail',
  'Vendetta_Mask.deepar': 'vendetta',
  'Split_View_Look.deepar': 'makeup-split',
  'Ping_Pong.deepar': 'ping-pong',
  '8bitHearts.deepar': 'pixel-hearts',
  'Elephant_Trunk.deepar': 'elephant',
  'Emotions_Exaggerator.deepar': 'emotions',
  'Emotion_Meter.deepar': 'emotion-meter',
};

/** Copy an existing preview under a different effect id. */
const PREVIEW_ALIASES = {
  background_blur: 'burning',
  background_replacement: 'galaxy',
};

/** Official quickstart thumb filename → carousel effect id */
const QUICKSTART_THUMB_BY_EFFECT = {
  makeup: 'makeup.png',
  aviators: 'ray-ban-wayfarer.png',
  none: 'hope.png',
};

/** SDK effect binary filename → carousel effect id */
const SDK_EFFECT_FILES = {
  aviators: 'aviators',
  lion: 'lion',
  dalmatian: 'dalmatian',
  koala: 'koala',
};

function extractZip(zipPath, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  execSync(
    `unzip -oq "${zipPath}" -d "${destDir}" -x "__MACOSX/*" "*/._*" "*/.DS_Store"`,
    { stdio: 'pipe' },
  );
}

function copyPreview(src, effectId) {
  const dest = path.join(previewsDir, `${effectId}.png`);
  fs.copyFileSync(src, dest);
  return dest;
}

function previewPath(effectId) {
  return path.join(previewsDir, `${effectId}.png`);
}

function hasPreview(effectId) {
  return fs.existsSync(previewPath(effectId));
}

/** Extract embedded PNG blobs from DeepAR effect binaries. */
function extractEmbeddedPngs(filePath) {
  const data = fs.readFileSync(filePath);
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const chunks = [];
  let i = 0;
  while (i < data.length) {
    const start = data.indexOf(sig, i);
    if (start === -1) break;
    const endMarker = data.indexOf(Buffer.from('IEND'), start);
    if (endMarker === -1) break;
    const end = endMarker + 8;
    chunks.push(data.subarray(start, end));
    i = end;
  }
  return chunks;
}

/** Prefer the largest square PNG (demo thumbs are typically portrait/square). */
function pickBestDemoPng(chunks) {
  if (!chunks.length) return null;

  let best = chunks[0];
  let bestScore = scorePngChunk(best);

  for (let idx = 1; idx < chunks.length; idx += 1) {
    const score = scorePngChunk(chunks[idx]);
    if (score > bestScore) {
      best = chunks[idx];
      bestScore = score;
    }
  }

  return best;
}

function scorePngChunk(chunk) {
  if (chunk.length < 24) return 0;
  const width = chunk.readUInt32BE(16);
  const height = chunk.readUInt32BE(20);
  if (!width || !height) return chunk.length;
  const squareBonus = Math.min(width, height) / Math.max(width, height);
  return chunk.length * (0.5 + squareBonus * 0.5);
}

function downloadQuickstartThumb(filename, dest) {
  const url = `${QUICKSTART_THUMBS}/${filename}`;
  execSync(`curl -fsSL "${url}" -o "${dest}"`, { stdio: 'pipe' });
}

function extractFromFreePackage(tmp) {
  let count = 0;

  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('._') || entry.name === '__MACOSX' || entry.name === '.DS_Store') {
        continue;
      }
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'galaxy_animation') {
          const frame = path.join(full, 'frame000008.png');
          if (fs.existsSync(frame)) {
            copyPreview(frame, 'galaxy');
            count += 1;
          }
        }
        walk(full);
        continue;
      }
      if (!entry.name.endsWith('.deepar')) continue;

      const effectId = EFFECT_ID_BY_FILE[entry.name];
      if (!effectId) continue;

      const parent = dir;
      for (const previewName of ['preview.png', 'preview.jpg', 'preview.jpeg']) {
        const src = path.join(parent, previewName);
        if (fs.existsSync(src)) {
          copyPreview(src, effectId);
          count += 1;
          break;
        }
      }
    }
  };

  walk(tmp);
  return count;
}

function extractFromSdkEffects() {
  let count = 0;

  for (const [effectId, fileName] of Object.entries(SDK_EFFECT_FILES)) {
    if (hasPreview(effectId)) continue;

    const filePath = path.join(sdkEffectsDir, fileName);
    if (!fs.existsSync(filePath)) continue;

    const chunks = extractEmbeddedPngs(filePath);
    const best = pickBestDemoPng(chunks);
    if (!best) continue;

    const tmp = path.join(os.tmpdir(), `deepar-preview-${effectId}.png`);
    fs.writeFileSync(tmp, best);
    copyPreview(tmp, effectId);
    fs.rmSync(tmp, { force: true });
    count += 1;
  }

  return count;
}

function applyQuickstartThumbs() {
  let count = 0;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deepar-qt-'));

  try {
    for (const [effectId, thumbFile] of Object.entries(QUICKSTART_THUMB_BY_EFFECT)) {
      if (hasPreview(effectId) && effectId !== 'makeup' && effectId !== 'aviators') continue;

      const tmp = path.join(tmpDir, thumbFile);
      try {
        downloadQuickstartThumb(thumbFile, tmp);
        copyPreview(tmp, effectId);
        count += 1;
      } catch {
        console.warn(`[deepar] Quickstart thumb missing: ${thumbFile}`);
      }
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  return count;
}

function applyAliases() {
  let count = 0;
  for (const [effectId, sourceId] of Object.entries(PREVIEW_ALIASES)) {
    if (hasPreview(effectId)) continue;
    const src = previewPath(sourceId);
    if (!fs.existsSync(src)) continue;
    copyPreview(src, effectId);
    count += 1;
  }
  return count;
}

function ensureMakeupPreview() {
  if (hasPreview('makeup')) return 0;

  if (hasPreview('makeup-split')) {
    copyPreview(previewPath('makeup-split'), 'makeup');
    return 1;
  }

  const makeupEffect = path.join(packEffectsDir, 'MakeupLook.deepar');
  if (!fs.existsSync(makeupEffect)) return 0;

  const best = pickBestDemoPng(extractEmbeddedPngs(makeupEffect));
  if (!best) return 0;

  const tmp = path.join(os.tmpdir(), 'deepar-makeup-preview.png');
  fs.writeFileSync(tmp, best);
  copyPreview(tmp, 'makeup');
  fs.rmSync(tmp, { force: true });
  return 1;
}

if (!fs.existsSync(effectsZip)) {
  console.error(`[deepar] free_package.zip not found at ${effectsZip}`);
  process.exit(1);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'deepar-previews-'));
fs.rmSync(previewsDir, { recursive: true, force: true });
fs.mkdirSync(previewsDir, { recursive: true });

try {
  extractZip(effectsZip, tmp);

  const packCount = extractFromFreePackage(tmp);
  const quickstartCount = applyQuickstartThumbs();
  const makeupCount = ensureMakeupPreview();
  const sdkCount = extractFromSdkEffects();
  const aliasCount = applyAliases();

  const files = fs.readdirSync(previewsDir).filter((f) => f.endsWith('.png'));
  const expected = new Set([
    'none',
    ...Object.values(EFFECT_ID_BY_FILE),
    ...Object.keys(PREVIEW_ALIASES),
    ...Object.keys(SDK_EFFECT_FILES),
  ]);

  const missing = [...expected].filter((id) => !hasPreview(id));
  if (missing.length) {
    console.warn(`[deepar] Missing carousel previews: ${missing.join(', ')}`);
  }

  console.log(
    `[deepar] ${files.length} effect demo previews → public/effects/previews/` +
      ` (pack=${packCount}, quickstart=${quickstartCount}, makeup=${makeupCount}, sdk=${sdkCount}, aliases=${aliasCount})`,
  );
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
