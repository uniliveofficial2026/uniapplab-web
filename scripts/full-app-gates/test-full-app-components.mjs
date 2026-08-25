#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const required = [
  'artifacts/instacollab/src/components/live/LiveScreen.tsx',
  'artifacts/instacollab/src/components/messages/MessagesScreen.tsx',
  'artifacts/instacollab/src/components/layout/Shell.tsx',
  'artifacts/instacollab/src/components/feed/Feed.tsx',
  'artifacts/instacollab/src/components/auth/AuthScreen.tsx',
  'artifacts/instacollab/src/contexts/ChatCallContext.tsx',
];
const missing = required.filter((p) => !fs.existsSync(path.join(root, p)));
if (missing.length) {
  console.error('FAIL full-app-components missing files:', missing);
  process.exit(1);
}
// Ensure production SPA publish dir is not Studio-only
const spaIndex = path.join(root, 'deploy/spa-public/index.html');
if (fs.existsSync(spaIndex)) {
  const html = fs.readFileSync(spaIndex, 'utf8');
  if (!/UniLive/.test(html)) {
    console.error('FAIL spa index missing UniLive brand');
    process.exit(1);
  }
}
console.log(JSON.stringify({ ok: true, checked: required.length }, null, 2));
