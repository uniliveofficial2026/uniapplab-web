#!/usr/bin/env node
/**
 * Start local api-server on :5001 if it is not already listening.
 * PK lifecycle (hosts / challenges / inbox / sessions) is in-process memory on this server.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API_ROOT = path.join(ROOT, 'artifacts/api-server');
const PORT = Number(process.env.VITE_LOCAL_LIVE_API_PORT ?? process.env.LIVE_API_PORT ?? '5001');
const PID_FILE = path.join(ROOT, '.local/live-api.pid');
const LOG_FILE = path.join(ROOT, '.local/live-api.log');

function portOpen(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: '127.0.0.1' });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
    socket.setTimeout(400, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]?.trim()) process.env[key] = value;
  }
}

async function waitForPort(port, timeoutMs = 45_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await portOpen(port)) return true;
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

async function main() {
  if (await portOpen(PORT)) {
    process.stdout.write(`[ensure-live-api] already listening on ${PORT}\n`);
    return;
  }

  for (const file of [
    path.join(ROOT, '.env'),
    path.join(ROOT, '.env.local'),
    path.join(ROOT, '.local/workspace-staff.env'),
    path.join(ROOT, 'artifacts/instacollab/.env'),
    path.join(API_ROOT, '.env'),
  ]) {
    loadEnvFile(file);
  }

  fs.mkdirSync(path.dirname(PID_FILE), { recursive: true });
  const dist = path.join(API_ROOT, 'dist/index.mjs');
  if (!fs.existsSync(dist)) {
    const build = spawn('pnpm', ['run', 'build'], { cwd: API_ROOT, stdio: 'inherit' });
    const buildCode = await new Promise((resolve) => build.on('exit', (code) => resolve(code ?? 1)));
    if (buildCode !== 0) {
      throw new Error(`api-server build failed (${buildCode})`);
    }
  }

  const out = fs.openSync(LOG_FILE, 'a');
  const child = spawn('pnpm', ['run', 'start'], {
    cwd: API_ROOT,
    detached: true,
    stdio: ['ignore', out, out],
    env: {
      ...process.env,
      PORT: String(PORT),
      NODE_ENV: 'development',
      UNILIVE_RUNTIME_ENV: 'local',
    },
  });
  child.unref();
  fs.writeFileSync(PID_FILE, String(child.pid));
  const ready = await waitForPort(PORT);
  if (!ready) {
    throw new Error(`api-server did not listen on ${PORT} (log: ${LOG_FILE})`);
  }
  process.stdout.write(`[ensure-live-api] started pid ${child.pid} on ${PORT}\n`);
}

main().catch((err) => {
  console.error('[ensure-live-api] failed:', err);
  process.exit(1);
});
