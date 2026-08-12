#!/usr/bin/env tsx
import { loadEnvLocal } from '../config/env.js';
import { approveAssetPreview } from '../pipeline/assetPipeline.js';
import { parseArgs, requireFlag } from './args.js';

loadEnvLocal();
const { flags } = parseArgs(process.argv);
const id = requireFlag(flags, 'id');
const version = requireFlag(flags, 'version');
const job = approveAssetPreview(id, version);
console.log(JSON.stringify({
  ok: true,
  message: 'Preview approval recorded — not production-approved, not deployed',
  canonicalId: job.canonicalId,
  version: job.version,
  phase: job.phase,
}, null, 2));
