#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const app = fs.readFileSync(path.join(root, 'artifacts/instacollab/src/App.tsx'), 'utf8');
const required = [
  'MessagesScreen',
  'LiveScreen',
  'ProfileScreen',
  'ReelsScreen',
  'WalletScreen',
  'AuthScreen',
  'GreedyTapScreen',
  'Feed',
];
const missing = required.filter((name) => !app.includes(name));
if (missing.length) {
  console.error('FAIL full-app-routes missing:', missing.join(', '));
  process.exit(1);
}
const lazyCount = (app.match(/lazy\(/g) || []).length;
if (lazyCount < 10) {
  console.error('FAIL full-app-routes: too few lazy screens', lazyCount);
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, lazyCount, required: required.length }, null, 2));
