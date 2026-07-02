#!/usr/bin/env node
/**
 * Write repo-root vercel.json (monorepo: SPA + api-server).
 * Git deploys and CLI staging both need this at the project root.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function buildVercelConfig() {
  const monorepo = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'vercel.monorepo.json'), 'utf8'),
  );
  const instacollab = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'artifacts/instacollab/vercel.json'), 'utf8'),
  );

  const seen = new Set((monorepo.headers ?? []).map((h) => h.source));
  const headers = [...(monorepo.headers ?? [])];
  for (const h of instacollab.headers ?? []) {
    if (!seen.has(h.source)) {
      headers.push(h);
      seen.add(h.source);
    }
  }
  if (!seen.has('/api/(.*)')) {
    headers.push({
      source: '/api/(.*)',
      headers: [{ key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' }],
    });
  }

  return {
    ...monorepo,
    headers,
  };
}

export function writeVercelConfig(targetDir = ROOT) {
  const config = buildVercelConfig();
  const out = path.join(targetDir, 'vercel.json');
  fs.writeFileSync(out, `${JSON.stringify(config, null, 2)}\n`);
  return out;
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  const out = writeVercelConfig();
  console.log(`[vercel] Wrote ${out}`);
}
