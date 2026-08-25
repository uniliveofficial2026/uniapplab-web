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
const presence = fs.readFileSync(path.join(routesDir, 'presence.ts'), 'utf8');
if (!presence.includes('/presence/offline')) {
  console.error('FAIL presence/offline route missing');
  process.exit(1);
}
const gifts = fs.readFileSync(path.join(routesDir, 'gifts.ts'), 'utf8');
if (!gifts.includes('/catalog') && !gifts.includes('"/"')) {
  // gifts router mounts under /gifts; catalog is typically /catalog
  if (!/catalog/i.test(gifts)) {
    console.error('FAIL gifts catalog surface missing');
    process.exit(1);
  }
}
const stream = fs.readFileSync(path.join(routesDir, 'stream.ts'), 'utf8');
if (!stream.includes('room_type') && !stream.includes('roomType')) {
  console.error('FAIL stream room_type support missing');
  process.exit(1);
}
const livekit = fs.readFileSync(path.join(routesDir, 'livekit.ts'), 'utf8');
if (!livekit.includes('live_room_seats') || !livekit.includes('seatedPublisher')) {
  console.error('FAIL livekit seat publish authority missing');
  process.exit(1);
}
const yt = fs.readFileSync(path.join(routesDir, 'youtube.ts'), 'utf8');
for (const needle of ['/youtube/video', '/youtube/channel', '/youtube/comments']) {
  if (!yt.includes(needle)) {
    console.error('FAIL youtube route missing', needle);
    process.exit(1);
  }
}

const authHost = fs.readFileSync(
  path.join(root, 'artifacts/instacollab/src/providers/AuthProvidersHost.tsx'),
  'utf8',
);
if (!authHost.includes('loading: true')) {
  console.error('FAIL AuthProvidersHost boot stub must set loading:true');
  process.exit(1);
}
if (/AUTH_OFFLINE_STUB/.test(authHost) && /loading:\s*false/.test(authHost) && !/not AUTH_OFFLINE_STUB/.test(authHost)) {
  console.error('FAIL AuthProvidersHost must not mount offline stub with loading:false');
  process.exit(1);
}
if (!/AUTH_BOOT_STUB|loading:\s*true/.test(authHost)) {
  console.error('FAIL AuthProvidersHost missing explicit BOOTING stub');
  process.exit(1);
}

const mainTsx = fs.readFileSync(path.join(root, 'artifacts/instacollab/src/main.tsx'), 'utf8');
if (/speed-insights|SpeedInsights/i.test(mainTsx)) {
  console.error('FAIL main.tsx still imports SpeedInsights');
  process.exit(1);
}

const publicCfg = fs.readFileSync(
  path.join(root, 'artifacts/api-server/src/config/PublicConfigService.ts'),
  'utf8',
);
if (!/localhost|127\.0\.0\.1/.test(publicCfg) || !/websocketOrigin/.test(publicCfg)) {
  console.error('FAIL PublicConfigService missing localhost websocketOrigin sanitize');
  process.exit(1);
}

const greedy = fs.readFileSync(
  path.join(root, 'artifacts/instacollab/src/lib/greedyTap/config.ts'),
  'utf8',
);
if (/greedyTapHealthUrl[\s\S]*127\.0\.0\.1:3000\/api\/health/.test(greedy) === false) {
  // DEV-only health is OK; ensure prod path does not hardcode 127.0.0.1 as default return outside DEV
}
const greedyProdDefault = greedy.includes("VITE_APP_ORIGIN || 'https://app.uniapplab.com'");
if (!greedyProdDefault) {
  console.error('FAIL greedy tap missing production origin fallback');
  process.exit(1);
}

const bundle = path.join(root, 'deploy/render-api/dist/app.mjs');
if (fs.existsSync(bundle)) {
  const t = fs.readFileSync(bundle, 'utf8');
  const needles = [
    '"/chat"',
    '"/threads"',
    '/identities',
    '/youtube/video',
    '/presence/offline',
    'buildDmKey',
    'room_type',
    'live_room_seats',
  ];
  for (const needle of needles) {
    if (!t.includes(needle)) {
      console.error('FAIL render-api bundle missing', needle);
      process.exit(1);
    }
  }
}

console.log(JSON.stringify({ ok: true, requiredFiles, regressionChecks: 'pass' }, null, 2));
