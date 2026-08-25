#!/usr/bin/env node
/** Classifies keyboard-related patterns; fails on forbidden screen-local math. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const srcRoot = path.join(root, 'artifacts/instacollab/src');
const allowlist = new Set([
  path.join(srcRoot, 'lib/safeArea.ts'),
  path.join(srcRoot, 'lib/bootNativeShell.ts'),
  path.join(srcRoot, 'lib/nativeKeyboardPolicy.ts'),
  path.join(srcRoot, 'contexts/AppViewportContext.tsx'),
  path.join(srcRoot, 'components/common/keyboardLayout.ts'),
  path.join(srcRoot, 'index.css'),
]);

const forbidden = [
  { re: /KeyboardResize\.Body/, msg: 'KeyboardResize.Body duplicate strategy' },
  { re: /safeBottom\s*\+\s*keyboard/i, msg: 'safeBottom folded with keyboard' },
  { re: /100vh\s*-\s*var\(--app-keyboard-inset/i, msg: 'double keyboard viewport subtraction' },
];

function walk(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules') continue;
      walk(full, acc);
    } else if (/\.(tsx?|css)$/.test(ent.name)) acc.push(full);
  }
  return acc;
}

const hits = [];
for (const file of walk(srcRoot)) {
  if (allowlist.has(file)) continue;
  const src = fs.readFileSync(file, 'utf8');
  for (const f of forbidden) {
    if (f.re.test(src)) hits.push({ file: path.relative(srcRoot, file), msg: f.msg });
  }
}

if (hits.length) {
  console.error('FAIL legacy keyboard patterns:');
  for (const h of hits) console.error(`  ${h.file}: ${h.msg}`);
  process.exit(1);
}
console.log('scan-legacy-keyboard PASS (no forbidden duplicate strategies)');
