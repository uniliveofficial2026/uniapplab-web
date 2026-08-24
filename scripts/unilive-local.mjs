#!/usr/bin/env node
/**
 * UniLive local stack — Docker when available; otherwise in-process Stage C subset.
 */
import { spawn, spawnSync } from 'node:child_process';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startLocalPlatform } from '@unilives/local-runtime';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const LOCAL_DIR = join(ROOT, 'local');
const GENERATED_DIR = join(LOCAL_DIR, '.generated');
const COMPOSE_FILE = join(LOCAL_DIR, 'docker-compose.yml');
const STATE_FILE = join(GENERATED_DIR, 'runtime.json');

const [, , cmd = 'help', ...rest] = process.argv;
const jsonMode = rest.includes('--json') || process.env.UNILIVE_JSON === '1';
const forceInProcess = rest.includes('--in-process');

/** @type {Awaited<ReturnType<typeof startLocalPlatform>> | null} */
let running = null;

function out(data, code = 0) {
  console.log(jsonMode || typeof data === 'object' ? JSON.stringify(data, null, 2) : String(data));
  process.exit(code);
}

function hasDockerCompose() {
  const r = spawnSync('docker', ['compose', 'version'], { stdio: 'ignore' });
  return r.status === 0;
}

async function saveState(state) {
  await mkdir(GENERATED_DIR, { recursive: true });
  await writeFile(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`);
}

function loadState() {
  if (!existsSync(STATE_FILE)) return null;
  try {
    return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return null;
  }
}

async function startDocker() {
  const args = ['compose', '-f', COMPOSE_FILE, 'up', '-d'];
  const child = spawn('docker', args, { cwd: LOCAL_DIR, stdio: jsonMode ? 'ignore' : 'inherit' });
  await new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('exit', (code) => (code === 0 ? resolve(undefined) : reject(new Error(`docker_exit_${code}`))));
  });
  running = await startLocalPlatform({ rootDir: ROOT, apiPort: 8788, studioPort: 8787 });
  const state = {
    mode: 'docker+platform',
    ...running,
    close: undefined,
    services: ['postgres', 'minio', 'livekit', 'platform-api', 'studio', 'mcp'],
  };
  await saveState({
    mode: state.mode,
    apiUrl: running.apiUrl,
    studioUrl: running.studioUrl,
    projectId: running.projectId,
    startedAt: running.startedAt,
    fallbackScope: running.fallbackScope,
  });
  return { ok: true, ...loadState() };
}

async function startInProcess() {
  running = await startLocalPlatform({ rootDir: ROOT, apiPort: 8788, studioPort: 8787 });
  await saveState({
    mode: 'in-process',
    apiUrl: running.apiUrl,
    studioUrl: running.studioUrl,
    projectId: running.projectId,
    startedAt: running.startedAt,
    fallbackScope: running.fallbackScope,
    mcpTools: running.mcpTools,
  });
  return { ok: true, ...loadState() };
}

async function stopStack() {
  if (running) {
    await running.close();
    running = null;
  }
  const state = loadState();
  if (state?.mode?.startsWith('docker') && hasDockerCompose()) {
    spawnSync('docker', ['compose', '-f', COMPOSE_FILE, 'down'], {
      cwd: LOCAL_DIR,
      stdio: jsonMode ? 'ignore' : 'inherit',
    });
  }
  if (existsSync(STATE_FILE)) await rm(STATE_FILE, { force: true });
  return { ok: true, stopped: true };
}

async function healthCheck() {
  const state = loadState();
  const apiUrl = state?.apiUrl || 'http://127.0.0.1:8788';
  const studioUrl = state?.studioUrl || 'http://127.0.0.1:8787';
  let apiOk = false;
  let studioOk = false;
  try {
    const res = await fetch(`${apiUrl}/api/v1/health`, { signal: AbortSignal.timeout(2000) });
    const body = await res.json();
    apiOk = body.ok === true;
  } catch {
    apiOk = false;
  }
  try {
    const res = await fetch(`${studioUrl}/api/health`, { signal: AbortSignal.timeout(2000) });
    const body = await res.json();
    studioOk = body.ok === true;
  } catch {
    studioOk = false;
  }
  return {
    ok: apiOk && studioOk,
    mode: state?.mode || null,
    api: { url: apiUrl, ok: apiOk },
    studio: { url: studioUrl, ok: studioOk },
    dockerAvailable: hasDockerCompose(),
    fallbackScope: state?.fallbackScope || null,
  };
}

try {
  switch (cmd) {
    case 'start': {
      const result =
        hasDockerCompose() && !forceInProcess ? await startDocker().catch(() => startInProcess()) : await startInProcess();
      if (jsonMode) out(result);
      else {
        console.log(JSON.stringify(result, null, 2));
        if (!rest.includes('--detach') && !jsonMode) {
          process.on('SIGINT', async () => {
            await stopStack();
            process.exit(0);
          });
          await new Promise(() => {});
        } else out(result);
      }
      break;
    }
    case 'stop':
      out(await stopStack());
      break;
    case 'restart':
      await stopStack();
      out(
        hasDockerCompose() && !forceInProcess
          ? await startDocker().catch(() => startInProcess())
          : await startInProcess(),
      );
      break;
    case 'health': {
      const h = await healthCheck();
      out(h, h.ok ? 0 : 1);
      break;
    }
    case 'reset-generated':
      if (process.env.UNILIVE_ENV === 'production') {
        out({ ok: false, error: 'refusing_reset_against_production' }, 1);
      }
      await rm(GENERATED_DIR, { recursive: true, force: true });
      out({ ok: true, cleared: GENERATED_DIR });
      break;
    default:
      out({
        commands: ['start', 'stop', 'restart', 'health', 'reset-generated'],
        flags: ['--json', '--in-process', '--detach'],
        compose: COMPOSE_FILE,
      });
  }
} catch (err) {
  out({ ok: false, error: String(err?.message || err) }, 1);
}
