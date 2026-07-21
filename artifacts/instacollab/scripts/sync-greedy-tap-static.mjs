#!/usr/bin/env node
/**
 * Copy Greedy Tap production static assets into public/games/greedy-slot/
 * so Vercel serves the SPA shell; APIs + socket.io proxy to GREEDY_TAP_ORIGIN.
 *
 * Prefer the committed vendor build (latest UI). Fall back to .local only for
 * local rebuilds.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const vendorDir = path.join(appRoot, 'vendor/greedy-tap/dist');
const localDir = path.join(appRoot, '.local/greedy-tap-production/dist');
const prodDir = fs.existsSync(path.join(vendorDir, 'index.html')) ? vendorDir : localDir;
const outDir = path.join(appRoot, 'public/games/greedy-slot');

if (!fs.existsSync(prodDir)) {
  console.error(
    '[sync-greedy-tap-static] Missing production build — run: pnpm greedy-tap:build (or vendor/greedy-tap/dist)',
  );
  process.exit(1);
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

for (const entry of fs.readdirSync(prodDir)) {
  if (entry === 'server.cjs' || entry.endsWith('.map')) continue;
  const from = path.join(prodDir, entry);
  const to = path.join(outDir, entry);
  if (fs.statSync(from).isDirectory()) {
    fs.cpSync(from, to, { recursive: true });
  } else {
    fs.copyFileSync(from, to);
  }
}

const indexPath = path.join(outDir, 'index.html');
if (fs.existsSync(indexPath)) {
  let html = fs.readFileSync(indexPath, 'utf8');
  if (!html.includes('<base ')) {
    html = html.replace('<head>', '<head>\n    <base href="/games/greedy-slot/" />');
  }
  html = html
    .replace(/"\.\/assets\//g, '"/games/greedy-slot/assets/')
    .replace(/"\/assets\//g, '"/games/greedy-slot/assets/')
    .replace(/"\.\/icon\.svg"/g, '"/games/greedy-slot/icon.svg"')
    .replace(/"\/icon\.svg"/g, '"/games/greedy-slot/icon.svg"')
    .replace(/"\.\/manifest\.json"/g, '"/games/greedy-slot/manifest.json"')
    .replace(/"\/manifest\.json"/g, '"/games/greedy-slot/manifest.json"');
  fs.writeFileSync(indexPath, html);
}

console.log(
  `[sync-greedy-tap-static] ✓ ${path.relative(appRoot, outDir)} ← ${path.relative(appRoot, prodDir)}`,
);
