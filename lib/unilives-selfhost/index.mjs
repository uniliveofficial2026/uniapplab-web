import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile, rm, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ValidationError, NotFoundError } from '@unilives/errors';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const PLATFORM_VERSION = '0.1.0';

export const COMPONENTS = [
  'postgres',
  'auth',
  'realtime',
  'storage',
  'api',
  'mcp',
  'studio',
  'livekit',
  'observability',
];

function placeholder(label) {
  return `CHANGE_ME_${label}_${randomBytes(6).toString('hex')}`;
}

function now() {
  return new Date().toISOString();
}

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate docker-compose content with placeholder secrets only.
 * @param {{ projectName?: string }} [opts]
 */
export async function generateComposeTemplate(opts = {}) {
  const projectName = opts.projectName || 'unilives-selfhost';
  const composePath = join(__dirname, 'compose', 'docker-compose.yml');
  const raw = await readFile(composePath, 'utf8');
  return `# Generated for ${projectName} at ${now()}\n# TLS: terminate with Caddy or another reverse proxy — see README.\n${raw}`;
}

/**
 * @param {{ dataDir: string, projectName?: string, force?: boolean }} input
 */
export async function initSelfHost(input) {
  const dataDir = input.dataDir;
  if (!dataDir) throw new ValidationError('dataDir_required');
  const configPath = join(dataDir, 'config.json');
  if ((await pathExists(configPath)) && !input.force) {
    throw new ValidationError('already_initialized');
  }

  await mkdir(dataDir, { recursive: true });
  await mkdir(join(dataDir, 'data', 'postgres'), { recursive: true });

  const config = {
    version: PLATFORM_VERSION,
    projectName: input.projectName || 'unilives-selfhost',
    initializedAt: now(),
    components: COMPONENTS,
    env: {
      POSTGRES_USER: 'unilives',
      POSTGRES_PASSWORD: placeholder('POSTGRES'),
      POSTGRES_DB: 'unilives',
      JWT_SECRET: placeholder('JWT'),
      STORAGE_ACCESS_KEY: placeholder('STORAGE_KEY'),
      STORAGE_SECRET_KEY: placeholder('STORAGE_SECRET'),
      LIVEKIT_API_KEY: 'devkey',
      LIVEKIT_API_SECRET: placeholder('LIVEKIT'),
      API_PORT: '8080',
      STUDIO_PORT: '3000',
    },
    tls: {
      note: 'Terminate TLS with Caddy or another reverse proxy in front of api/studio/livekit.',
      caddyReference: 'https://caddyserver.com/docs/quick-starts/reverse-proxy',
    },
  };

  const compose = await generateComposeTemplate({ projectName: config.projectName });
  await writeFile(configPath, JSON.stringify(config, null, 2));
  await writeFile(join(dataDir, 'docker-compose.yml'), compose);
  await writeFile(join(dataDir, '.env.example'), renderEnvExample(config.env));

  /** @type {Map<string, unknown>} */
  const store = new Map();
  store.set('users', [{ id: 'user_seed', email: 'owner@example.com' }]);
  await writeFile(join(dataDir, 'data', 'postgres', 'dump.json'), JSON.stringify(Object.fromEntries(store)));

  return { ok: true, dataDir, configPath, components: COMPONENTS };
}

function renderEnvExample(env) {
  return Object.entries(env)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')
    .concat('\n');
}

/**
 * @param {{ dataDir: string, json?: boolean }} input
 */
export async function getSelfHostStatus(input) {
  const configPath = join(input.dataDir, 'config.json');
  if (!(await pathExists(configPath))) {
    throw new NotFoundError('selfhost_not_initialized');
  }
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  const dumpPath = join(input.dataDir, 'data', 'postgres', 'dump.json');
  let records = 0;
  if (await pathExists(dumpPath)) {
    const dump = JSON.parse(await readFile(dumpPath, 'utf8'));
    records = Object.values(dump).reduce((n, table) => n + (Array.isArray(table) ? table.length : 0), 0);
  }

  const status = {
    ok: true,
    version: config.version,
    projectName: config.projectName,
    initializedAt: config.initializedAt,
    components: (config.components || COMPONENTS).map((name) => ({
      name,
      state: 'configured',
    })),
    postgres: { records },
    tls: config.tls,
  };

  if (input.json) return status;

  const lines = [
    `UniLive self-host: ${status.projectName}`,
    `Version: ${status.version}`,
    `Initialized: ${status.initializedAt}`,
    `Components: ${status.components.map((c) => c.name).join(', ')}`,
    `Postgres records: ${status.postgres.records}`,
    `TLS: ${status.tls?.note || 'see README'}`,
  ];
  return { ...status, human: lines.join('\n') };
}

