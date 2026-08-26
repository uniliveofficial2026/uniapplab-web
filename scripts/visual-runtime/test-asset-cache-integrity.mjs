#!/usr/bin/env node
/** Cache integrity: deploy SPA index hashed assets must exist on disk. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SPA = path.join(ROOT, 'deploy/spa-public');
const indexPath = path.join(SPA, 'index.html');
if (!fs.existsSync(indexPath)) {
  console.error('FAIL missing deploy/spa-public/index.html');
  process.exit(1);
}
const html = fs.readFileSync(indexPath, 'utf8');
const refs = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
const missing = [];
for (const ref of refs) {
  const abs = path.join(SPA, ref.replace(/^\//, ''));
  if (!fs.existsSync(abs)) missing.push(ref);
}
if (missing.length) {
  console.error(JSON.stringify({ ok: false, missing }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, checked: refs.length }, null, 2));
