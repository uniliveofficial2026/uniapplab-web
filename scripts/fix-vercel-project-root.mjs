#!/usr/bin/env node
/**
 * Fix production /api/* 404:
 * 1) Set Vercel Root Directory to repo root (VERCEL_TOKEN)
 * 2) Optionally deploy (--deploy) or git-redeploy (--git)
 * Usage: pnpm run vercel:fix-root [-- --deploy | --git]
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildVercelConfig } from './sync-vercel-config.mjs';
import { readVercelToken } from './lib/vercel-token.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2).filter((a) => a !== '--');
const wantDeploy = args.includes('--deploy');
const wantGit = args.includes('--git');

function readProjectMeta() {
  const projectFile = path.join(ROOT, '.vercel/project.json');
  if (!fs.existsSync(projectFile)) return null;
  try {
    return JSON.parse(fs.readFileSync(projectFile, 'utf8'));
  } catch {
    return null;
  }
}

function syncLocalProjectJson(patch) {
  const projectFile = path.join(ROOT, '.vercel/project.json');
  const meta = readProjectMeta();
  if (!meta) return;
  meta.settings = { ...meta.settings, ...patch };
  fs.writeFileSync(projectFile, `${JSON.stringify(meta, null, 2)}\n`);
}

function writeVercelConfigLocal() {
  const monorepo = buildVercelConfig();
  fs.writeFileSync(path.join(ROOT, 'vercel.json'), `${JSON.stringify(monorepo, null, 2)}\n`);
}

function deployViaCli() {
  console.log('[vercel] Deploying monorepo via CLI…');
  const r = spawnSync('bash', ['scripts/vercel-deploy-api.sh'], { cwd: ROOT, stdio: 'inherit' });
  return r.status ?? 1;
}

function redeployViaGit() {
  const token = readVercelToken();
  if (token) process.env.VERCEL_TOKEN = token;
  const r = spawnSync('node', ['scripts/vercel-redeploy-git.mjs'], {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
  });
  return r.status ?? 1;
}

const project = readProjectMeta();
if (!project?.projectId) {
  console.error('[vercel] No .vercel/project.json — run: pnpm dlx vercel@latest link');
  process.exit(1);
}

writeVercelConfigLocal();

const token = readVercelToken();
const monorepo = buildVercelConfig();
const body = {
  rootDirectory: null,
  installCommand: monorepo.installCommand || 'pnpm install && pnpm --filter @workspace/api-server run build',
  buildCommand: 'pnpm --filter @workspace/instacollab run build',
  outputDirectory: null,
  framework: null,
};

let apiOk = false;
if (token) {
  const url = `https://api.vercel.com/v9/projects/${project.projectId}?teamId=${project.orgId}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (res.ok) {
    apiOk = true;
    syncLocalProjectJson({
      rootDirectory: null,
      installCommand: body.installCommand,
      buildCommand: body.buildCommand,
      outputDirectory: null,
      framework: null,
    });
    console.log('[vercel] ✓ Root Directory set to repo root');
    console.log(`[vercel]   project: ${project.projectName || json.name}`);
  } else if (res.status === 403) {
    console.warn('[vercel] ⚠ API 403 — token lacks team access');
  } else {
    console.warn('[vercel] ⚠ API PATCH failed:', res.status, json.error?.message || '');
  }
} else {
  console.log('[vercel] No VERCEL_TOKEN — skipping project settings PATCH');
}

if (!wantDeploy && !wantGit) {
  if (apiOk) {
    console.log('');
    console.log('[vercel] Settings updated. Deploy when rate limit clears:');
    console.log('  pnpm run vercel:fix-root -- --git     # git remote build (recommended)');
    console.log('  pnpm run vercel:fix-root -- --deploy  # CLI upload (908MB, often rate-limited)');
    console.log('  Or: Vercel dashboard → Deployments → Redeploy Production');
    process.exit(0);
  }
  console.error('[vercel] Settings not updated — set VERCEL_TOKEN and retry');
  process.exit(1);
}

if (wantGit) {
  const status = redeployViaGit();
  process.exit(status === 0 ? 0 : status);
}

const deployStatus = deployViaCli();
if (deployStatus === 0) {
  console.log('[vercel] Verify: curl -s https://app.uniapplab.com/api/healthz');
  process.exit(0);
}

if (deployStatus === 2) {
  console.log('');
  console.log('[vercel] CLI rate-limited. Try git deploy instead:');
  console.log('  pnpm run vercel:fix-root -- --git');
  process.exit(2);
}

process.exit(deployStatus || 1);
