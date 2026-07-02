#!/usr/bin/env node
/**
 * Unified live dev: instant HMR on localhost + auto-deploy to production on every save.
 *
 * Usage:
 *   pnpm develop   (alias)
 *   pnpm live
 *
 * Env:
 *   LIVE_SYNC_MODE=remote|prebuilt|git  — deploy strategy (default: remote = full Vercel build)
 *   LIVE_SYNC_DEBOUNCE_MS               — ms after last save (default 0; 3000 on /Volumes/)
 *   LIVE_SYNC_SILENT=0               — log to terminal (default: silent → .local/live-sync.log)
 *   LIVE_SYNC_DEPLOY_ON_START=1      — deploy on startup (default: off)
 *   LIVE_SYNC_AUTO_HEAL=0               — skip self-heal before deploy (default: on)
 *   LIVE_SYNC_VERIFY=0                  — skip post-deploy production checks (default: on)
 *   LIVE_SYNC_AUTO_PUSH=0               — skip git commit+push before deploy (default: on)
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const USE_POLL_WATCH =
  process.env.LIVE_SYNC_POLLING === '1' || ROOT.startsWith('/Volumes/');
const DEBOUNCE_MS = Number(
  process.env.LIVE_SYNC_DEBOUNCE_MS ?? (USE_POLL_WATCH ? '8000' : '5000'),
);
const DEPLOY_ON_START = process.env.LIVE_SYNC_DEPLOY_ON_START === '1';
const SILENT = process.env.LIVE_SYNC_SILENT !== '0';
const LOG_FILE = path.join(ROOT, '.local/live-sync.log');
const DEPLOY_MODE = (process.env.LIVE_SYNC_MODE || 'remote').toLowerCase();
const POLL_WATCH_MS = Number(process.env.LIVE_SYNC_POLL_MS ?? '800');
const AUTO_HEAL = process.env.LIVE_SYNC_AUTO_HEAL !== '0';
const VERIFY_PROD = process.env.LIVE_SYNC_VERIFY !== '0';
const AUTO_PUSH = process.env.LIVE_SYNC_AUTO_PUSH !== '0';
const VERIFY_WAIT_MS = Number(process.env.LIVE_SYNC_VERIFY_WAIT_MS ?? '45000');
const MAX_VERIFY_RETRIES = Number(process.env.LIVE_SYNC_VERIFY_RETRIES ?? '2');

const WATCH_ROOTS = [
  'artifacts/instacollab',
  'artifacts/api-server',
  'lib',
  'scripts',
  'config',
];

const WATCH_FILES = [
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  '.env',
  'artifacts/instacollab/.env',
  'artifacts/instacollab/package.json',
  'artifacts/instacollab/vite.config.ts',
  'artifacts/instacollab/vercel.json',
  'artifacts/instacollab/index.html',
  'artifacts/instacollab/src/index.css',
];

const IGNORE = new Set(['.DS_Store', 'node_modules', '.git', 'dist', '.vercel']);

let debounceTimer = null;
let deployRunning = false;
let deployQueued = false;
let pendingReason = 'change';
let viteChild = null;
const fileSnapshots = new Map();

function log(msg) {
  if (SILENT) {
    try {
      fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
      fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${msg}\n`);
    } catch {
      /* ignore */
    }
    if (process.env.LIVE_SYNC_VERBOSE === '1') console.log(`[live] ${msg}`);
    return;
  }
  console.log(`[live] ${msg}`);
}

function shouldIgnore(filePath) {
  const normalized = String(filePath).replace(/\\/g, '/');
  if (normalized.includes('live-version.json')) return true;
  if (normalized.includes('/dist/')) return true;
  if (normalized.includes('/.vercel/')) return true;
  if (normalized.includes('/vendor/archives/') && normalized.endsWith('.zip')) return false;
  const parts = normalized.split('/');
  return parts.some((p) => IGNORE.has(p) || p.startsWith('._'));
}

function watchDir(absDir) {
  if (!fs.existsSync(absDir)) return;
  if (USE_POLL_WATCH) {
    startPollWatch(absDir);
    log(`polling ${path.relative(ROOT, absDir)} every ${POLL_WATCH_MS}ms`);
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
      const prev = fileSnapshots.get(full);
      if (prev === undefined) {
        fileSnapshots.set(full, mtime);
      } else if (mtime !== prev) {
        fileSnapshots.set(full, mtime);
        scheduleDeploy(path.relative(ROOT, full));
      }
    }
  }

  setInterval(() => walk(absDir), POLL_WATCH_MS);
  walk(absDir);
}

