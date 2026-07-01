#!/usr/bin/env node
/**
 * Start `pnpm live` silently in the background if it is not already running.
 * Skips CI / cloud build environments.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.LIVE_DEV_PORT ?? process.env.PORT ?? '5173');
const PID_FILE = path.join(ROOT, '.local/live-sync.pid');
const LOG_FILE = path.join(ROOT, '.local/live-sync.log');

function isCiOrCloud() {
  return Boolean(
    process.env.CI ||
      process.env.VERCEL ||
      process.env.RENDER ||
      process.env.GITHUB_ACTIONS ||
      process.env.CF_PAGES ||
      process.env.NETLIFY,
  );
}

function log(msg) {
  if (process.env.LIVE_VERBOSE === '1') {
    console.log(`[ensure-live] ${msg}`);
  }
}

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

function readPid() {
  try {
    const raw = fs.readFileSync(PID_FILE, 'utf8').trim();
    const pid = Number(raw);
    if (!Number.isFinite(pid) || pid <= 0) return null;
    process.kill(pid, 0);
    return pid;
  } catch {
    return null;
  }
}

async function main() {
  if (isCiOrCloud()) return;

  fs.mkdirSync(path.dirname(PID_FILE), { recursive: true });

  const existingPid = readPid();
  if (existingPid) {
    log(`already running (pid ${existingPid})`);
    return;
  }

  if (await portOpen(PORT)) {
    log(`port ${PORT} in use — assuming live dev is up`);
    return;
  }

  const out = fs.openSync(LOG_FILE, 'a');
  const child = spawn('pnpm', ['live'], {
    cwd: ROOT,
    detached: true,
    stdio: ['ignore', out, out],
    env: { ...process.env },
  });
  child.unref();
  fs.writeFileSync(PID_FILE, String(child.pid));

  log(`started pnpm live (pid ${child.pid}) — log: ${path.relative(ROOT, LOG_FILE)}`);
}

main().catch((err) => {
  console.error('[ensure-live] failed:', err);
  process.exit(1);
});
