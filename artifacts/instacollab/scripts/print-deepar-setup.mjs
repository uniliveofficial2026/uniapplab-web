#!/usr/bin/env node
/**
 * Print DeepAR setup for InstaCollab (official SDK zip + free filter pack).
 */
import fs from 'node:fs';
import path from 'node:path';
import { findEnvFile, readMergedEnv, getAppRoot } from './resolveProjectEnv.mjs';

const appRoot = getAppRoot(import.meta.dirname);
const merged = readMergedEnv(import.meta.dirname);
const key = (merged.VITE_DEEPAR_LICENSE_KEY ?? '').trim();
const hasKey = Boolean(key && !/your|xxxx|placeholder/i.test(key));
const hasResources = fs.existsSync(path.join(appRoot, 'public/deepar-resources/wasm/deepar.wasm'));
const hasEffects = fs.existsSync(path.join(appRoot, 'public/effects/MakeupLook.deepar'));
const hasArchives =
  fs.existsSync(path.join(appRoot, 'vendor/archives/DeepAR-Web-v5.6.22.zip')) &&
  fs.existsSync(path.join(appRoot, 'vendor/archives/free_package.zip'));

console.log('');
console.log('InstaCollab — DeepAR setup');
console.log('──────────────────────────');
console.log(`  License configured: ${hasKey ? 'yes' : 'no'}`);
console.log(`  SDK (public/deepar-resources): ${hasResources ? 'yes' : 'no'}`);
console.log(`  Free filters (public/effects): ${hasEffects ? 'yes' : 'no'}`);
console.log(`  Cached archives (vendor/archives): ${hasArchives ? 'yes' : 'no'}`);
console.log('');
console.log('  1. License: https://developer.deepar.ai → Web app → VITE_DEEPAR_LICENSE_KEY');
console.log('  2. Add allowed origins: http://localhost:5173, https://app.uniapplab.com');
console.log('  3. Push license to Vercel (required for production AR):');
console.log('       pnpm --filter @workspace/instacollab run deepar:env-vercel');
console.log('');
console.log('  4. Install SDK + filters from your zip files:');
console.log('');
console.log('       pnpm --filter @workspace/instacollab run deepar:install');
console.log('');
console.log('     Archives (first found):');
console.log('       • vendor/archives/DeepAR-Web-v5.6.22.zip');
console.log('       • vendor/archives/free_package.zip');
console.log('       • ~/Downloads/ (same filenames)');
console.log('');
console.log('  AR surfaces: Live, Stories, Create modal, Karaoke Video tab');
console.log('');
