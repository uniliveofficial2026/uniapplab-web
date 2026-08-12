#!/usr/bin/env tsx
import { loadEnvLocal, getSafetyConfig } from '../config/env.js';
import { previewAsset } from '../pipeline/assetPipeline.js';
import type { AssetStudioProvider } from '../types/assets.js';
import { parseArgs, requireFlag } from './args.js';

loadEnvLocal();
const { flags } = parseArgs(process.argv);
const id = requireFlag(flags, 'id');
const provider = (requireFlag(flags, 'provider') as AssetStudioProvider);
const safety = getSafetyConfig();
console.log(`dryRun=${safety.dryRun} maxPaidCalls=${safety.maxPaidCalls}`);
const job = previewAsset(id, provider);
console.log(JSON.stringify({
  ok: true,
  paidProviderCalled: false, // dry-run path never calls; paid path throws until explicitly enabled
  jobId: job.jobId,
  canonicalId: job.canonicalId,
  phase: job.phase,
  version: job.version,
  provider: job.provider,
  draftDir: job.draftDir,
  blockedReason: job.blockedReason ?? null,
  notes: job.notes,
}, null, 2));
