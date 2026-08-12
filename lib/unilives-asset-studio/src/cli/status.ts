#!/usr/bin/env tsx
import { existsSync, readFileSync } from 'node:fs';
import { loadEnvLocal, getSafetyConfig } from '../config/env.js';
import { printProviderStatuses } from '../config/providerStatus.js';
import { jobsIndexPath } from '../pipeline/outputWriter.js';
import type { AssetJobRecord } from '../types/jobs.js';

loadEnvLocal();
console.log('UniLive’s Asset Studio status');
printProviderStatuses();
const safety = getSafetyConfig();
console.log(`dryRun=${safety.dryRun} maxPaidCalls=${safety.maxPaidCalls}`);

const path = jobsIndexPath();
if (!existsSync(path)) {
  console.log('jobs: none');
  process.exit(0);
}
const jobs = JSON.parse(readFileSync(path, 'utf8')) as AssetJobRecord[];
console.log(`jobs: ${jobs.length}`);
for (const j of jobs.slice(-20)) {
  console.log(
    `- ${j.canonicalId} ${j.phase} ${j.version} provider=${j.provider} dryRun=${j.dryRun}` +
      (j.blockedReason ? ` blocked=${j.blockedReason}` : ''),
  );
}
