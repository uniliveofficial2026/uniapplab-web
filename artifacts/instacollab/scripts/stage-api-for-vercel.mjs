#!/usr/bin/env node
/**
 * Stage api-server bundle into api/ for Vercel serverless (subfolder root deploys).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const INSTACOLLAB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API_SERVER_DIST = path.join(INSTACOLLAB, '..', 'api-server', 'dist');
const API_DIR = path.join(INSTACOLLAB, 'api');
const BUNDLE_DIR = path.join(API_DIR, '_bundle', 'dist');

function copyTree(src, dest) {
  if (!fs.existsSync(src)) {
    console.error(`[stage-api] Missing ${src} — run: pnpm --filter @workspace/api-server run build`);
    process.exit(1);
  }
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src)) {
    const from = path.join(src, entry);
    const to = path.join(dest, entry);
    if (fs.statSync(from).isDirectory()) copyTree(from, to);
    else fs.copyFileSync(from, to);
  }
}

copyTree(API_SERVER_DIST, BUNDLE_DIR);

const indexJs = `import app from './_bundle/dist/app.mjs';

export default app;
`;
fs.writeFileSync(path.join(API_DIR, 'index.js'), indexJs);
console.log('[stage-api] ✓ Staged api-server → artifacts/instacollab/api/');
