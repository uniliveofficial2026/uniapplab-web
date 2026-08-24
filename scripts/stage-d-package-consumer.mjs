#!/usr/bin/env node
/**
 * Clean temporary consumer outside monorepo.
 * Packs public packages, extracts into an isolated node_modules tree
 * (no workspace linker), then imports representative packages.
 */
import { execSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  writeFileSync,
  readdirSync,
  rmSync,
  copyFileSync,
  readFileSync,
  cpSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ART = join(ROOT, 'release', 'artifacts');

const CLOSED = [
  'unilives-errors',
  'unilives-platform-core',
  'unilives-rtc-contracts',
  'unilives-rtc-core',
  'unilives-rtc-qoe',
  'unilives-rtc-client',
  'unilives-rtc-react',
  'unilives-observe',
  'unilives-sdk',
  'unilives-ui',
  'unilives-project-graph',
  'unilives-provider-sdk',
  'unilives-plugin-sdk',
];

mkdirSync(ART, { recursive: true });
for (const pkg of CLOSED) {
  const cwd = join(ROOT, 'lib', pkg);
  if (!existsSync(join(cwd, 'package.json'))) continue;
  // Drop stale artifacts so pack always refreshes consumer inputs
  for (const f of readdirSync(ART).filter((x) => x.startsWith(`${pkg}-`) && x.endsWith('.tgz'))) {
    rmSync(join(ART, f), { force: true });
  }
  const before = new Set(readdirSync(cwd).filter((f) => f.endsWith('.tgz')));
  try {
    execSync('pnpm pack', { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch {
    execSync('npm pack', { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  }
  const tgz = readdirSync(cwd)
    .filter((f) => f.endsWith('.tgz'))
    .find((f) => !before.has(f));
  if (!tgz) throw new Error(`no tarball for ${pkg}`);
  copyFileSync(join(cwd, tgz), join(ART, tgz));
  rmSync(join(cwd, tgz));
}

const consumer = mkdtempSync(join(tmpdir(), 'unilive-consumer-'));
const nm = join(consumer, 'node_modules', '@unilives');
mkdirSync(nm, { recursive: true });

const checksums = {};
for (const f of readdirSync(ART).filter((x) => x.endsWith('.tgz'))) {
  const m = f.match(/^unilives-(.+)-(\d+\.\d+\.\d+)/);
  if (!m) continue;
  const short = m[1];
  if (!CLOSED.includes(`unilives-${short}`)) continue;
  const buf = readFileSync(join(ART, f));
  checksums[`@unilives/${short}`] = `sha256:${createHash('sha256').update(buf).digest('hex')}`;
  const extractRoot = join(consumer, 'extract', short);
  mkdirSync(extractRoot, { recursive: true });
  execSync(`tar -xzf ${join(ART, f)} -C ${extractRoot}`, { stdio: 'pipe' });
  cpSync(join(extractRoot, 'package'), join(nm, short), { recursive: true });
}

writeFileSync(
  join(consumer, 'package.json'),
  JSON.stringify({ name: 'unilive-clean-consumer', private: true, type: 'module' }, null, 2),
);
writeFileSync(
  join(consumer, 'index.mjs'),
  `
import { createUniLive, PLATFORM_VERSION } from '@unilives/sdk';
import { ValidationError } from '@unilives/errors';
import { createEmptyProjectGraph } from '@unilives/project-graph';
import { createUniLiveRTC } from '@unilives/rtc-client';
import { validateProviderManifest, createTestRtcProviderAdapter } from '@unilives/provider-sdk';
import { validatePluginManifest, createExampleButtonPlugin } from '@unilives/plugin-sdk';

const graph = createEmptyProjectGraph({ projectId: 'project_consumer', name: 'c' });
const sdk = createUniLive({ projectId: 'project_consumer', environment: 'local' });
const plugin = createExampleButtonPlugin();
validatePluginManifest(plugin.manifest || plugin);

console.log(JSON.stringify({
  ok: true,
  PLATFORM_VERSION,
  graph: Boolean(graph),
  sdk: Boolean(sdk),
  rtc: typeof createUniLiveRTC === 'function',
  providerAdapter: Boolean(createTestRtcProviderAdapter()),
  providerValidate: typeof validateProviderManifest === 'function',
  pluginOk: true,
  err: ValidationError.name,
  resolution: 'isolated-node_modules-from-tarballs',
}));
`,
);

try {
  const out = execSync('node index.mjs', { cwd: consumer, encoding: 'utf8' });
  console.log(out.trim());
  const parsed = JSON.parse(out);
  if (!parsed.ok) process.exit(1);
  console.log(
    JSON.stringify({
      ok: true,
      suite: 'stage-d-package-consumer',
      packages: Object.keys(checksums).length,
      checksumsSample: Object.fromEntries(Object.entries(checksums).slice(0, 3)),
    }),
  );
  console.log('Stage D package consumer PASS');
} catch (err) {
  console.error(err.stdout?.toString?.() || '');
  console.error(err.stderr?.toString?.() || err.message);
  process.exit(1);
} finally {
  rmSync(consumer, { recursive: true, force: true });
}
