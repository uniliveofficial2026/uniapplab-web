#!/usr/bin/env node
/**
 * UniLive local stack — docker compose when available, in-process fallback otherwise.
 */
import { spawn, spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createControlPlaneStore } from '@unilives/platform-core';
import { createUniLiveMcpServer } from '@unilives/mcp';
import { startStudioServer } from '@unilives/studio';
import { createFakeRTCProvider } from '@unilives/rtc-fake';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const LOCAL_DIR = join(ROOT, 'local');
const GENERATED_DIR = join(LOCAL_DIR, '.generated');
const COMPOSE_FILE = join(LOCAL_DIR, 'docker-compose.yml');
const STATE_FILE = join(GENERATED_DIR, 'runtime.json');

const [, , cmd = 'help', ...rest] = process.argv;
const jsonMode = rest.includes('--json') || process.env.UNILIVE_JSON === '1';

function out(data, code = 0) {
  const text = jsonMode ? JSON.stringify(data, null, 2) : formatHuman(data);
  console.log(text);
  process.exit(code);
}

function formatHuman(data) {
  if (typeof data === 'string') return data;
  if (data.message) return data.message;
  return JSON.stringify(data, null, 2);
}

function hasDockerCompose() {
  const r = spawnSync('docker', ['compose', 'version'], { stdio: 'ignore' });
  return r.status === 0;
}

function randomSecret(len = 32) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let s = '';
  for (let i = 0; i < len; i += 1) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

async function ensureGeneratedSecrets() {
  await mkdir(GENERATED_DIR, { recursive: true });
  const pgPass = randomSecret(24);
  const minioPass = randomSecret(24);
  const lkSecret = randomSecret(32);
  const files = {
    'postgres.env': `POSTGRES_PASSWORD=${pgPass}\nDATABASE_URL=postgresql://unilive:${pgPass}@localhost:5432/unilive_dev\n`,
    'minio.env': `MINIO_ROOT_PASSWORD=${minioPass}\n`,
    'livekit.env': `LIVEKIT_API_KEY=devkey\nLIVEKIT_API_SECRET=${lkSecret}\nLIVEKIT_URL=ws://localhost:7880\n`,
  };
  for (const [name, content] of Object.entries(files)) {
    const path = join(GENERATED_DIR, name);
    if (!existsSync(path)) await writeFile(path, content, 'utf8');
  }
  return { generatedDir: GENERATED_DIR };
}

async function saveState(state) {
  await mkdir(GENERATED_DIR, { recursive: true });
  await writeFile(STATE_FILE, JSON.stringify(state, null, 2) + '\n', 'utf8');
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
  await ensureGeneratedSecrets();
  const envFile = join(LOCAL_DIR, '.env');
  const args = ['compose', '-f', COMPOSE_FILE, 'up', '-d'];
  if (existsSync(envFile)) args.unshift('--env-file', envFile);
  const child = spawn('docker', args, { cwd: LOCAL_DIR, stdio: 'inherit' });
  await new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('exit', (code) => (code === 0 ? resolve(undefined) : reject(new Error(`docker_exit_${code}`))));
  });
  const studioPort = Number(process.env.STUDIO_PORT || 8787);
  const studio = await startStudioServer({ port: studioPort, projectsDir: join(ROOT, '.unilive', 'projects') });
  const state = { mode: 'docker', startedAt: new Date().toISOString(), studioUrl: studio.url, pid: process.pid };
  await saveState(state);
  return { ok: true, mode: 'docker', studio: studio.url, services: ['postgres', 'minio', 'livekit'], mailpit: 'optional (--profile mail)' };
}

/** @type {{ studio?: Awaited<ReturnType<typeof startStudioServer>>, controlPlane?: ReturnType<typeof createControlPlaneStore> }} */
const inProcess = {};

async function startInProcess() {
  await ensureGeneratedSecrets();
  const controlPlane = createControlPlaneStore();
  const org = controlPlane.createOrganization({ name: 'local-org', actor: 'local' });
  const project = controlPlane.createProject({ organizationId: org.organizationId, name: 'local-app', actor: 'local' });
  controlPlane.createApiCredential({
    projectId: project.projectId,
    kind: 'developer',
    scopes: ['*'],
    actor: 'local',
  });
  const mcp = createUniLiveMcpServer({ controlPlane, requireAuth: false });
  const rtc = createFakeRTCProvider({ identity: 'local' });
  await rtc.joinRoom({ roomName: 'local-health', token: 'x', url: 'fake://' });
  await rtc.leaveRoom();
  const studioPort = Number(process.env.STUDIO_PORT || 8787);
  inProcess.controlPlane = controlPlane;
  inProcess.studio = await startStudioServer({
    port: studioPort,
    projectsDir: join(ROOT, '.unilive', 'projects'),
    controlPlane,
  });
  const state = {
    mode: 'in-process',
    startedAt: new Date().toISOString(),
    studioUrl: inProcess.studio.url,
    projectId: project.projectId,
    mcpTools: mcp.listTools().length,
    pid: process.pid,
  };
  await saveState(state);
  if (!jsonMode) {
    console.log(`In-process stack running. Studio: ${inProcess.studio.url}`);
    console.log('Press Ctrl+C to stop.');
  } else {
    out({ ok: true, ...state });
  }
  process.on('SIGINT', async () => {
    await inProcess.studio?.close();
    process.exit(0);
  });
  await new Promise(() => {});
}

async function stopStack() {
  const state = loadState();
  if (state?.mode === 'docker' && hasDockerCompose()) {
    spawnSync('docker', ['compose', '-f', COMPOSE_FILE, 'down'], { cwd: LOCAL_DIR, stdio: 'inherit' });
  }
  if (inProcess.studio) await inProcess.studio.close();
  return { ok: true, stopped: true, previous: state };
}

async function healthCheck() {
  const state = loadState();
  const mode = state?.mode || (hasDockerCompose() ? 'docker' : 'in-process');
  const studioUrl = state?.studioUrl || `http://127.0.0.1:${process.env.STUDIO_PORT || 8787}`;
  let studioOk = false;
  try {
    const res = await fetch(`${studioUrl}/api/health`, { signal: AbortSignal.timeout(2000) });
    const body = await res.json();
    studioOk = body.ok === true;
  } catch {
    studioOk = false;
  }
  return {
    ok: studioOk,
    mode,
    studio: { url: studioUrl, ok: studioOk },
    dockerAvailable: hasDockerCompose(),
    state,
  };
}

try {
  switch (cmd) {
    case 'start':
      if (hasDockerCompose() && !rest.includes('--in-process')) {
        out(await startDocker());
      } else {
        await startInProcess();
      }
      break;
    case 'stop':
      out(await stopStack());
      break;
    case 'restart':
      await stopStack();
      if (hasDockerCompose() && !rest.includes('--in-process')) out(await startDocker());
      else await startInProcess();
      break;
    case 'health':
      out(await healthCheck(), (await healthCheck()).ok ? 0 : 1);
      break;
    default:
      out({
        commands: ['start', 'stop', 'restart', 'health'],
        flags: ['--json', '--in-process'],
        compose: COMPOSE_FILE,
      });
  }
} catch (err) {
  out({ ok: false, error: String(err?.message || err) }, 1);
}
