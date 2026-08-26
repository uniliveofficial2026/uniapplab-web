#!/usr/bin/env node
/**
 * Image decode gate (structural + optional Playwright WebKit).
 * Always verifies local files are non-empty image/video magic.
 * When PLAYWRIGHT=1, also loads URLs in WebKit and checks naturalWidth.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PUBLIC = path.join(ROOT, 'artifacts/instacollab/public');

const samples = [
  'live-tools-v14/gifts/lucky-bill.png',
  'live-tools-v14/beauty/natural.png',
  'live-tools-v14/stickers/hi.png',
  'live-gifts/approved-v12/UG-001_enchanted-rose.png',
  'brand/app-logo.png',
  'unilives-assets/brand/loading/princess-inapp-loading-locked.jpg',
];

function sniffOk(buf, rel) {
  if (buf.length < 32) return false;
  if (rel.endsWith('.png')) return buf[0] === 0x89 && buf[1] === 0x50;
  if (rel.endsWith('.jpg') || rel.endsWith('.jpeg')) return buf[0] === 0xff && buf[1] === 0xd8;
  if (rel.endsWith('.webp')) return buf.toString('ascii', 0, 4) === 'RIFF';
  if (rel.endsWith('.mp4')) return buf.length > 1000;
  return true;
}

const bad = [];
for (const rel of samples) {
  const abs = path.join(PUBLIC, rel);
  if (!fs.existsSync(abs)) {
    bad.push({ rel, err: 'missing' });
    continue;
  }
  const buf = fs.readFileSync(abs);
  if (!sniffOk(buf, rel)) bad.push({ rel, err: 'bad_magic', bytes: buf.length });
}

if (bad.length) {
  console.error(JSON.stringify({ ok: false, bad }, null, 2));
  process.exit(1);
}

if (process.env.PLAYWRIGHT === '1') {
  const { chromium, webkit } = await import('playwright');
  const browser = await webkit.launch({ headless: true }).catch(() => chromium.launch({ headless: true }));
  const page = await browser.newPage();
  const origin = process.env.UNILIVE_PROD_ORIGIN || 'https://app.uniapplab.com';
  const decodeFails = [];
  for (const rel of samples.filter((r) => r.endsWith('.png') || r.endsWith('.jpg'))) {
    const url = `${origin}/${rel}`;
    const result = await page.evaluate(async (src) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      const ok = await new Promise((resolve) => {
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = src;
      });
      if (!ok) return { ok: false };
      try {
        await img.decode();
      } catch {
        return { ok: false, decode: false };
      }
      return { ok: img.naturalWidth > 0 && img.naturalHeight > 0, w: img.naturalWidth, h: img.naturalHeight };
    }, url);
    if (!result.ok) decodeFails.push({ rel, result });
  }
  await browser.close();
  if (decodeFails.length) {
    console.error(JSON.stringify({ ok: false, decodeFails }, null, 2));
    process.exit(1);
  }
}

console.log(JSON.stringify({ ok: true, samples: samples.length, playwright: process.env.PLAYWRIGHT === '1' }, null, 2));
