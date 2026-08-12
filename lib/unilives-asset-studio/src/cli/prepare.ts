#!/usr/bin/env tsx
import { loadEnvLocal } from '../config/env.js';
import { prepareAsset } from '../pipeline/assetPipeline.js';
import { parseArgs, requireFlag } from './args.js';

loadEnvLocal();
const { flags } = parseArgs(process.argv);
const id = requireFlag(flags, 'id');
const job = prepareAsset(id);
console.log(JSON.stringify({
  ok: job.phase !== 'blocked',
  jobId: job.jobId,
  canonicalId: job.canonicalId,
  phase: job.phase,
  version: job.version,
  draftDir: job.draftDir,
  referenceCount: job.referencePaths.length,
  blockedReason: job.blockedReason ?? null,
  notes: job.notes,
}, null, 2));
process.exit(job.phase === 'blocked' ? 2 : 0);
