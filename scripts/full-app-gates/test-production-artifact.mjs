#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const spa = path.join(root, 'deploy/spa-public');
const api = path.join(root, 'deploy/render-api/dist/app.mjs');
if (!fs.existsSync(path.join(spa, 'index.html'))) {
  console.error('FAIL missing deploy/spa-public/index.html');
  process.exit(1);
}
if (!fs.existsSync(api)) {
  console.error('FAIL missing deploy/render-api/dist/app.mjs');
  process.exit(1);
}
const html = fs.readFileSync(path.join(spa, 'index.html'), 'utf8');
if (/speed-insights|localhost:|127\.0\.0\.1/.test(html)) {
  console.error('FAIL spa index has forbidden refs');
  process.exit(1);
}
const assets = fs.readdirSync(path.join(spa, 'assets')).filter((f) => f.endsWith('.js'));
if (assets.length < 20) {
  console.error('FAIL too few spa js assets', assets.length);
  process.exit(1);
}
// Sample a few JS assets for HTML masquerading
for (const name of assets.slice(0, 5)) {
  const head = fs.readFileSync(path.join(spa, 'assets', name), 'utf8').slice(0, 80);
  if (head.trimStart().startsWith('<!doctype') || head.trimStart().startsWith('<html')) {
    console.error('FAIL js asset looks like HTML', name);
    process.exit(1);
  }
}

const homeShadow = path.join(spa, 'home', 'index.html');
if (fs.existsSync(homeShadow)) {
  console.error('FAIL static home/index.html shadows SPA /home route — move to oauth-brand/');
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, spaJsAssets: assets.length }, null, 2));