function watchFiles() {
  for (const rel of WATCH_FILES) {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) continue;
    if (USE_POLL_WATCH) {
      fileSnapshots.set(abs, fs.statSync(abs).mtimeMs);
      continue;
    }
    try {
      fs.watch(abs, () => scheduleDeploy(rel));
      log(`watching ${rel}`);
    } catch {
      /* single-file watch unsupported — polling roots cover it */
    }
  }
  if (USE_POLL_WATCH) {
    setInterval(() => {
      for (const rel of WATCH_FILES) {
        const abs = path.join(ROOT, rel);
        if (!fs.existsSync(abs)) continue;
        const mtime = fs.statSync(abs).mtimeMs;
        const prev = fileSnapshots.get(abs);
        if (prev === undefined) fileSnapshots.set(abs, mtime);
        else if (mtime !== prev) {
          fileSnapshots.set(abs, mtime);
          scheduleDeploy(rel);
        }
      }
    }, POLL_WATCH_MS);
  }
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
    if (!SILENT) log(`change (${reason}) → deploying`);
  } else if (!SILENT) {
    log(`change (${reason}) → deploy in ${Math.round(delay / 1000)}s if idle`);
  }
}

function parseDeploymentUrl(output) {
  const match = output.match(/https:\/\/uniapplab-web-instacollab-[a-z0-9]+\.vercel\.app/g);
  return match?.[match.length - 1] ?? '';
}

async function aliasDomains(deploymentUrl) {
  if (!deploymentUrl) return;
  for (const host of ['app.uniapplab.com', 'uniapplab.com', 'www.uniapplab.com']) {
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
    if (r.status !== 0) log(`alias ${host} failed (exit ${r.status})`);
  }
}

function runSelfHeal() {
  if (!AUTO_HEAL) return 0;
  log('self-heal + auto-fix…');
  const r = spawnSync('node', ['scripts/auto-fix.mjs'], { cwd: ROOT, stdio: 'inherit' });
  return r.status ?? 1;
}

