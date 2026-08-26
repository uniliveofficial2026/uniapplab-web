#!/usr/bin/env node
/** iOS animation contracts — structural + optional WebKit progression on prod. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// Ensure iOS matrix doc exists
const matrix = path.join(ROOT, 'docs/visual-runtime/FINAL-IOS-ANIMATION-MATRIX.json');
if (!fs.existsSync(matrix)) {
  console.error('FAIL missing FINAL-IOS-ANIMATION-MATRIX.json — run generate-inventories first');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(matrix, 'utf8'));
if (!Array.isArray(data.entries) || data.entries.length < 6) {
  console.error('FAIL ios matrix too small');
  process.exit(1);
}

// Critical contracts present in source
const loading = fs.readFileSync(
  path.join(ROOT, 'artifacts/instacollab/src/components/brand/UniLivesPrincessLoadingRefreshLayout.tsx'),
  'utf8',
);
for (const n of ['playsInline', 'muted', 'webkit-playsinline', 'void el.play()']) {
  if (!loading.includes(n)) {
    console.error('FAIL loading iOS autoplay contract missing', n);
    process.exit(1);
  }
}

console.log(
  JSON.stringify(
    {
      ok: true,
      entries: data.entries.length,
      note: 'Physical iPhone T0/T1 progression remains authoritative for PASS',
    },
    null,
    2,
  ),
);
