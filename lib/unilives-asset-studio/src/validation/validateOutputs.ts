import { existsSync } from 'node:fs';
import { jobsIndexPath } from '../pipeline/outputWriter.js';
import { readFileSync } from 'node:fs';
import type { AssetJobRecord } from '../types/jobs.js';

export function validateOutputs(): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  const path = jobsIndexPath();
  if (!existsSync(path)) {
    return { ok: true, issues: [] }; // no jobs yet
  }
  const jobs = JSON.parse(readFileSync(path, 'utf8')) as AssetJobRecord[];
  for (const job of jobs) {
    for (const out of job.outputPaths) {
      if (!existsSync(out)) issues.push(`${job.canonicalId}: missing output ${out}`);
    }
  }
  return { ok: issues.length === 0, issues };
}
