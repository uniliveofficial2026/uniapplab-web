#!/usr/bin/env node
/**
 * Stage a minimal monorepo tree for Vercel remote builds.
 * Strips macOS AppleDouble (._*) files that inflate upload file counts.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STAGING = path.join(ROOT, '.vercel', 'source-staging');

const SKIP_NAMES = new Set([
  'node_modules',
  'dist',
  '.git',
  '.vercel',
  '.tmp',
  '.local',
  '.DS_Store',
]);

function shouldSkip(name) {
  if (SKIP_NAMES.has(name)) return true;
  if (name.startsWith('._')) return true;
  if (name.endsWith('.map')) return true;
  return false;
}

function copyTree(src, dest) {
  if (!fs.existsSync(src)) return;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      if (shouldSkip(entry)) continue;
      copyTree(path.join(src, entry), path.join(dest, entry));
    }
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function writeTrimmedWorkspace() {
  const raw = fs.readFileSync(path.join(ROOT, 'pnpm-workspace.yaml'), 'utf8');
  const catalogStart = raw.indexOf('catalog:');
  const catalog = catalogStart >= 0 ? raw.slice(catalogStart) : '';
  const trimmed = `packages:
  - artifacts/instacollab

${catalog}`;
  fs.writeFileSync(path.join(STAGING, 'pnpm-workspace.yaml'), trimmed);
}

function main() {
  fs.rmSync(STAGING, { recursive: true, force: true });
  fs.mkdirSync(STAGING, { recursive: true });

  for (const file of ['package.json', 'pnpm-lock.yaml', '.npmrc']) {
    copyTree(path.join(ROOT, file), path.join(STAGING, file));
  }

  writeTrimmedWorkspace();
  copyTree(path.join(ROOT, 'config'), path.join(STAGING, 'config'));

  const scriptsDest = path.join(STAGING, 'scripts');
  fs.mkdirSync(scriptsDest, { recursive: true });
  for (const script of ['write-live-version.mjs', 'ensure-live.mjs']) {
    copyTree(path.join(ROOT, 'scripts', script), path.join(scriptsDest, script));
  }

  copyTree(
    path.join(ROOT, 'artifacts', 'instacollab'),
    path.join(STAGING, 'artifacts', 'instacollab'),
  );

  // Never upload local secrets — Vercel uses dashboard env vars.
  for (const envName of ['.env', '.env.local', '.env.production', '.env.production.local']) {
    const envPath = path.join(STAGING, 'artifacts', 'instacollab', envName);
    fs.rmSync(envPath, { force: true });
  }

  const projectJson = path.join(ROOT, '.vercel', 'project.json');
  if (fs.existsSync(projectJson)) {
    const linkDir = path.join(STAGING, '.vercel');
    fs.mkdirSync(linkDir, { recursive: true });
    fs.copyFileSync(projectJson, path.join(linkDir, 'project.json'));
  }

  console.log(`[deploy] Staged remote build source → ${path.relative(ROOT, STAGING)}`);
}

main();
