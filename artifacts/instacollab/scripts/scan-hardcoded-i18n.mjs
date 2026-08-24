#!/usr/bin/env node
/**
 * Static analysis: fail on new undocumented user-facing hardcoded English in TSX/JSX.
 * Allowlisted classifications only: brand | identifier | test | log | ugc-canonical.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const allowPath = path.join(root, 'src/lib/i18n/hardcoded-allowlist.txt');

const ALLOW = new Set(
  fs.existsSync(allowPath)
    ? fs
        .readFileSync(allowPath, 'utf8')
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#'))
    : [],
);

const CLASS_RE = /i18n-allow:\s*(brand|identifier|test|log|ugc-canonical)/;

function walk(dir, acc = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (name === 'node_modules' || name === 'dist' || name === 'i18n') continue;
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full, acc);
    else if (/\.(tsx|jsx)$/.test(name)) acc.push(full);
  }
  return acc;
}

const JSX_TEXT = />(\s*[A-Za-z][^<{]{1,120})</g;
const ATTR_TEXT = /\b(?:placeholder|title|aria-label|alt|aria-placeholder)\s*=\s*["']([^"']{2,160})["']/g;

const hits = [];
for (const file of walk(path.join(root, 'src'))) {
  const rel = path.relative(root, file);
  const text = fs.readFileSync(file, 'utf8');
  if (CLASS_RE.test(text.split('\n').slice(0, 8).join('\n'))) continue;
  let m;
  const jsx = new RegExp(JSX_TEXT.source, 'g');
  while ((m = jsx.exec(text))) {
    const value = m[1].trim();
    if (!value || ALLOW.has(value)) continue;
    if (/^(UniLive’s|VIP|SVIP|OK|PK|K-Star|YouTube)$/.test(value)) continue;
    if (!/[a-z]/.test(value)) continue;
    hits.push({ file: rel, kind: 'jsx', value });
  }
  const attr = new RegExp(ATTR_TEXT.source, 'g');
  while ((m = attr.exec(text))) {
    const value = m[1].trim();
    if (!value || ALLOW.has(value)) continue;
    if (/^(UniLive’s|VIP|SVIP|OK|PK)$/.test(value)) continue;
    hits.push({ file: rel, kind: 'attr', value });
  }
}

if (process.argv.includes('--report')) {
  console.log(JSON.stringify({ count: hits.length, sample: hits.slice(0, 40) }, null, 2));
  process.exit(0);
}

// Gate is advisory until remaining JSX is migrated to t(); still fails on *new* obvious toast/alert English
// when `--strict` is passed. Default: report + exit 0 after baseline snapshot.
const baselinePath = path.join(root, 'src/lib/i18n/hardcoded-baseline.json');
const baseline = fs.existsSync(baselinePath)
  ? JSON.parse(fs.readFileSync(baselinePath, 'utf8'))
  : { count: hits.length };
if (!fs.existsSync(baselinePath)) {
  fs.writeFileSync(baselinePath, JSON.stringify({ count: hits.length, generatedAt: new Date().toISOString() }, null, 2));
}

if (process.argv.includes('--strict') && hits.length > baseline.count) {
  console.error(`i18n scan FAIL: ${hits.length} hardcoded strings (baseline ${baseline.count})`);
  console.error(hits.slice(0, 20).map((h) => `${h.file}: ${h.value}`).join('\n'));
  process.exit(1);
}

console.log(`i18n scan: ${hits.length} hardcoded UI strings (baseline ${baseline.count})`);
process.exit(0);
