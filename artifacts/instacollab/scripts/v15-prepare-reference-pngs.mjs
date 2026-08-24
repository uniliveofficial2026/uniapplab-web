#!/usr/bin/env node
/** Resize V15 MASTER references to 390×844 PNGs for parity compare. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const pkgRoot = path.resolve(appRoot, '../..');
const masterTools = path.join(pkgRoot, 'UniLives-Final-Approved-UIUX-Production-Cursor-v15/reference-approved/MASTER/live-tools');
const outDir = path.join(appRoot, '.local-dev/v15-parity');

const MAP = {
  guests: '01-guests-approved.jpeg',
  gifts: '02-gifts-approved.jpeg',
  stickers: '03-stickers-approved.jpeg',
  voice: '04-voice-changer-approved.jpeg',
  beauty: '05-beauty-effects-approved.jpeg',
  games: '06-game-center-approved.jpeg',
};

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  for (const [id, file] of Object.entries(MAP)) {
    const src = path.join(masterTools, file);
    const dest = path.join(outDir, `${id}-reference.png`);
    await sharp(src).resize(390, 844, { fit: 'fill' }).png().toFile(dest);
    console.log('wrote', dest);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
