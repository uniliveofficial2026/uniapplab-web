#!/usr/bin/env node
/**
 * Dynamic media URL gate — gift / beauty / sticker catalog paths resolve via contract
 * and exist under public/.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PUBLIC = path.join(ROOT, 'artifacts/instacollab/public');

// Inline contract (avoid TS loader dependency in this gate)
function normalize(s) {
  const v = String(s || '').trim();
  if (!v) return '';
  if (v.startsWith('/') || /^https?:/i.test(v) || v.startsWith('blob:') || v.startsWith('data:')) return v;
  if (/^[A-Za-z0-9_.@+-]+(\/[A-Za-z0-9_.@+-]+)*\/?(\?.*)?(#.*)?$/.test(v)) return `/${v}`;
  return v;
}

const artworkTs = fs.readFileSync(
  path.join(ROOT, 'artifacts/instacollab/src/smule-rooms/components/liveToolsV14Artwork.ts'),
  'utf8',
);
const urls = [...artworkTs.matchAll(/`\$\{ASSET_ROOT\}\/([^`]+)`/g)].map((m) => `/live-tools-v14/${m[1]}`);
const v12 = [
  ...fs.readFileSync(
    path.join(ROOT, 'artifacts/instacollab/src/lib/live/giftStudioCatalog.ts'),
    'utf8',
  ).matchAll(/icon:\s*'(\/live-gifts\/approved-v12\/[^']+)'/g),
].map((m) => m[1]);

const all = [...new Set([...urls, ...v12])];
const missing = [];
for (const u of all) {
  const norm = normalize(u);
  if (norm !== u && u.startsWith('/')) {
    missing.push({ u, issue: 'normalize_changed_root' });
    continue;
  }
  const abs = path.join(PUBLIC, norm.replace(/^\//, ''));
  if (!fs.existsSync(abs)) missing.push({ u: norm, issue: 'missing_file' });
}

if (missing.length) {
  console.error(JSON.stringify({ ok: false, missing: missing.slice(0, 40), totalMissing: missing.length }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, checked: all.length }, null, 2));
