#!/usr/bin/env node
/**
 * Set Vercel project Root Directory to repo root so monorepo vercel.json routes /api/* work.
 * Usage: pnpm run vercel:fix-root
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildVercelConfig } from './sync-vercel-config.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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

function readVercelTokenAll() {
  return readVercelToken() || readMacKeychainToken();
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

const token = readVercelTokenAll();
const project = readProjectMeta();
if (!token) {
  console.error('[vercel] Not logged in — run: pnpm dlx vercel@latest login');
  console.error('[vercel] Or create a token at https://vercel.com/account/tokens then:');
  console.error('[vercel]   export VERCEL_TOKEN=your_token && pnpm run vercel:fix-root');
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
console.log('[vercel] Triggering production redeploy…');

const deployUrl = `https://api.vercel.com/v13/deployments?teamId=${teamId}`;
const deployRes = await fetch(deployUrl, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: project.projectName || json.name,
    project: project.projectId,
    target: 'production',
    gitSource: {
      type: 'github',
      repo: 'uniapplab-web',
      ref: 'main',
      org: 'uniliveofficial2026',
    },
  }),
});

const deployJson = await deployRes.json().catch(() => ({}));
if (deployRes.ok) {
  console.log(`[vercel] ✓ Deploy queued: ${deployJson.url || deployJson.id || 'production'}`);
} else if (/rate|limit/i.test(deployJson.error?.message || '')) {
  console.warn('[vercel] ⚠ Deploy rate-limited — redeploy from Vercel dashboard after root fix');
  console.warn('[vercel]   https://vercel.com/uniliveofficial2026s-projects/uniapplab-web-instacollab');
} else {
  console.warn('[vercel] ⚠ Redeploy manually:', deployJson.error?.message || deployRes.status);
}
console.log('[vercel] Verify: curl -s https://app.uniapplab.com/api/healthz');

function writeVercelConfigLocal() {
  const out = path.join(ROOT, 'vercel.json');
  fs.writeFileSync(out, `${JSON.stringify(monorepo, null, 2)}\n`);
}
