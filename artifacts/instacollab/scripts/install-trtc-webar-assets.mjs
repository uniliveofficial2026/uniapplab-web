#!/usr/bin/env node
/**
 * First-install TRTC / Tencent WebAR beauty package assets.
 * Writes a local manifest under public/trtc-webar/ and skips on subsequent runs.
 *
 * Force reinstall: TRTC_FORCE_INSTALL=1 node scripts/install-trtc-webar-assets.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { getAppRoot } from './resolveProjectEnv.mjs';

const appRoot = getAppRoot(import.meta.dirname);
const outDir = path.join(appRoot, 'public/trtc-webar');
const bgDir = path.join(outDir, 'backgrounds');
const marker = path.join(outDir, '.trtc-webar-installed.json');
const require = createRequire(import.meta.url);

const REMOTE_BACKGROUNDS = [
  'https://webar-static.tencent-cloud.com/assets/background/1.jpg',
  'https://webar-static.tencent-cloud.com/assets/background/2.jpg',
  'https://webar-static.tencent-cloud.com/assets/background/3.jpg',
  'https://webar-static.tencent-cloud.com/assets/background/4.jpg',
];

const REMOTE_VIDEO_BACKGROUNDS = [
  'https://webar-static.tencent-cloud.com/assets/background/video-bg-1.mp4',
  'https://webar-static.tencent-cloud.com/assets/background/video-bg-2.mp4',
];

const LOCAL_VIDEO_BACKGROUNDS = [
  '/trtc-webar/backgrounds/video-bg-1.mp4',
  '/trtc-webar/backgrounds/video-bg-2.mp4',
];

function packageVersion(name) {
  try {
    const pkgPath = require.resolve(`${name}/package.json`);
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    return String(pkg.version || 'unknown');
  } catch {
    return null;
  }
}

function alreadyInstalled() {
  if (process.env.TRTC_FORCE_INSTALL === '1') return false;
  if (!fs.existsSync(marker)) return false;
  const manifest = path.join(outDir, 'manifest.json');
  const video1 = path.join(bgDir, 'video-bg-1.mp4');
  return fs.existsSync(manifest) && fs.existsSync(video1);
}

async function downloadFile(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(destPath, buf);
}

if (alreadyInstalled()) {
  console.log('[trtc-webar] Assets already installed — skip (set TRTC_FORCE_INSTALL=1 to reinstall)');
  process.exit(0);
}

fs.mkdirSync(bgDir, { recursive: true });

const webarVersion = packageVersion('tencentcloud-webar');
if (!webarVersion) {
  console.warn('[trtc-webar] tencentcloud-webar not found in node_modules — manifest only');
}

console.log('[trtc-webar] Downloading video background assets…');
for (const url of REMOTE_VIDEO_BACKGROUNDS) {
  const name = path.basename(url);
  const dest = path.join(bgDir, name);
  try {
    await downloadFile(url, dest);
    console.log(`[trtc-webar]   ✓ ${name}`);
  } catch (err) {
    console.warn(`[trtc-webar]   ✗ ${name}:`, err instanceof Error ? err.message : err);
  }
}

const manifest = {
  installedAt: new Date().toISOString(),
  package: 'tencentcloud-webar',
  version: webarVersion,
  modules: ['beautify', 'segmentation'],
  backgrounds: [...REMOTE_BACKGROUNDS, ...LOCAL_VIDEO_BACKGROUNDS],
  videoBackgrounds: LOCAL_VIDEO_BACKGROUNDS,
  tabs: ['beauty', 'makeup', 'sticker', 'filter', 'background'],
  features: [
    'setBeautify',
    'getEffectList',
    'getCommonFilter',
    'setEffect',
    'setFilter',
    'setBackground',
  ],
};

fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
fs.writeFileSync(
  marker,
  JSON.stringify(
    {
      installedAt: manifest.installedAt,
      version: webarVersion,
    },
    null,
    2,
  ),
);

console.log('[trtc-webar] Install complete → public/trtc-webar/');
