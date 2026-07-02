#!/usr/bin/env node
/**
 * Sync Vercel project to artifacts/instacollab + API staging (recommended production setup).
 * Usage: export VERCEL_TOKEN=… && pnpm run vercel:fix-settings
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readVercelToken } from './lib/vercel-token.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SUBFOLDER = 'artifacts/instacollab';

function readProjectMeta() {
  const projectFile = path.join(ROOT, '.vercel/project.json');
  if (!fs.existsSync(projectFile)) return null;
  try {
    return JSON.parse(fs.readFileSync(projectFile, 'utf8'));
  } catch {
    return null;
  }
}

function readSubfolderVercel() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, SUBFOLDER, 'vercel.json'), 'utf8'));
}

const token = readVercelToken();
if (!token) {
  console.error('[vercel] Set VERCEL_TOKEN — https://vercel.com/account/tokens');
  process.exit(1);
}

const project = readProjectMeta();
if (!project?.projectId) {
  console.error('[vercel] No .vercel/project.json');
  process.exit(1);
}

const sub = readSubfolderVercel();
const body = {
  rootDirectory: SUBFOLDER,
  installCommand: sub.installCommand,
  buildCommand: sub.buildCommand,
  outputDirectory: sub.outputDirectory,
  framework: 'vite',
};

const url = `https://api.vercel.com/v9/projects/${project.projectId}?teamId=${project.orgId}`;
const res = await fetch(url, {
  method: 'PATCH',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});
const json = await res.json().catch(() => ({}));

if (!res.ok) {
  console.error('[vercel] PATCH failed:', res.status, json.error?.message || '');
  process.exit(1);
}

const projectFile = path.join(ROOT, '.vercel/project.json');
const meta = readProjectMeta();
meta.settings = { ...meta.settings, ...body };
fs.writeFileSync(projectFile, `${JSON.stringify(meta, null, 2)}\n`);

console.log('[vercel] ✓ Project settings synced');
console.log(`[vercel]   root: ${SUBFOLDER}`);
console.log(`[vercel]   install: ${body.installCommand}`);
console.log('');
console.log('[vercel] When deploy quota resets: pnpm run vercel:redeploy-git');
