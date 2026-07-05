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
import http from 'node:http';
import { execSync } from 'node:child_process';
import { chromium } from 'playwright';
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
const vendorThumbsDir = path.join(appRoot, 'vendor/deepar-thumbs');

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
  'beauty-smooth': 'makeup',
  'beauty-soft': 'none',
  'beauty-glow': 'hope',
};

/** Official quickstart thumb filename → carousel effect id */
const QUICKSTART_THUMB_BY_EFFECT = {
  makeup: 'makeup.png',
  wayfarer: 'ray-ban-wayfarer.png',
};

/** Quickstart thumbs that differ from free-pack preview.png (person + effect demos). */
const QUICKSTART_OVERRIDE_BY_EFFECT = {};

/** Vendor-rendered demo thumbs (see render-deepar-sdk-previews.mjs). */
const VENDOR_RENDERED_PREVIEWS = ['none', 'aviators'];

/** SDK effect binary filename → carousel effect id */
const SDK_EFFECT_FILES = {
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

function applyQuickstartOverrides() {
  let count = 0;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deepar-qt-override-'));

  try {
    for (const [effectId, thumbFile] of Object.entries(QUICKSTART_OVERRIDE_BY_EFFECT)) {
      const tmp = path.join(tmpDir, thumbFile);
      try {
        downloadQuickstartThumb(thumbFile, tmp);
        copyPreview(tmp, effectId);
        count += 1;
      } catch {
        console.warn(`[deepar] Quickstart override missing: ${thumbFile}`);
      }
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  return count;
}

async function scrubPreviewBackgroundToWhite(pngBytes) {
  const sharp = (await import('sharp')).default;
  const { data, info } = await sharp(pngBytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixels = Buffer.from(data);
  const { width, height, channels } = info;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      const isPureWhite = r === 255 && g === 255 && b === 255;
      const isGreenBg = g > r + 5 && g > b + 3 && g > 42;
      const isFringe = !isPureWhite && r > 228 && g > 228 && b > 228;
      if (isGreenBg || isFringe) {
        pixels[i] = 255;
        pixels[i + 1] = 255;
        pixels[i + 2] = 255;
        if (channels > 3) pixels[i + 3] = 255;
      }
    }
  }

  return sharp(pixels, { raw: { width, height, channels } }).png().toBuffer();
}

async function renderSegmentPreviewOnWhite(imagePath) {
  const segmentHtml = path.join(appRoot, 'scripts/templates/segment-preview.html');
  const server = http.createServer((req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      if (url.pathname === '/segment.html') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        fs.createReadStream(segmentHtml).pipe(res);
        return;
      }
      if (url.pathname === '/demo-face.png') {
        res.writeHead(200, { 'Content-Type': 'image/png' });
        fs.createReadStream(imagePath).pipe(res);
        return;
      }
      res.writeHead(404);
      res.end('Not found');
    } catch (err) {
      res.writeHead(500);
      res.end(String(err));
    }
  });

  await new Promise((resolve) => server.listen(0, 'localhost', resolve));
  const { port } = server.address();
  const baseUrl = `http://localhost:${port}`;
  const browser = await chromium.launch({
    headless: process.env.DEEPAR_RENDER_HEADED === '1' ? false : true,
    args: [
      '--enable-unsafe-swiftshader',
      '--use-angle=swiftshader',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
    ],
  });

  try {
    const page = await browser.newPage({ viewport: { width: 512, height: 512 } });
    await page.addInitScript((imageUrl) => {
      window.__segmentConfig = { imageUrl };
    }, `${baseUrl}/demo-face.png`);
    await page.goto(`${baseUrl}/segment.html`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForFunction(() => window.__segmentDone === true, null, { timeout: 120_000 });
    const error = await page.evaluate(() => window.__segmentError);
    if (error) throw new Error(error);
    const result = await page.evaluate(() => window.__segmentResult);
    if (!result || typeof result !== 'string' || !result.startsWith('data:image/')) {
      throw new Error('Segment preview screenshot missing');
    }
    const bytes = Buffer.from(result.replace(/^data:image\/\w+;base64,/, ''), 'base64');
    if (bytes.length < 20_000) {
      throw new Error(`Segment preview looks empty (${bytes.length} bytes)`);
    }
    return scrubPreviewBackgroundToWhite(bytes);
  } finally {
    await browser.close();
    server.close();
  }
}

async function buildFaceSegmentPreview(mode) {
  fs.mkdirSync(vendorThumbsDir, { recursive: true });
  const demoFace = path.join(vendorThumbsDir, 'demo-face.png');
  if (!fs.existsSync(demoFace)) {
    downloadQuickstartThumb('makeup.png', demoFace);
  }

  if (mode === 'replace') {
    throw new Error('Use ensureBackgroundReplacementPreview() for BG Replace thumbs');
  }

  const sharp = (await import('sharp')).default;
  const size = 512;
  const resized = await sharp(demoFace).resize(size, size, { fit: 'cover' }).png().toBuffer();
  const personMask = Buffer.from(
    `<svg width="${size}" height="${size}">
      <defs>
        <radialGradient id="fade" cx="50%" cy="54%" r="46%">
          <stop offset="72%" stop-color="white"/>
          <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
        </radialGradient>
      </defs>
      <ellipse cx="256" cy="300" rx="168" ry="220" fill="url(#fade)"/>
    </svg>`,
  );
  const person = await sharp(resized)
    .composite([{ input: personMask, blend: 'dest-in' }])
    .png()
    .toBuffer();
  const background = await sharp(resized).blur(14).toBuffer();

  return sharp(background).composite([{ input: person, blend: 'over' }]).png().toBuffer();
}

function ensureNeutralFace() {
  fs.mkdirSync(vendorThumbsDir, { recursive: true });
  const dest = path.join(vendorThumbsDir, 'none-source.png');
  if (!fs.existsSync(dest)) {
    execSync(
      `curl -fsSL "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=512&h=512&q=80" -o "${dest}"`,
      { stdio: 'pipe' },
    );
    execSync(`sips -s format png "${dest}" --out "${dest}.tmp" >/dev/null 2>&1 && mv "${dest}.tmp" "${dest}"`, {
      stdio: 'pipe',
    });
  }
  return dest;
}

function ensureReplacementBackground() {
  fs.mkdirSync(vendorThumbsDir, { recursive: true });
  const dest = path.join(vendorThumbsDir, 'replacement-bg.jpg');
  const beachUrl =
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=512&h=512&q=80';
  if (!fs.existsSync(dest) || fs.statSync(dest).size < 30_000) {
    execSync(`curl -fsSL "${beachUrl}" -o "${dest}"`, { stdio: 'pipe' });
  }
  return dest;
}

async function ensureBackgroundBlurPreview() {
  const rendered = path.join(vendorThumbsDir, 'background_blur.png');
  const out = await buildFaceSegmentPreview('blur');
  fs.writeFileSync(rendered, out);
  copyPreview(rendered, 'background_blur');
  return 1;
}

const BG_REPLACE_THUMB_URL =
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=512&h=512&q=85';

function ensureBgReplaceThumbSource() {
  fs.mkdirSync(vendorThumbsDir, { recursive: true });
  const dest = path.join(vendorThumbsDir, 'bg-replace-thumb-source.jpg');
  if (!fs.existsSync(dest)) {
    execSync(`curl -fsSL "${BG_REPLACE_THUMB_URL}" -o "${dest}"`, { stdio: 'pipe' });
  }
  return dest;
}

async function ensureBackgroundReplacementPreview() {
  const sharp = (await import('sharp')).default;
  const rendered = path.join(vendorThumbsDir, 'background_replacement.png');
  const source = ensureBgReplaceThumbSource();
  const out = await sharp(source)
    .resize(512, 512, { fit: 'cover', position: 'centre' })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .png()
    .toBuffer();
  fs.writeFileSync(rendered, out);
  copyPreview(rendered, 'background_replacement');
  return 1;
}

function ensureNonePreview() {
  if (hasPreview('none')) return 0;

  const rendered = path.join(vendorThumbsDir, 'none.png');
  if (fs.existsSync(rendered) && fs.statSync(rendered).size >= 20_000) {
    copyPreview(rendered, 'none');
    return 1;
  }

  fs.mkdirSync(vendorThumbsDir, { recursive: true });
  const neutralFace = path.join(vendorThumbsDir, 'none-source.png');
  if (!fs.existsSync(neutralFace)) {
    execSync(
      `curl -fsSL "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=512&h=512&q=80" -o "${neutralFace}"`,
      { stdio: 'pipe' },
    );
    execSync(`sips -s format png "${neutralFace}" --out "${neutralFace}.tmp" >/dev/null 2>&1 && mv "${neutralFace}.tmp" "${neutralFace}"`, {
      stdio: 'pipe',
    });
  }

  copyPreview(neutralFace, 'none');
  return 1;
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

function applyVendorRenderedPreviews() {
  let count = 0;
  for (const effectId of VENDOR_RENDERED_PREVIEWS) {
    const src = path.join(vendorThumbsDir, `${effectId}.png`);
    if (!fs.existsSync(src) || fs.statSync(src).size < 20_000) continue;
    copyPreview(src, effectId);
    count += 1;
  }
  return count;
}

function extractSdkAviatorsPreview() {
  if (hasPreview('aviators')) return 0;

  const filePath = path.join(sdkEffectsDir, 'aviators');
  if (!fs.existsSync(filePath)) return 0;

  const chunks = extractEmbeddedPngs(filePath);
  const best = pickBestDemoPng(chunks);
  if (!best) return 0;

  const tmp = path.join(os.tmpdir(), 'deepar-aviators-texture.png');
  fs.writeFileSync(tmp, best);
  copyPreview(tmp, 'aviators');
  fs.rmSync(tmp, { force: true });
  return 1;
}

function ensureVendorFallbackPreviews() {
  return 0;
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
  const quickstartOverrideCount = applyQuickstartOverrides();
  const vendorCount = applyVendorRenderedPreviews();
  const bgBlurCount = await ensureBackgroundBlurPreview();
  const bgReplaceCount = await ensureBackgroundReplacementPreview();
  const noneCount = ensureNonePreview();
  const fallbackCount = ensureVendorFallbackPreviews();
  const aviatorsTextureCount = extractSdkAviatorsPreview();
  const aliasCount = applyAliases();

  const files = fs.readdirSync(previewsDir).filter((f) => f.endsWith('.png'));
  const expected = new Set([
    'none',
    'wayfarer',
    'background_blur',
    'background_replacement',
    ...Object.values(EFFECT_ID_BY_FILE),
    ...Object.keys(PREVIEW_ALIASES),
    ...Object.keys(SDK_EFFECT_FILES),
    ...VENDOR_RENDERED_PREVIEWS,
  ]);

  const missing = [...expected].filter((id) => !hasPreview(id));
  if (missing.length) {
    console.warn(`[deepar] Missing carousel previews: ${missing.join(', ')}`);
  }

  console.log(
    `[deepar] ${files.length} effect demo previews → public/effects/previews/` +
      ` (pack=${packCount}, quickstart=${quickstartCount}, overrides=${quickstartOverrideCount}, bgBlur=${bgBlurCount}, bgReplace=${bgReplaceCount}, none=${noneCount}, makeup=${makeupCount}, fallback=${fallbackCount}, sdk=${sdkCount}, vendor=${vendorCount}, aviatorsTex=${aviatorsTextureCount}, aliases=${aliasCount})`,
  );
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
