#!/usr/bin/env node
/**
 * Build Stage D release-manifest.json + pack checksums for public-ready packages.
 */
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createReleaseArtifactEntry, createReleaseManifest, PLATFORM_VERSION } from '@unilives/release';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'release', 'artifacts');
mkdirSync(OUT, { recursive: true });

const PACKAGES = [
  'unilives-sdk',
  'unilives-cli',
  'unilives-mcp',
  'unilives-ui',
  'unilives-rtc-client',
  'unilives-rtc-react',
  'unilives-project-graph',
  'unilives-provider-sdk',
  'unilives-plugin-sdk',
  'unilives-errors',
  'unilives-observe',
  'unilives-templates',
];

const artifacts = [];

for (const pkg of PACKAGES) {
  const cwd = join(ROOT, 'lib', pkg);
  if (!existsSync(join(cwd, 'package.json'))) continue;
  const before = new Set(readdirSync(cwd).filter((f) => f.endsWith('.tgz')));
  try {
    execSync('pnpm pack', { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch {
    execSync('npm pack', { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  }
  const after = readdirSync(cwd).filter((f) => f.endsWith('.tgz'));
  const tgz = after.find((f) => !before.has(f)) || after[after.length - 1];
  if (!tgz) continue;
  const src = join(cwd, tgz);
  const buf = readFileSync(src);
  const dest = join(OUT, tgz);
  writeFileSync(dest, buf);
  unlinkSync(src);
  const pkgJson = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8'));
  artifacts.push(
    createReleaseArtifactEntry({
      package: pkgJson.name,
      version: pkgJson.version || PLATFORM_VERSION,
      artifact: `release/artifacts/${tgz}`,
      bytes: buf.length,
      content: buf,
      status: 'RELEASE_READY',
    }),
  );
}

const manifest = createReleaseManifest(artifacts);
const manifestPath = join(ROOT, 'release-manifest.json');
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
writeFileSync(join(OUT, 'release-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

console.log(
  JSON.stringify({
    ok: true,
    version: PLATFORM_VERSION,
    artifacts: artifacts.length,
    publicRegistryRelease: manifest.publicRegistryRelease,
    path: manifestPath,
  }),
);
