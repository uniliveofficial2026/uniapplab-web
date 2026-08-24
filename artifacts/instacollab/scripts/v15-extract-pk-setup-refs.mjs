#!/usr/bin/env node
/**
 * Extract per-state locked PK setup references from the V15 MASTER control board.
 * Uniform contain onto 390×844 — never non-uniform stretch.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const masterRel = 'PK-controls/01-pk-setup-controls-all-types-approved.jpeg';
const master = path.join(
  appRoot,
  '../../UniLives-Final-Approved-UIUX-Production-Cursor-v15/reference-approved/MASTER',
  masterRel,
);
const docsDir = path.join(appRoot, 'docs/v15-visual-spec');
const parityRoot = path.join(appRoot, '.local-dev/v15-parity/02-pk-setup');
const VW = 390;
const VH = 844;
const CANVAS = { r: 0, g: 2, b: 7, alpha: 1 };

/** Detected content blobs on the 1536×1024 MASTER (row1 setup types, row2 control panels). */
const STATES = [
  { state: '1v1', dir: '01-1v1', crop: { x: 11, y: 55, width: 252, height: 306 } },
  { state: '2v2', dir: '02-2v2', crop: { x: 270, y: 55, width: 240, height: 306 } },
  { state: '3v3', dir: '03-3v3', crop: { x: 517, y: 55, width: 286, height: 306 } },
  { state: '4v4', dir: '04-4v4', crop: { x: 810, y: 55, width: 241, height: 306 } },
  { state: '6v6', dir: '05-6v6', crop: { x: 1057, y: 55, width: 224, height: 306 } },
  { state: 'live-sell', dir: '06-live-sell', crop: { x: 1287, y: 55, width: 238, height: 306 } },
  { state: 'invite', dir: '07-invite', crop: { x: 11, y: 390, width: 251, height: 281 } },
  { state: 'duration', dir: '08-duration', crop: { x: 271, y: 390, width: 283, height: 281 } },
  { state: 'random', dir: '09-random', crop: { x: 566, y: 390, width: 303, height: 281 } },
  { state: 'confirmation', dir: '10-confirmation', crop: { x: 878, y: 390, width: 292, height: 281 } },
];

async function main() {
  if (!fs.existsSync(master)) {
    throw new Error(`MASTER missing: ${master}`);
  }
  const meta = await sharp(master).metadata();
  const map = {
    source: masterRel,
    sourcePx: { width: meta.width, height: meta.height },
    targetViewport: { width: VW, height: VH },
    method: 'uniform-contain-center',
    generatedAt: new Date().toISOString(),
    states: [],
  };

  for (const item of STATES) {
    const { crop } = item;
    const scale = Math.min(VW / crop.width, VH / crop.height);
    const outW = Math.round(crop.width * scale);
    const outH = Math.round(crop.height * scale);
    const left = Math.round((VW - outW) / 2);
    const top = Math.round((VH - outH) / 2);
    const destDir = path.join(parityRoot, item.dir);
    fs.mkdirSync(destDir, { recursive: true });
    const panel = await sharp(master)
      .extract({ left: crop.x, top: crop.y, width: crop.width, height: crop.height })
      .resize(outW, outH, { fit: 'fill', kernel: 'lanczos3' })
      .png()
      .toBuffer();
    await sharp({
      create: { width: VW, height: VH, channels: 4, background: CANVAS },
    })
      .composite([{ input: panel, left, top }])
      .png()
      .toFile(path.join(destDir, 'reference.png'));

    const entry = {
      state: item.state,
      dir: item.dir,
      source: masterRel,
      crop,
      scaleFactor: Number(scale.toFixed(6)),
      panelBounds: { x: left, y: top, width: outW, height: outH },
      targetViewport: { width: VW, height: VH },
      individuallyAvailable: true,
    };
    map.states.push(entry);
    console.log(item.state, 'scale', scale.toFixed(4), 'panel', entry.panelBounds);
  }

  fs.mkdirSync(docsDir, { recursive: true });
  fs.writeFileSync(path.join(docsDir, 'pk-setup-reference-map.json'), JSON.stringify(map, null, 2));
  console.log('wrote', path.join(docsDir, 'pk-setup-reference-map.json'));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
