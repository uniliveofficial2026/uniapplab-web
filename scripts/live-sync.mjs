#!/usr/bin/env node
/**
 * Unified live dev: instant HMR on localhost + immediate auto-deploy to production
 * (app.uniapplab.com, uniapplab.com, www.uniapplab.com) using the same Supabase data.
 *
 * Usage: pnpm live
 *
 * Env:
 *   LIVE_SYNC_DEBOUNCE_MS     — ms after last save before deploy (default 0 = instant)
 *   LIVE_SYNC_DEPLOY_ON_START — set to 0 to skip deploy when live starts (default: deploy on start)
 *   LIVE_SYNC_FULL_REPO=1     — full repo upload (default: fast prebuilt bundle)
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const USE_POLL_WATCH =
  process.env.LIVE_SYNC_POLLING === '1' || ROOT.startsWith('/Volumes/');
const DEBOUNCE_MS = Number(
  process.env.LIVE_SYNC_DEBOUNCE_MS ?? (USE_POLL_WATCH ? '3000' : '0'),
);
const DEPLOY_ON_START = process.env.LIVE_SYNC_DEPLOY_ON_START !== '0';
const FULL_REPO = process.env.LIVE_SYNC_FULL_REPO === '1';
const POLL_WATCH_MS = Number(process.env.LIVE_SYNC_POLL_MS ?? '800');

const WATCH_ROOTS = [
  'artifacts/instacollab/src',
  'artifacts/instacollab/public',
  'artifacts/api-server/src',
  'lib',
];

const IGNORE = new Set(['.DS_Store', 'node_modules', '.git', 'dist', '.vercel']);

let debounceTimer = null;
let deployRunning = false;
let deployQueued = false;
let pendingReason = 'change';
let viteChild = null;

function log(msg) {
  console.log(`[live] ${msg}`);
}

function shouldIgnore(filePath) {
  const normalized = String(filePath).replace(/\\/g, '/');
  if (normalized.includes('live-version.json')) return true;
  if (normalized.includes('/dist/')) return true;
  if (normalized.includes('/.vercel/')) return true;
  const parts = normalized.split('/');
  return parts.some((p) => IGNORE.has(p) || p.startsWith('._'));
}

function watchDir(absDir) {
  if (!fs.existsSync(absDir)) return;
  if (USE_POLL_WATCH) {
    startPollWatch(absDir);
    log(`polling ${path.relative(ROOT, absDir)} every ${POLL_WATCH_MS}ms (external volume)`);
    return;
  }
  try {
    fs.watch(absDir, { recursive: true }, (_event, filename) => {
      if (!filename || shouldIgnore(String(filename))) return;
      scheduleDeploy(String(filename));
    });
    log(`watching ${path.relative(ROOT, absDir)}`);
  } catch (err) {
    log(`watch failed for ${absDir}: ${err instanceof Error ? err.message : err}`);
    startPollWatch(absDir);
  }
}

function startPollWatch(absDir) {
  const snapshots = new Map();

  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (shouldIgnore(entry.name)) continue;
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.isFile()) continue;
      let mtime = 0;
      try {
        mtime = fs.statSync(full).mtimeMs;
      } catch {
        continue;
      }
      const prev = snapshots.get(full);
      if (prev === undefined) {
        snapshots.set(full, mtime);
      } else if (mtime !== prev) {
        snapshots.set(full, mtime);
        scheduleDeploy(path.relative(ROOT, full));
      }
    }
  }

  setInterval(() => walk(absDir), POLL_WATCH_MS);
  walk(absDir);
}

function writePidFile() {
  const dir = path.join(ROOT, '.local');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'live-sync.pid'), String(process.pid));
}

function scheduleDeploy(reason) {
  pendingReason = reason;
  if (debounceTimer) clearTimeout(debounceTimer);

  const delay = Number.isFinite(DEBOUNCE_MS) && DEBOUNCE_MS > 0 ? DEBOUNCE_MS : 0;

  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void runDeploy(pendingReason);
  }, delay);

  if (delay === 0) {
    log(`change detected (${reason}) — deploying now`);
  } else {
    log(`change detected (${reason}) — deploy in ${Math.round(delay / 1000)}s if idle`);
  }
}

function parseDeploymentUrl(output) {
  const match = output.match(/https:\/\/uniapplab-web-instacollab-[a-z0-9]+\.vercel\.app/g);
  return match?.[match.length - 1] ?? '';
}

async function aliasDomains(deploymentUrl) {
  if (!deploymentUrl) return;
  const hosts = ['app.uniapplab.com', 'uniapplab.com', 'www.uniapplab.com'];
  for (const host of hosts) {
    const r = spawnSync(
      'pnpm',
      ['dlx', 'vercel@latest', 'alias', 'set', deploymentUrl, host, '--yes'],
      {
        cwd: ROOT,
        env: {
          ...process.env,
          NPM_CONFIG_USERCONFIG: undefined,
          NPM_CONFIG_GLOBALCONFIG: undefined,
          npm_config_userconfig: undefined,
          npm_config_globalconfig: undefined,
        },
        stdio: 'inherit',
      },
    );
    if (r.status !== 0) {
      log(`alias ${host} failed (exit ${r.status})`);
    }
  }
}

function runDeploy(reason) {
  if (deployRunning) {
    deployQueued = true;
    pendingReason = reason;
    return;
  }
  deployRunning = true;
  log(`deploying → production (${reason})…`);

  const deployEnv = {
    ...process.env,
    NPM_CONFIG_USERCONFIG: undefined,
    NPM_CONFIG_GLOBALCONFIG: undefined,
    npm_config_userconfig: undefined,
    npm_config_globalconfig: undefined,
    LIVE_SYNC_PREBUILT: FULL_REPO ? undefined : '1',
  };

  const child = spawn('bash', ['scripts/vercel-deploy.sh', '--prod'], {
    cwd: ROOT,
    env: deployEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let output = '';
  child.stdout?.on('data', (chunk) => {
    const text = String(chunk);
    output += text;
    process.stdout.write(text);
  });
  child.stderr?.on('data', (chunk) => {
    const text = String(chunk);
    output += text;
    process.stderr.write(text);
  });

  child.on('close', (code) => {
    deployRunning = false;
    if (code === 0) {
      log('deploy OK — live on app.uniapplab.com, uniapplab.com, www.uniapplab.com');
    } else {
      log(`deploy failed (exit ${code})`);
      const url = parseDeploymentUrl(output);
      if (url) void aliasDomains(url);
    }
    if (deployQueued) {
      deployQueued = false;
      void runDeploy(pendingReason);
    }
  });
}

function startVite() {
  writePidFile();
  viteChild = spawn(
    'pnpm',
    ['--filter', '@workspace/instacollab', 'run', 'dev'],
    {
      cwd: ROOT,
      env: {
        ...process.env,
        VITE_UNIFIED_LIVE: 'true',
      },
      stdio: 'inherit',
    },
  );

  viteChild.on('exit', (code, signal) => {
    if (signal) {
      log(`vite stopped (${signal})`);
    } else if (code !== 0) {
      log(`vite exited ${code}`);
    }
    process.exit(code ?? 0);
  });
}

function shutdown() {
  log('shutting down…');
  if (debounceTimer) clearTimeout(debounceTimer);
  if (viteChild && !viteChild.killed) viteChild.kill('SIGTERM');
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

log('Unified live — local http://localhost:5173 uses production Supabase + API');
log(
  DEBOUNCE_MS > 0
    ? `Production deploy debounce: ${DEBOUNCE_MS}ms (${FULL_REPO ? 'full repo' : 'prebuilt'})`
    : `Production deploy: instant on save (${FULL_REPO ? 'full repo' : 'prebuilt'})`,
);
log('Domains: app.uniapplab.com · uniapplab.com · www.uniapplab.com');

for (const rel of WATCH_ROOTS) {
  watchDir(path.join(ROOT, rel));
}

startVite();

if (DEPLOY_ON_START) {
  scheduleDeploy('startup');
}
