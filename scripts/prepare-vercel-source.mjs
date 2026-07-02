#!/usr/bin/env node
/**
 * Stage a minimal monorepo tree for Vercel remote builds.
 * Includes api-server + shared lib packages so /api/* routes work in production.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeVercelConfig } from './sync-vercel-config.mjs';

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

const STAGING_PACKAGES = [
  'artifacts/instacollab',
  'artifacts/api-server',
  'lib/api-zod',
  'lib/db',
  'lib/upstash',
  'lib/livekit',
];

function shouldSkip(name, relPath = '') {
  if (SKIP_NAMES.has(name)) return true;
  if (name.startsWith('._')) return true;
  if (name.endsWith('.map')) return true;
  if (relPath.includes('public/deepar-resources')) return true;
  if (relPath.includes('public/effects/')) return true;
  return false;
}

function copyTree(src, dest, relBase = '') {
  if (!fs.existsSync(src)) return;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      const rel = relBase ? `${relBase}/${entry}` : entry;
      if (shouldSkip(entry, rel)) continue;
      copyTree(path.join(src, entry), path.join(dest, entry), rel);
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
  const pkgLines = STAGING_PACKAGES.map((p) => `  - ${p}`).join('\n');
  const trimmed = `packages:
${pkgLines}

${catalog}`;
  fs.writeFileSync(path.join(STAGING, 'pnpm-workspace.yaml'), trimmed);
}

function writeStagingVercelConfig() {
  writeVercelConfig(STAGING);
}

function main() {
  fs.rmSync(STAGING, { recursive: true, force: true });
  fs.mkdirSync(STAGING, { recursive: true });

  for (const file of ['package.json', 'pnpm-lock.yaml', '.npmrc']) {
    copyTree(path.join(ROOT, file), path.join(STAGING, file));
  }

  writeTrimmedWorkspace();
  writeStagingVercelConfig();
  copyTree(path.join(ROOT, 'config'), path.join(STAGING, 'config'));

  const scriptsDest = path.join(STAGING, 'scripts');
  fs.mkdirSync(scriptsDest, { recursive: true });
  for (const script of [
    'write-live-version.mjs',
    'ensure-live.mjs',
    'vercel-project-name.mjs',
    'prepare-vercel-source.mjs',
  ]) {
    copyTree(path.join(ROOT, 'scripts', script), path.join(scriptsDest, script));
  }

  const vendorArchives = path.join(ROOT, 'artifacts', 'instacollab', 'vendor', 'archives');
  if (!fs.existsSync(path.join(vendorArchives, 'DeepAR-Web-v5.6.22.zip'))) {
    console.warn(
      '[deploy] Warning: vendor/archives/DeepAR-Web-v5.6.22.zip missing — run pnpm --filter @workspace/instacollab run deepar:install',
    );
  }

  for (const pkg of STAGING_PACKAGES) {
    copyTree(path.join(ROOT, pkg), path.join(STAGING, pkg), pkg);
  }

  for (const envName of ['.env', '.env.local', '.env.production', '.env.production.local']) {
    fs.rmSync(path.join(STAGING, 'artifacts', 'instacollab', envName), { force: true });
    fs.rmSync(path.join(STAGING, 'artifacts', 'api-server', envName), { force: true });
  }

  const projectJson = path.join(ROOT, '.vercel', 'project.json');
  if (fs.existsSync(projectJson)) {
    const linkDir = path.join(STAGING, '.vercel');
    fs.mkdirSync(linkDir, { recursive: true });
    fs.copyFileSync(projectJson, path.join(linkDir, 'project.json'));
  }

  console.log(`[deploy] Staged remote build source → ${path.relative(ROOT, STAGING)}`);
  console.log(`[deploy] Packages: ${STAGING_PACKAGES.join(', ')}`);
}

main();
