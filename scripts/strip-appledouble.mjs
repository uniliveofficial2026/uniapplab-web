#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const target = process.argv[2];
if (!target) {
  console.error('Usage: node strip-appledouble.mjs <dir>');
  process.exit(1);
}

function walk(dir) {
  let removed = 0;
  if (!fs.existsSync(dir)) return removed;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.name.startsWith('._')) {
      fs.rmSync(full, { force: true });
      removed += 1;
      continue;
    }
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.git') {
      removed += walk(full);
    }
  }
  return removed;
}

const count = walk(path.resolve(target));
console.log(`[strip-appledouble] Removed ${count} file(s) from ${target}`);
process.exit(0);
