#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const routesDir = path.join(root, 'artifacts/api-server/src/routes');
const requiredFiles = ['chat.ts', 'gifts.ts', 'livekit.ts', 'me.ts', 'presence.ts', 'stream.ts', 'youtube.ts'];
const missing = requiredFiles.filter((f) => !fs.existsSync(path.join(routesDir, f)));
if (missing.length) {
  console.error('FAIL api map missing route files', missing);
  process.exit(1);
}
const chat = fs.readFileSync(path.join(routesDir, 'chat.ts'), 'utf8');
if (!chat.includes('/threads') || !chat.includes('router.get')) {
  console.error('FAIL chat GET /threads missing');
  process.exit(1);
}
const me = fs.readFileSync(path.join(routesDir, 'me.ts'), 'utf8');
if (!me.includes('/identities')) {
  console.error('FAIL me identities routes missing');
  process.exit(1);
}
const yt = fs.readFileSync(path.join(routesDir, 'youtube.ts'), 'utf8');
if (!yt.includes('/youtube/video')) {
  console.error('FAIL youtube/video route missing');
  process.exit(1);
}
const bundle = path.join(root, 'deploy/render-api/dist/app.mjs');
if (fs.existsSync(bundle)) {
  const t = fs.readFileSync(bundle, 'utf8');
  const needles = ['"/chat"', '"/threads"', '/identities', '/youtube/video', '/presence/offline', 'buildDmKey'];
  for (const needle of needles) {
    if (!t.includes(needle)) {
      console.error('FAIL render-api bundle missing', needle);
      process.exit(1);
    }
  }
}
console.log(JSON.stringify({ ok: true, requiredFiles }, null, 2));
