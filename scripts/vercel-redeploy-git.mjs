#!/usr/bin/env node
/**
 * Trigger a production deploy from GitHub (no local upload).
 * Usage: export VERCEL_TOKEN=… && pnpm run vercel:redeploy-git
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isRateLimitError, requireVercelToken } from './lib/vercel-token.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REF = process.env.VERCEL_GIT_REF || 'main';
const REPO = process.env.VERCEL_GIT_REPO || 'uniapplab-web';
const ORG = process.env.VERCEL_GIT_ORG || 'uniliveofficial2026';

function readProject() {
  const file = path.join(ROOT, '.vercel/project.json');
  if (!fs.existsSync(file)) {
    console.error('[vercel] Missing .vercel/project.json');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const token = requireVercelToken();
const project = readProject();
const teamId = project.orgId;

console.log(`[vercel] Triggering git deploy: ${ORG}/${REPO}@${REF}`);

const res = await fetch(`https://api.vercel.com/v13/deployments?teamId=${teamId}`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: project.projectName,
    project: project.projectId,
    target: 'production',
    gitSource: { type: 'github', org: ORG, repo: REPO, ref: REF },
  }),
});

const json = await res.json().catch(() => ({}));
if (!res.ok) {
  const msg = json.error?.message || JSON.stringify(json).slice(0, 400);
  console.error('[vercel] Deploy failed:', res.status, msg);
  if (isRateLimitError(msg)) {
    console.error('');
    console.error('[vercel] Vercel free tier: 100 deploys/day — quota exhausted.');
    console.error('[vercel] Nothing else to run until it resets (~24h) or you upgrade:');
    console.error('[vercel]   https://vercel.com/uniliveofficial2026s-projects?upgradeToPro=build-rate-limit');
    console.error('');
    console.error('[vercel] Stop live-sync from burning more deploys:');
    console.error('[vercel]   pkill -f live-sync.mjs   # if running');
    console.error('[vercel]   LIVE_SYNC_DEPLOY=0 pnpm run live');
  }
  process.exit(1);
}

const url = json.url ? `https://${json.url}` : json.inspectorUrl;
console.log('[vercel] ✓ Deployment queued');
console.log(`[vercel]   id:  ${json.id}`);
if (url) console.log(`[vercel]   url: ${url}`);
console.log('[vercel] Verify: curl -s https://app.uniapplab.com/api/healthz');
