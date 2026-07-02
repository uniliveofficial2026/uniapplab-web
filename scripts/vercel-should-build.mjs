#!/usr/bin/env node
/**
 * Vercel ignoreCommand — exit 0 = skip deployment, exit 1 = build.
 * Stops duplicate API projects from burning the free-tier deploy quota (rate limits).
 */
import { execSync } from 'node:child_process';

const project = process.env.VERCEL_PROJECT_NAME || '';

/** Monorepo `uniapplab-web-instacollab` already ships SPA + /api — these duplicate projects cause 3x CI failures. */
const SUPERSEDED_PROJECTS = ['uniapplab-web-api-server-f7ca', 'uniapplab-web-api-server'];

if (SUPERSEDED_PROJECTS.some((name) => project === name || project.includes(name))) {
  console.log(`[vercel] skip — ${project} superseded by uniapplab-web-instacollab monorepo`);
  process.exit(0);
}

if (process.env.VERCEL_ENV === 'production') {
  process.exit(1);
}

const RUNTIME_PREFIXES = [
  'artifacts/instacollab/',
  'artifacts/api-server/',
  'lib/',
  'vercel.json',
  'vercel.monorepo.json',
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
];

function changedFiles() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  const prev = process.env.VERCEL_GIT_PREVIOUS_SHA;
  if (sha && prev) {
    try {
      return execSync(`git diff --name-only ${prev} ${sha}`, { encoding: 'utf8' })
        .trim()
        .split('\n')
        .filter(Boolean);
    } catch {
      /* fall through */
    }
  }
  try {
    return execSync('git diff --name-only HEAD~1 HEAD', { encoding: 'utf8' })
      .trim()
      .split('\n')
      .filter(Boolean);
  } catch {
    return [];
  }
}

const changed = changedFiles();
if (changed.length > 0) {
  const needsBuild = changed.some((file) =>
    RUNTIME_PREFIXES.some((prefix) => file === prefix.replace(/\/$/, '') || file.startsWith(prefix)),
  );
  if (!needsBuild) {
    console.log('[vercel] skip preview — no runtime paths changed:', changed.slice(0, 5).join(', '));
    process.exit(0);
  }
}

process.exit(1);
