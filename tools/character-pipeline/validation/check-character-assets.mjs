#!/usr/bin/env node
/**
 * Validate UniLive’s character pipeline folders and runtime exports.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

const requiredDirs = [
  'tools/character-pipeline/meshy',
  'tools/character-pipeline/blender',
  'tools/character-pipeline/audio',
  'tools/character-pipeline/validation',
  'assets-source/unilives-character/references',
  'assets-source/unilives-character/blender',
  'assets-source/unilives-character/textures',
  'assets-source/unilives-character/rigs',
  'assets-source/unilives-character/animations',
  'assets-source/unilives-character/audio',
  'artifacts/instacollab/public/unilives-assets/characters',
];

let failed = 0;
for (const rel of requiredDirs) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) {
    console.error(`MISSING dir: ${rel}`);
    failed += 1;
  } else {
    console.log(`OK dir: ${rel}`);
  }
}

const runtime = path.join(ROOT, 'artifacts/instacollab/public/unilives-assets/characters');
const glbs = fs.existsSync(runtime)
  ? fs.readdirSync(runtime).filter((f) => f.endsWith('.glb'))
  : [];
console.log(`Runtime GLBs: ${glbs.length}${glbs.length ? ` (${glbs.join(', ')})` : ' — none yet'}`);

const envLocal = path.join(ROOT, '.env.meshy.local');
const envExample = path.join(ROOT, '.env.meshy.local.example');
console.log(fs.existsSync(envExample) ? 'OK .env.meshy.local.example' : 'MISSING .env.meshy.local.example');
console.log(fs.existsSync(envLocal) ? 'OK .env.meshy.local (present)' : 'MISSING .env.meshy.local');

process.exit(failed ? 1 : 0);
