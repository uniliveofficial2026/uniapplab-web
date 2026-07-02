#!/usr/bin/env node
/**
 * Sync .deepar effect files from DeepAR quickstart → public/effects
 * @see https://github.com/DeepARSDK/quickstart-web-js-npm
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import os from 'node:os';
import { getAppRoot } from './resolveProjectEnv.mjs';

const appRoot = getAppRoot(import.meta.dirname);
const effectsDir = path.join(appRoot, 'public/effects');
const marker = path.join(effectsDir, '.deepar-effects-synced');

const QUICKSTART_REPO = 'https://github.com/DeepARSDK/quickstart-web-js-npm.git';

function hasEffects() {
  if (!fs.existsSync(effectsDir)) return false;
  return fs.readdirSync(effectsDir).some((name) => name.endsWith('.deepar'));
}

if (hasEffects() && fs.existsSync(marker)) {
  console.log('[deepar] Effect files already synced (public/effects)');
  process.exit(0);
}

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'deepar-quickstart-'));
const cloneDir = path.join(tmpRoot, 'quickstart-web-js-npm');

try {
  console.log('[deepar] Cloning quickstart effect pack…');
  execSync(`git clone --depth 1 ${QUICKSTART_REPO} "${cloneDir}"`, {
    stdio: 'inherit',
  });

  const srcEffects = path.join(cloneDir, 'public/effects');
  if (!fs.existsSync(srcEffects)) {
    throw new Error('quickstart public/effects not found');
  }

  fs.mkdirSync(effectsDir, { recursive: true });
  let count = 0;
  for (const name of fs.readdirSync(srcEffects)) {
    if (!name.endsWith('.deepar')) continue;
    fs.copyFileSync(path.join(srcEffects, name), path.join(effectsDir, name));
    count += 1;
  }

  fs.writeFileSync(marker, new Date().toISOString());
  console.log(`[deepar] Synced ${count} effect files → public/effects`);
} finally {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
}
