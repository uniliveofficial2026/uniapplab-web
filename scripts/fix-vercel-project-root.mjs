#!/usr/bin/env node
/**
 * Set Vercel project Root Directory to repo root so monorepo vercel.json routes /api/* work.
 * Usage: pnpm run vercel:fix-root
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildVercelConfig } from './sync-vercel-config.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readVercelToken() {
  if (process.env.VERCEL_TOKEN?.trim()) return process.env.VERCEL_TOKEN.trim();
  const candidates = [
    path.join(os.homedir(), '.local/share/com.vercel.cli/auth.json'),
    path.join(os.homedir(), '.config/com.vercel.cli/auth.json'),
  ];
  for (const authPath of candidates) {
    if (!fs.existsSync(authPath)) continue;
    try {
      const auth = JSON.parse(fs.readFileSync(authPath, 'utf8'));
      if (auth.token?.trim()) return auth.token.trim();
    } catch {
      /* try next */
    }
  }
  return null;
}

function readProjectMeta() {
  const projectFile = path.join(ROOT, '.vercel/project.json');
  if (!fs.existsSync(projectFile)) return null;
  try {
    return JSON.parse(fs.readFileSync(projectFile, 'utf8'));
  } catch {
    return null;
  }
}

const token = readVercelToken();
const project = readProjectMeta();
if (!token) {
  console.error('[vercel] Not logged in — run: pnpm dlx vercel@latest login');
  process.exit(1);
}
if (!project?.projectId) {
  console.error('[vercel] No .vercel/project.json — run: pnpm dlx vercel@latest link');
  process.exit(1);
}

const monorepo = buildVercelConfig();

const body = {
  rootDirectory: null,
  installCommand: monorepo.installCommand || 'pnpm install && pnpm --filter @workspace/api-server run build',
  buildCommand: 'pnpm --filter @workspace/instacollab run build',
  outputDirectory: null,
  framework: null,
};

const teamId = project.orgId;
const url = `https://api.vercel.com/v9/projects/${project.projectId}?teamId=${teamId}`;

const res = await fetch(url, {
  method: 'PATCH',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(body),
});

const json = await res.json().catch(() => ({}));
if (!res.ok) {
  console.error('[vercel] PATCH project failed:', res.status, json.error?.message || JSON.stringify(json).slice(0, 300));
  process.exit(1);
}

writeVercelConfigLocal();
console.log('[vercel] ✓ Root Directory set to repo root (monorepo)');
console.log(`[vercel]   project: ${project.projectName || json.name}`);
console.log(`[vercel]   install: ${body.installCommand}`);
console.log('[vercel] Redeploy: merge PR to main or run pnpm run deploy:vercel:git from a PR branch');

function writeVercelConfigLocal() {
  const out = path.join(ROOT, 'vercel.json');
  fs.writeFileSync(out, `${JSON.stringify(monorepo, null, 2)}\n`);
}