function runAutoPush() {
  if (!AUTO_PUSH) return 0;

  const status = spawnSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' });
  const dirty = (status.stdout || '').trim();
  if (!dirty) return 0;

  log('auto-commit + push…');
  spawnSync('git', ['add', '-A'], { cwd: ROOT, stdio: 'inherit' });
  const stamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const commit = spawnSync('git', ['commit', '-m', `auto: live sync ${stamp}`], {
    cwd: ROOT,
    stdio: 'inherit',
  });
  if (commit.status !== 0) {
    log('auto-commit skipped (nothing to commit or hook rejected)');
    return 0;
  }

  const push = spawnSync('bash', ['scripts/github-push.sh'], { cwd: ROOT, stdio: 'inherit' });
  return push.status ?? 1;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function verifyProduction(attempt = 1) {
  if (!VERIFY_PROD) return true;
  if (attempt > 1) log(`verify production (retry ${attempt})…`);
  else log(`verify production (waiting ${Math.round(VERIFY_WAIT_MS / 1000)}s for CDN)…`);

  await sleep(VERIFY_WAIT_MS);
  const r = spawnSync('node', ['scripts/verify-production.mjs'], { cwd: ROOT, stdio: 'inherit' });
  if (r.status === 0) return true;
  if (attempt < MAX_VERIFY_RETRIES) return verifyProduction(attempt + 1);
  return false;
}

function spawnDeploy(deployEnv) {
  return new Promise((resolve) => {
    let child;
    if (DEPLOY_MODE === 'git') {
      child = spawn('bash', ['scripts/vercel-deploy-git.sh'], {
        cwd: ROOT,
        env: deployEnv,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } else {
      if (DEPLOY_MODE === 'prebuilt') {
        deployEnv.LIVE_SYNC_PREBUILT = '1';
      }
      child = spawn('bash', ['scripts/vercel-deploy.sh', '--prod'], {
        cwd: ROOT,
        env: deployEnv,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    }

    let output = '';
  child.stdout?.on('data', (chunk) => {
    const text = String(chunk);
    output += text;
    if (!SILENT) process.stdout.write(text);
  });
  child.stderr?.on('data', (chunk) => {
    const text = String(chunk);
    output += text;
    if (!SILENT) process.stderr.write(text);
  });

    child.on('close', (code) => {
      resolve({ code: code ?? 1, output });
    });
  });
}

async function runDeploy(reason, verifyAttempt = 0) {
  if (deployRunning) {
    deployQueued = true;
    pendingReason = reason;
    return;
  }
  deployRunning = true;
  log(`deploying → production (${reason}, mode=${DEPLOY_MODE})…`);

  runSelfHeal();
  const pushCode = runAutoPush();
  if (pushCode !== 0) log('auto-push failed — continuing with deploy');

  const deployEnv = {
    ...process.env,
    NPM_CONFIG_USERCONFIG: undefined,
    NPM_CONFIG_GLOBALCONFIG: undefined,
    npm_config_userconfig: undefined,
    npm_config_globalconfig: undefined,
  };

  const { code, output } = await spawnDeploy(deployEnv);
  deployRunning = false;

  if (code === 0) {
    const verified = await verifyProduction(verifyAttempt + 1);
    if (verified) {
      log('deploy OK — https://app.uniapplab.com');
    } else {
      log('deploy finished but production verify failed — re-healing and redeploying once');
      runSelfHeal();
      if (!deployQueued) {
        deployRunning = true;
        const retry = await spawnDeploy(deployEnv);
        deployRunning = false;
        if (retry.code === 0) {
          const retryOk = await verifyProduction(1);
          if (retryOk) log('deploy OK after retry — https://app.uniapplab.com');
          else log('deploy retry still failing verify — check scripts/verify-production.mjs');
        } else {
          log(`deploy retry failed (exit ${retry.code})`);
        }
      }
    }
  } else {
    log(`deploy failed (exit ${code})`);
    const url = parseDeploymentUrl(output);
    if (url) void aliasDomains(url);
    runSelfHeal();
  }

  if (deployQueued) {
    deployQueued = false;
    void runDeploy(pendingReason);
  }
}

function readUxAgentPid() {
  try {
    const pid = Number(fs.readFileSync(path.join(ROOT, '.local/ux-agent.pid'), 'utf8').trim());
    if (Number.isFinite(pid) && pid > 0) {
      process.kill(pid, 0);
      return pid;
    }
  } catch {
    /* not running */
  }
  return null;
}

function startBackgroundUxAgent() {
  if (process.env.UX_AGENT === '0') return;
  if (readUxAgentPid()) {
    log('UX learning agent already running');
    return;
  }

  const logPath = path.join(ROOT, '.local/ux-agent.log');
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  const out = fs.openSync(logPath, 'a');
  const child = spawn('node', ['scripts/background-ux-agent.mjs'], {
    cwd: ROOT,
    detached: true,
    stdio: ['ignore', out, out],
    env: { ...process.env, UX_AGENT_SILENT: '1' },
  });
  child.unref();
  log('UX learning agent started (silent)');
}

function startVite() {
  writePidFile();
  viteChild = spawn('pnpm', ['--filter', '@workspace/instacollab', 'run', 'dev'], {
    cwd: ROOT,
    env: { ...process.env, VITE_UNIFIED_LIVE: 'true' },
    stdio: 'inherit',
  });

  viteChild.on('exit', (code, signal) => {
    if (signal) log(`vite stopped (${signal})`);
    else if (code !== 0) log(`vite exited ${code}`);
    process.exit(code ?? 0);
  });
}

function shutdown() {
  log('shutting down…');
  if (debounceTimer) clearTimeout(debounceTimer);
  if (viteChild && !viteChild.killed) viteChild.kill('SIGTERM');
  const uxPid = readUxAgentPid();
  if (uxPid) {
    try {
      process.kill(uxPid, 'SIGTERM');
    } catch {
      /* ignore */
    }
  }
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

log('Develop mode — local http://localhost:5173 (silent background sync)');
if (!SILENT) {
  log(`Deploy: ${DEPLOY_MODE}`);
  log(`Self-heal: ${AUTO_HEAL ? 'on' : 'off'} · Verify: ${VERIFY_PROD ? 'on' : 'off'} · Auto-push: ${AUTO_PUSH ? 'on' : 'off'}`);
  log(`Handoff agent: ${process.env.UX_AGENT === '0' ? 'off' : 'on (silent)'}`);
}

for (const rel of WATCH_ROOTS) watchDir(path.join(ROOT, rel));
watchFiles();

startVite();
startBackgroundUxAgent();

if (DEPLOY_ON_START) scheduleDeploy('startup');
