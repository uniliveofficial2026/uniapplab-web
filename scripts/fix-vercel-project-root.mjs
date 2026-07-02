#!/usr/bin/env node
/**
 * Fix production /api/* 404:
 * 1) Try Vercel API to clear Root Directory (needs team-scoped VERCEL_TOKEN)
 * 2) Fall back to CLI monorepo deploy (uses `vercel login` session)
 * Usage: pnpm run vercel:fix-root
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildVercelConfig } from './sync-vercel-config.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

if (process.env.VERCEL_TOKEN && /your_token|placeholder|xxxx|example/i.test(process.env.VERCEL_TOKEN)) {
  console.warn('[vercel] Ignoring placeholder VERCEL_TOKEN — use a real token or `vercel login`');
  delete process.env.VERCEL_TOKEN;
}

function readVercelToken() {
  if (process.env.VERCEL_TOKEN?.trim()) return process.env.VERCEL_TOKEN.trim();

  const authNames = ['auth.json', 'config.json'];
  const dirs = [
    process.env.VERCEL_CONFIG_DIR,
    path.join(os.homedir(), '.local/share/com.vercel.cli'),
    path.join(os.homedir(), '.config/com.vercel.cli'),
    path.join(os.homedir(), 'Library', 'Application Support', 'com.vercel.cli'),
    path.join(os.homedir(), 'Library', 'Preferences', 'com.vercel.cli'),
    path.join(os.homedir(), '.vercel'),
  ].filter(Boolean);

  for (const dir of dirs) {
    for (const name of authNames) {
      const authPath = path.join(dir, name);
      if (!fs.existsSync(authPath)) continue;
      try {
        const auth = JSON.parse(fs.readFileSync(authPath, 'utf8'));
        const token = auth.token?.trim() || auth.credentials?.[0]?.token?.trim();
        if (token) return token;
      } catch {
        /* try next */
      }
    }
  }
  return null;
}

function readMacKeychainToken() {
  if (process.platform !== 'darwin') return null;
  for (const service of ['Vercel CLI', 'vercel', 'com.vercel.cli']) {
    const result = spawnSync('security', ['find-generic-password', '-s', service, '-w'], {
      encoding: 'utf8',
    });
    const token = result.stdout?.trim();
    if (result.status === 0 && token) return token;
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

function writeVercelConfigLocal() {
  const monorepo = buildVercelConfig();
  fs.writeFileSync(path.join(ROOT, 'vercel.json'), `${JSON.stringify(monorepo, null, 2)}\n`);
}

function deployViaCli() {
  console.log('[vercel] Deploying monorepo via CLI (vercel login session)…');
  const r = spawnSync('bash', ['scripts/vercel-deploy-api.sh'], {
    cwd: ROOT,
    stdio: 'inherit',
  });
  return r.status ?? 1;
}

function printDashboardFix() {
  console.log('');
  console.log('Dashboard fix (for Git deploys):');
  console.log('  pnpm run vercel:open-settings');
  console.log('  Root Directory → EMPTY');
  console.log('  Install: pnpm install && pnpm --filter @workspace/api-server run build');
  console.log('  Build:   pnpm --filter @workspace/instacollab run build');
  console.log('  Save → Redeploy Production');
}

const project = readProjectMeta();
if (!project?.projectId) {
  console.error('[vercel] No .vercel/project.json — run: pnpm dlx vercel@latest link');
  process.exit(1);
}

writeVercelConfigLocal();

const token = readVercelToken() || readMacKeychainToken();
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
  if (res.ok) {
    apiOk = true;
    console.log('[vercel] ✓ Root Directory set to repo root via API');
    console.log(`[vercel]   project: ${project.projectName || json.name}`);
  } else if (res.status === 403) {
    console.warn('[vercel] ⚠ API 403 — token lacks team access for', project.projectName);
    console.warn('[vercel]   Create token at https://vercel.com/account/tokens');
    console.warn('[vercel]   Scope: Full Account (or team uniliveofficial2026s-projects)');
    console.warn('[vercel]   export VERCEL_TOKEN=… && pnpm run vercel:fix-root');
  } else {
    console.warn('[vercel] ⚠ API PATCH failed:', res.status, json.error?.message || '');
  }
} else {
  console.log('[vercel] No API token — using CLI deploy (run: pnpm dlx vercel@latest login)');
}

const deployStatus = deployViaCli();
if (deployStatus === 0) {
  console.log('[vercel] Verify: curl -s https://app.uniapplab.com/api/healthz');
  process.exit(0);
}

if (deployStatus === 2) {
  printDashboardFix();
  process.exit(2);
}

if (!apiOk) printDashboardFix();
process.exit(deployStatus || 1);
