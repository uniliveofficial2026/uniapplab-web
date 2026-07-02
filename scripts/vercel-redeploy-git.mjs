#!/usr/bin/env node
/**
 * Trigger a production deploy from GitHub (no local upload — avoids CLI api-upload limit).
 * Usage: pnpm run vercel:redeploy-git
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REF = process.env.VERCEL_GIT_REF || 'main';
const REPO = process.env.VERCEL_GIT_REPO || 'uniapplab-web';
const ORG = process.env.VERCEL_GIT_ORG || 'uniliveofficial2026';

function readToken() {
  const token = process.env.VERCEL_TOKEN?.trim();
  if (!token) {
    console.error('[vercel] Set VERCEL_TOKEN — https://vercel.com/account/tokens');
    process.exit(1);
  }
  return token;
}

function readProject() {
  const file = path.join(ROOT, '.vercel/project.json');
  if (!fs.existsSync(file)) {
    console.error('[vercel] Missing .vercel/project.json');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const token = readToken();
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
    gitSource: {
      type: 'github',
      org: ORG,
      repo: REPO,
      ref: REF,
    },
  }),
});

const json = await res.json().catch(() => ({}));
if (!res.ok) {
  const msg = json.error?.message || JSON.stringify(json).slice(0, 400);
  console.error('[vercel] Deploy failed:', res.status, msg);
  if (/rate|limited|100/i.test(msg)) {
    console.error('[vercel] Daily deploy limit reached — retry in ~24h or upgrade Vercel plan.');
  }
  process.exit(1);
}

const url = json.url ? `https://${json.url}` : json.inspectorUrl;
console.log('[vercel] ✓ Deployment queued');
console.log(`[vercel]   id:  ${json.id}`);
if (url) console.log(`[vercel]   url: ${url}`);
console.log('[vercel] Verify when ready: curl -s https://app.uniapplab.com/api/healthz');
