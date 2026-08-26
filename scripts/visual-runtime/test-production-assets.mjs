#!/usr/bin/env node
/**
 * Probe production HTTP for required visual assets.
 * Detects HTML SPA fallback masquerading as media (content-type / body sniff).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ORIGIN = process.env.UNILIVE_PROD_ORIGIN || 'https://app.uniapplab.com';
const UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

const required = [
  '/brand/app-logo.png',
  '/unilives-assets/brand/loading/princess-inapp-loading-locked.mp4',
  '/unilives-assets/brand/loading/princess-inapp-loading-locked.jpg',
  '/live-gifts/star.svga',
  '/live-tools-v14/gifts/lucky-bill.png',
  '/live-tools-v14/beauty/natural.png',
  '/live-tools-v14/stickers/hi.png',
  '/live-gifts/approved-v12/UG-001_enchanted-rose.png',
];

function expectedMime(p) {
  if (p.endsWith('.mp4')) return 'video/';
  if (p.endsWith('.png')) return 'image/png';
  if (p.endsWith('.jpg') || p.endsWith('.jpeg')) return 'image/';
  if (p.endsWith('.webp')) return 'image/webp';
  if (p.endsWith('.svg')) return 'image/svg';
  if (p.endsWith('.svga')) return null; // often octet-stream
  return null;
}

async function probe(p) {
  const url = `${ORIGIN}${p}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { 'User-Agent': UA, Accept: '*/*' },
    redirect: 'follow',
  });
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  const buf = Buffer.from(await res.arrayBuffer());
  const head = buf.subarray(0, 64).toString('utf8').trimStart();
  const spaFallback =
    head.startsWith('<!doctype') ||
    head.startsWith('<html') ||
    ct.includes('text/html');
  const expect = expectedMime(p);
  const mimeOk = !expect || ct.includes(expect) || (p.endsWith('.svga') && res.ok && buf.length > 32);
  let failureClass = null;
  if (res.status === 404) failureClass = 'ASSET_404';
  else if (res.status === 403) failureClass = 'ASSET_403';
  else if (spaFallback) failureClass = 'ASSET_CONTENT_TYPE_BAD';
  else if (!res.ok) failureClass = 'ASSET_OTHER';
  else if (buf.length === 0) failureClass = 'ASSET_ZERO_BYTES';
  else if (!mimeOk) failureClass = 'ASSET_CONTENT_TYPE_BAD';
  return {
    path: p,
    status: res.status,
    contentType: ct,
    bytes: buf.length,
    finalUrl: res.url,
    spaFallback,
    failureClass,
  };
}

const rows = [];
for (const p of required) {
  try {
    rows.push(await probe(p));
  } catch (e) {
    rows.push({
      path: p,
      failureClass: 'ASSET_OTHER',
      error: String(e?.message || e).slice(0, 120),
    });
  }
}

const failed = rows.filter((r) => r.failureClass);
const outDir = path.join(ROOT, 'docs/visual-runtime');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  path.join(outDir, 'FINAL-PRODUCTION-ASSET-PROBE.json'),
  JSON.stringify({ origin: ORIGIN, generatedAt: new Date().toISOString(), rows }, null, 2) +
    '\n',
);

if (failed.length) {
  console.error(JSON.stringify({ ok: false, failed }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, probed: rows.length, origin: ORIGIN }, null, 2));
