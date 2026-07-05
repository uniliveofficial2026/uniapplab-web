#!/usr/bin/env node
/**
 * Ensure local pre-look PNGs exist for TRTC beauty + body-shape tray buttons.
 * Copies from nearest sibling preview when a dedicated thumb is missing (dev + CI).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const previewsDir = path.join(appRoot, 'public/effects/previews');

/** targetId -> sourceId (must exist or be created earlier in list) */
const ALIASES = [
  ['beauty-natural', 'beauty-soft'],
  ['beauty-clear', 'beauty-smooth'],
  ['shape-natural', 'beauty-soft'],
  ['shape-slim-face', 'beauty-smooth'],
  ['shape-full-face', 'beauty-soft'],
  ['shape-vline', 'beauty-clear'],
  ['shape-big-eyes', 'beauty-glow'],
  ['shape-model-waist', 'beauty-smooth'],
  ['shape-curvy', 'beauty-soft'],
  ['shape-long-legs', 'beauty-natural'],
  ['shape-athletic', 'beauty-clear'],
  ['shape-glam', 'beauty-glow'],
];

function exists(id) {
  return fs.existsSync(path.join(previewsDir, `${id}.png`));
}

function copyPreview(fromId, toId) {
  const src = path.join(previewsDir, `${fromId}.png`);
  const dest = path.join(previewsDir, `${toId}.png`);
  if (!fs.existsSync(src)) return false;
  fs.copyFileSync(src, dest);
  return true;
}

if (!fs.existsSync(previewsDir)) {
  console.warn('[previews] Skip — run pnpm deepar:install first');
  process.exit(0);
}

let created = 0;
for (const [target, source] of ALIASES) {
  if (exists(target)) continue;
  if (copyPreview(source, target)) {
    created += 1;
    console.log(`[previews] ${target}.png ← ${source}.png`);
  } else {
    console.warn(`[previews] Missing source for ${target}: ${source}.png`);
  }
}

if (created > 0) {
  console.log(`[previews] Created ${created} alias thumb(s)`);
}
