#!/usr/bin/env node
/** Resize V15 PK MASTER references to 390×844 PNGs under .local-dev/v15-parity/<screen>/ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const pkgRoot = path.resolve(appRoot, '../..');
const master = path.join(pkgRoot, 'UniLives-Final-Approved-UIUX-Production-Cursor-v15/reference-approved/MASTER');
const parityRoot = path.join(appRoot, '.local-dev/v15-parity');

const MAP = {
  '02-pk-setup': 'PK-controls/01-pk-setup-controls-all-types-approved.jpeg',
  '03-1v1': 'PK-running/01-1v1-running-approved.jpeg',
  '04-2v2': 'PK-running/02-2v2-running-approved.jpeg',
  '05-3v3': 'PK-running/03-3v3-running-approved.jpeg',
  '06-4v4': 'PK-running/04-4v4-running-approved.jpeg',
  '07-6v6': 'PK-running/05-6v6-running-approved.jpeg',
  '08-live-sell-pk': 'PK-running/06-live-sell-pk-running-approved.jpeg',
};

async function main() {
  for (const [dir, file] of Object.entries(MAP)) {
    const screenDir = path.join(parityRoot, dir);
    fs.mkdirSync(screenDir, { recursive: true });
    const src = path.join(master, file);
    const dest = path.join(screenDir, 'reference.png');
    await sharp(src).resize(390, 844, { fit: 'fill' }).png().toFile(dest);
    console.log('wrote', dest);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
