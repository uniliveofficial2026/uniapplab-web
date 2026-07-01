#!/usr/bin/env node
/**
 * Writes dist/public/live-version.json for production auto-reload polling.
 * Never writes to public/ source — avoids live-sync deploy loops.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const reason = process.argv[2] || 'build';
const OUT = path.join(ROOT, 'artifacts/instacollab/dist/public/live-version.json');

const payload = {
  version: Date.now(),
  reason,
  id: crypto.randomBytes(6).toString('hex'),
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${JSON.stringify(payload)}\n`, 'utf8');
console.log(`[live-version] ${payload.id} (${reason}) → dist`);
