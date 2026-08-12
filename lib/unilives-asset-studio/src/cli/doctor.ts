#!/usr/bin/env tsx
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ENV_LOCAL_PATH, REPO_ROOT, getSafetyConfig, loadEnvLocal } from '../config/env.js';
import { printProviderStatuses } from '../config/providerStatus.js';
import { MANIFEST_PATH } from '../pipeline/manifestUpdater.js';
import { blenderDoctor } from '../providers/blender.js';
import { ffmpegDoctor } from '../providers/ffmpeg.js';
import { validateSecrets } from '../validation/validateSecrets.js';
import { validateManifest } from '../validation/validateManifest.js';

loadEnvLocal();
console.log('UniLive’s Asset Studio doctor');
console.log(`repo: ${REPO_ROOT}`);
console.log(`.env.local: ${existsSync(ENV_LOCAL_PATH) ? 'present' : 'MISSING'}`);
console.log(`manifest: ${existsSync(MANIFEST_PATH) ? 'present' : 'MISSING'}`);

const folders = [
  'production/unilives-assets',
  'production/unilives-assets/masters',
  'production/unilives-assets/previews',
  'production/unilives-assets/references',
  'artifacts/instacollab/public/unilives-assets',
  'docs/unilives-assets',
];
for (const f of folders) {
  console.log(`folder ${f}: ${existsSync(join(REPO_ROOT, f)) ? 'ok' : 'missing'}`);
}

console.log('--- providers (names only) ---');
printProviderStatuses();

const safety = getSafetyConfig();
console.log('--- safety ---');
console.log(`ASSET_STUDIO_DRY_RUN: ${safety.dryRun}`);
console.log(`ASSET_STUDIO_MAX_PAID_CALLS: ${safety.maxPaidCalls}`);
console.log(`ASSET_STUDIO_AUTO_RETRY: ${safety.autoRetry}`);
console.log(`ASSET_STUDIO_REQUIRE_APPROVAL: ${safety.requireApproval}`);
console.log(`OPENAI_IMAGE_MODEL: ${safety.openaiImageModel}`);

const b = blenderDoctor();
const f = ffmpegDoctor();
console.log(`blender: ${b.ok ? 'ok' : 'missing'}${b.version ? ` (${b.version})` : ''}`);
console.log(`ffmpeg: ${f.ok ? 'ok' : 'missing'}${f.version ? ` (${f.version})` : ''}`);

const secrets = validateSecrets();
const manifest = validateManifest();
console.log('--- checks ---');
console.log(`secrets: ${secrets.ok ? 'ok' : 'FAIL'}`);
for (const i of secrets.issues) console.log(`  - ${i}`);
console.log(`manifest: ${manifest.ok ? 'ok' : 'FAIL'}`);
for (const i of manifest.issues) console.log(`  - ${i}`);

process.exit(secrets.ok && manifest.ok ? 0 : 1);
