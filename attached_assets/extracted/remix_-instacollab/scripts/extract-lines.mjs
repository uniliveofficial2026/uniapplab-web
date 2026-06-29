#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const [srcRel, startLine, endLine, outRel, dedentSpaces] = process.argv.slice(2);
if (!srcRel || !startLine || !endLine || !outRel) {
  console.error('Usage: node scripts/extract-lines.mjs <src> <start> <end> <out> [dedent]');
  process.exit(1);
}

const root = path.resolve(import.meta.dirname, '..');
const lines = fs.readFileSync(path.join(root, srcRel), 'utf8').split('\n');
const slice = lines.slice(Number(startLine) - 1, Number(endLine));
const dedent = Number(dedentSpaces || 0);
const body =
  dedent > 0
    ? slice
        .map((line) => (line.startsWith(' '.repeat(dedent)) ? line.slice(dedent) : line))
        .join('\n')
    : slice.join('\n');

fs.mkdirSync(path.dirname(path.join(root, outRel)), { recursive: true });
fs.writeFileSync(path.join(root, outRel), body);
console.log(`Wrote ${outRel} (${slice.length} lines)`);
