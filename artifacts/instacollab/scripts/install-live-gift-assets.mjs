#!/usr/bin/env node
/**
 * Install TRTC-style SVGA gift animation assets (basic effects player format).
 * Force reinstall: GIFTS_FORCE_INSTALL=1 node scripts/install-live-gift-assets.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { getAppRoot } from './resolveProjectEnv.mjs';

const appRoot = getAppRoot(import.meta.dirname);
const outDir = path.join(appRoot, 'public/live-gifts');
const marker = path.join(outDir, '.live-gifts-installed.json');

const REMOTE_ASSETS = [
  { url: 'https://cdn.jsdelivr.net/gh/svga/SVGA-Samples@master/PinJump.svga', name: 'mic.svga' },
  { url: 'https://cdn.jsdelivr.net/gh/svga/SVGA-Samples@master/angel.svga', name: 'star.svga' },
  { url: 'https://cdn.jsdelivr.net/gh/svga/SVGA-Samples@master/kingset.svga', name: 'crown.svga' },
  { url: 'https://cdn.jsdelivr.net/gh/svga/SVGA-Samples@master/Rocket.svga', name: 'rocket.svga' },
];

function alreadyInstalled() {
  if (process.env.GIFTS_FORCE_INSTALL === '1') return false;
  if (!fs.existsSync(marker)) return false;
  return REMOTE_ASSETS.every(({ name }) => fs.existsSync(path.join(outDir, name)));
}

async function downloadFile(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(destPath, buf);
}

if (alreadyInstalled()) {
  console.log('[live-gifts] Assets already installed — skip (set GIFTS_FORCE_INSTALL=1 to reinstall)');
  process.exit(0);
}

fs.mkdirSync(outDir, { recursive: true });

console.log('[live-gifts] Downloading SVGA gift assets…');
for (const asset of REMOTE_ASSETS) {
  const dest = path.join(outDir, asset.name);
  try {
    await downloadFile(asset.url, dest);
    console.log(`[live-gifts]   ✓ ${asset.name}`);
  } catch (err) {
    console.warn(`[live-gifts]   ✗ ${asset.name}: ${err instanceof Error ? err.message : err}`);
  }
}

const manifest = {
  version: 1,
  installedAt: new Date().toISOString(),
  assets: REMOTE_ASSETS.map(({ name }) => `/live-gifts/${name}`),
};

fs.writeFileSync(path.join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
fs.writeFileSync(marker, `${JSON.stringify({ version: 1, installedAt: manifest.installedAt }, null, 2)}\n`);
console.log('[live-gifts] Done.');
