#!/usr/bin/env node
/**
 * Generate UniLive native launcher icons + splash from public/brand/app-logo.png.
 * Usage: node scripts/generate-native-icons.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'public/brand/app-logo.png');
const BG = '#000000';

if (!fs.existsSync(source)) {
  console.error(`[native-icons] Missing source: ${source}`);
  process.exit(1);
}

async function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

/** Full-bleed square icon (legacy mipmap / iOS). */
async function squareIcon(size, outPath) {
  await sharp(source)
    .resize(size, size, { fit: 'contain', background: BG })
    .flatten({ background: BG })
    .png()
    .toFile(outPath);
}

/**
 * Adaptive foreground: logo inset in 108dp canvas (safe zone ~66%).
 * Outer ~18% is clipped by the launcher mask.
 */
async function adaptiveForeground(size, outPath) {
  const pad = Math.round(size * 0.18);
  const inner = size - pad * 2;
  const logo = await sharp(source)
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: logo, left: pad, top: pad }])
    .png()
    .toFile(outPath);
}

async function solidSplash(width, height, outPath) {
  const logoSize = Math.round(Math.min(width, height) * 0.42);
  const logo = await sharp(source)
    .resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: BG,
    },
  })
    .composite([
      {
        input: logo,
        left: Math.round((width - logoSize) / 2),
        top: Math.round((height - logoSize) / 2),
      },
    ])
    .png()
    .toFile(outPath);
}

const androidMipmaps = [
  ['mipmap-mdpi', 48, 108],
  ['mipmap-hdpi', 72, 162],
  ['mipmap-xhdpi', 96, 216],
  ['mipmap-xxhdpi', 144, 324],
  ['mipmap-xxxhdpi', 192, 432],
];

const androidSplashes = [
  ['drawable', 480, 800],
  ['drawable-port-mdpi', 320, 480],
  ['drawable-port-hdpi', 480, 800],
  ['drawable-port-xhdpi', 720, 1280],
  ['drawable-port-xxhdpi', 1080, 1920],
  ['drawable-port-xxxhdpi', 1440, 2560],
  ['drawable-land-mdpi', 480, 320],
  ['drawable-land-hdpi', 800, 480],
  ['drawable-land-xhdpi', 1280, 720],
  ['drawable-land-xxhdpi', 1920, 1080],
  ['drawable-land-xxxhdpi', 2560, 1440],
];

async function main() {
  console.log('[native-icons] Source:', source);

  // iOS App Store / Xcode single 1024
  const iosIconDir = path.join(root, 'ios/App/App/Assets.xcassets/AppIcon.appiconset');
  await ensureDir(iosIconDir);
  await squareIcon(1024, path.join(iosIconDir, 'AppIcon-512@2x.png'));
  fs.writeFileSync(
    path.join(iosIconDir, 'Contents.json'),
    `${JSON.stringify(
      {
        images: [
          {
            filename: 'AppIcon-512@2x.png',
            idiom: 'universal',
            platform: 'ios',
            size: '1024x1024',
          },
        ],
        info: { author: 'xcode', version: 1 },
      },
      null,
      2,
    )}\n`,
  );

  // iOS splash imageset
  const iosSplashDir = path.join(root, 'ios/App/App/Assets.xcassets/Splash.imageset');
  await ensureDir(iosSplashDir);
  for (const name of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) {
    await solidSplash(2732, 2732, path.join(iosSplashDir, name));
  }

  // Android mipmaps + round + adaptive foreground
  const resRoot = path.join(root, 'android/app/src/main/res');
  for (const [folder, icon, fg] of androidMipmaps) {
    const dir = path.join(resRoot, folder);
    await ensureDir(dir);
    await squareIcon(icon, path.join(dir, 'ic_launcher.png'));
    await squareIcon(icon, path.join(dir, 'ic_launcher_round.png'));
    await adaptiveForeground(fg, path.join(dir, 'ic_launcher_foreground.png'));
  }

  // Adaptive background color
  fs.writeFileSync(
    path.join(resRoot, 'values/ic_launcher_background.xml'),
    `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${BG}</color>\n</resources>\n`,
  );

  // Prefer PNG foreground over legacy vector
  const vectorFg = path.join(resRoot, 'drawable-v24/ic_launcher_foreground.xml');
  if (fs.existsSync(vectorFg)) fs.unlinkSync(vectorFg);
  const tealBg = path.join(resRoot, 'drawable/ic_launcher_background.xml');
  if (fs.existsSync(tealBg)) fs.unlinkSync(tealBg);

  for (const [folder, w, h] of androidSplashes) {
    const dir = path.join(resRoot, folder);
    await ensureDir(dir);
    await solidSplash(w, h, path.join(dir, 'splash.png'));
  }

  // Keep PWA / install icons in sync (localhost + hosted + “Add to Home Screen”).
  const iconsDir = path.join(root, 'public/icons');
  await ensureDir(iconsDir);
  await squareIcon(192, path.join(iconsDir, 'icon-192.png'));
  await squareIcon(512, path.join(iconsDir, 'icon-512.png'));
  await squareIcon(512, path.join(root, 'public/pwa-icon.png'));
  // Maskable: extra safe padding
  for (const size of [192, 512]) {
    const pad = Math.round(size * 0.1);
    const inner = size - pad * 2;
    const logo = await sharp(source)
      .resize(inner, inner, { fit: 'contain', background: BG })
      .png()
      .toBuffer();
    await sharp({
      create: { width: size, height: size, channels: 3, background: BG },
    })
      .composite([{ input: logo, left: pad, top: pad }])
      .png()
      .toFile(path.join(iconsDir, `icon-${size}-maskable.png`));
  }

  console.log('[native-icons] Wrote UniLive icons for iOS, Android, and PWA.');
}

main().catch((err) => {
  console.error('[native-icons] Failed:', err);
  process.exit(1);
});
