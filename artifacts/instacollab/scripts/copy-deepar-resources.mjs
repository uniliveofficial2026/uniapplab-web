#!/usr/bin/env node
/**
 * Copy node_modules/deepar → public/deepar-resources (official quickstart pattern).
 * @see https://github.com/DeepARSDK/quickstart-web-js-npm
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { getAppRoot } from './resolveProjectEnv.mjs';

const appRoot = getAppRoot(import.meta.dirname);
const require = createRequire(path.join(appRoot, 'package.json'));
const deeparRoot = path.dirname(require.resolve('deepar/package.json'));
const dest = path.join(appRoot, 'public/deepar-resources');

function copyRecursive(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      copyRecursive(from, to);
    } else {
      fs.copyFileSync(from, to);
    }
  }
}

if (!fs.existsSync(deeparRoot)) {
  console.error('[deepar] deepar package not found — run pnpm install');
  process.exit(1);
}

console.log(`[deepar] Copying SDK resources → public/deepar-resources`);
fs.rmSync(dest, { recursive: true, force: true });
copyRecursive(deeparRoot, dest);
console.log('[deepar] SDK resources ready');
