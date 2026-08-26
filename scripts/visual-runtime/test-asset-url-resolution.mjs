#!/usr/bin/env node
/** URL resolution gate — mirrors mediaUrlContract.ts rules (no TS loader needed). */
import assert from 'node:assert/strict';

function classify(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return 'EMPTY';
  if (s.startsWith('app-media:')) return 'APP_MEDIA_REF';
  if (s.startsWith('blob:')) return 'BLOB_URL';
  if (s.startsWith('data:')) return 'DATA_URL';
  if (/^https:\/\//i.test(s)) return 'ABSOLUTE_HTTPS_ASSET';
  if (/^http:\/\//i.test(s)) return 'ABSOLUTE_HTTP_ASSET';
  if (s.startsWith('/')) return 'PUBLIC_ROOT_ASSET';
  if (/^[A-Za-z0-9_.@+-]+(\/[A-Za-z0-9_.@+-]+)*\/?(\?.*)?(#.*)?$/.test(s)) {
    return 'APP_RELATIVE_ASSET';
  }
  return 'UNKNOWN';
}

function normalize(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  const kind = classify(s);
  if (
    kind === 'PUBLIC_ROOT_ASSET' ||
    kind === 'ABSOLUTE_HTTPS_ASSET' ||
    kind === 'ABSOLUTE_HTTP_ASSET' ||
    kind === 'BLOB_URL' ||
    kind === 'DATA_URL' ||
    kind === 'APP_MEDIA_REF'
  ) {
    return s;
  }
  if (kind === 'APP_RELATIVE_ASSET') return `/${s.replace(/^\/+/, '')}`;
  if (s.startsWith('//')) return `https:${s}`;
  return s;
}

function resolve(raw, fallback = '') {
  const s = String(raw ?? '').trim();
  if (!s) return fallback;
  const kind = classify(s);
  if (kind === 'APP_MEDIA_REF' || kind === 'UNKNOWN' || kind === 'EMPTY') return fallback;
  return normalize(s) || fallback;
}

// Sync with source contract by reading file and requiring key symbols exist
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const src = fs.readFileSync(
  path.join(ROOT, 'artifacts/instacollab/src/lib/mediaUrlContract.ts'),
  'utf8',
);
assert.match(src, /export function resolvePresentationMediaUrl/);
assert.match(src, /PUBLIC_ROOT_ASSET/);
assert.match(src, /APP_RELATIVE_ASSET/);

assert.equal(classify('/live-tools-v14/gifts/x.png'), 'PUBLIC_ROOT_ASSET');
assert.equal(normalize('/live-tools-v14/gifts/x.png'), '/live-tools-v14/gifts/x.png');
assert.equal(normalize('assets/foo.png'), '/assets/foo.png');
assert.equal(resolve('assets/foo.png', 'FB'), '/assets/foo.png');
assert.equal(resolve('app-media:x', 'FB'), 'FB');
assert.equal(resolve('https://x/y.png', 'FB'), 'https://x/y.png');
assert.notEqual(normalize('/assets/foo.png'), '/assets/assets/foo.png');

// instantMediaSrc / safeMediaUrl must use the contract (regression: Unsplash wipe)
const instant = fs.readFileSync(
  path.join(ROOT, 'artifacts/instacollab/src/lib/mediaInstant.ts'),
  'utf8',
);
const safe = fs.readFileSync(
  path.join(ROOT, 'artifacts/instacollab/src/lib/safe.ts'),
  'utf8',
);
assert.match(instant, /isPaintableMediaUrl/);
assert.match(instant, /normalizePresentationMediaUrl/);
assert.match(safe, /isPaintableMediaUrl/);
assert.match(safe, /normalizePresentationMediaUrl/);

console.log(JSON.stringify({ ok: true }, null, 2));
