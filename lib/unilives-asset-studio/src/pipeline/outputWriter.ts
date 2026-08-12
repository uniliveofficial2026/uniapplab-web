import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from '../config/env.js';
import type { AssetJobRecord } from '../types/jobs.js';

export function draftRootFor(canonicalId: string, version: string): string {
  const safe = canonicalId.replace(/[^a-zA-Z0-9._-]+/g, '_');
  return join(
    REPO_ROOT,
    'production/unilives-assets/previews/drafts',
    safe,
    version,
  );
}

export function ensureDraftDir(canonicalId: string, version: string): string {
  const dir = draftRootFor(canonicalId, version);
  mkdirSync(dir, { recursive: true });
  mkdirSync(join(dir, 'masters'), { recursive: true });
  mkdirSync(join(dir, 'runtime'), { recursive: true });
  mkdirSync(join(dir, 'audio'), { recursive: true });
  mkdirSync(join(dir, 'previews'), { recursive: true });
  return dir;
}

export function writeJobMetadata(job: AssetJobRecord): string {
  const dir = ensureDraftDir(job.canonicalId, job.version);
  const path = join(dir, 'job.json');
  // Never include API keys or raw secret env in metadata
  writeFileSync(path, JSON.stringify(job, null, 2) + '\n');
  return path;
}

export function sha256File(path: string): string | null {
  if (!existsSync(path)) return null;
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

export function jobsIndexPath(): string {
  return join(REPO_ROOT, 'production/unilives-assets/previews/drafts/jobs-index.json');
}

export function appendJobIndex(job: AssetJobRecord): void {
  const path = jobsIndexPath();
  mkdirSync(join(REPO_ROOT, 'production/unilives-assets/previews/drafts'), { recursive: true });
  let list: AssetJobRecord[] = [];
  if (existsSync(path)) {
    try {
      list = JSON.parse(readFileSync(path, 'utf8')) as AssetJobRecord[];
    } catch {
      list = [];
    }
  }
  list = list.filter((j) => j.jobId !== job.jobId);
  list.push(job);
  writeFileSync(path, JSON.stringify(list, null, 2) + '\n');
}