/**
 * @param {{ dataDir: string, outPath?: string }} input
 */
export async function backupSelfHost(input) {
  const configPath = join(input.dataDir, 'config.json');
  if (!(await pathExists(configPath))) throw new NotFoundError('selfhost_not_initialized');

  const config = JSON.parse(await readFile(configPath, 'utf8'));
  const dumpPath = join(input.dataDir, 'data', 'postgres', 'dump.json');
  const postgresDump = (await pathExists(dumpPath)) ? JSON.parse(await readFile(dumpPath, 'utf8')) : {};

  const backup = {
    format: 'unilives-selfhost-backup',
    version: 1,
    createdAt: now(),
    platformVersion: config.version,
    config,
    postgresDump,
  };

  const outPath = input.outPath || join(input.dataDir, 'backups', `backup-${Date.now()}.json`);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(backup, null, 2));
  return { ok: true, outPath, createdAt: backup.createdAt };
}

/**
 * @param {{ dataDir: string, backupPath: string, destroyExisting?: boolean }} input
 */
export async function restoreSelfHost(input) {
  const raw = await readFile(input.backupPath, 'utf8');
  const backup = JSON.parse(raw);
  if (backup.format !== 'unilives-selfhost-backup') {
    throw new ValidationError('invalid_backup_format');
  }

  if (input.destroyExisting !== false) {
    await rm(input.dataDir, { recursive: true, force: true });
  }
  await mkdir(join(input.dataDir, 'data', 'postgres'), { recursive: true });
  await writeFile(join(input.dataDir, 'config.json'), JSON.stringify(backup.config, null, 2));
  await writeFile(join(input.dataDir, 'data', 'postgres', 'dump.json'), JSON.stringify(backup.postgresDump, null, 2));
  const compose = await generateComposeTemplate({ projectName: backup.config.projectName });
  await writeFile(join(input.dataDir, 'docker-compose.yml'), compose);

  return { ok: true, restoredAt: now(), records: countRecords(backup.postgresDump) };
}

function countRecords(dump) {
  return Object.values(dump || {}).reduce((n, table) => n + (Array.isArray(table) ? table.length : 0), 0);
}

/**
 * @param {{ dataDir: string, targetVersion?: string }} input
 */
export async function upgradePreflight(input) {
  const configPath = join(input.dataDir, 'config.json');
  if (!(await pathExists(configPath))) throw new NotFoundError('selfhost_not_initialized');
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  const targetVersion = input.targetVersion || PLATFORM_VERSION;
  const current = config.version || '0.0.0';

  /** @type {string[]} */
  const blockers = [];
  /** @type {string[]} */
  const warnings = [];

  if (compareSemver(current, targetVersion) > 0) blockers.push('target_older_than_current');
  if (!config.components?.includes('postgres')) blockers.push('postgres_component_missing');
  if (!config.env?.JWT_SECRET || String(config.env.JWT_SECRET).startsWith('CHANGE_ME')) {
    warnings.push('placeholder_secrets_detected');
  }

  return {
    ok: blockers.length === 0,
    currentVersion: current,
    targetVersion,
    blockers,
    warnings,
    recommended: ['backup before upgrade', 'review compose diff', 'rotate placeholder secrets'],
  };
}

function compareSemver(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const da = pa[i] || 0;
    const db = pb[i] || 0;
    if (da !== db) return da - db;
  }
  return 0;
}

export async function destroySelfHostState(dataDir) {
  await rm(dataDir, { recursive: true, force: true });
  return { ok: true };
}
