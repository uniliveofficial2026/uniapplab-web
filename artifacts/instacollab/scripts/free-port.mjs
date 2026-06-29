#!/usr/bin/env node
/**
 * Release a TCP listen port before starting vite preview (macOS/Linux).
 * Usage: node scripts/free-port.mjs 4173
 */
import { execSync } from 'node:child_process';

const port = Number(process.argv[2] ?? '4173');
if (!Number.isFinite(port) || port <= 0) {
  console.error(`[free-port] Invalid port: ${process.argv[2]}`);
  process.exit(1);
}

function listListenerPids(targetPort) {
  try {
    const out = execSync(`lsof -tiTCP:${targetPort} -sTCP:LISTEN`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (!out) return [];
    return [...new Set(out.split('\n').map((line) => line.trim()).filter(Boolean))];
  } catch {
    return [];
  }
}

const pids = listListenerPids(port);
if (pids.length === 0) {
  console.log(`[free-port] Port ${port} is already free.`);
  process.exit(0);
}

for (const pid of pids) {
  const n = Number(pid);
  if (!Number.isFinite(n) || n <= 0) continue;
  console.log(`[free-port] Stopping PID ${n} on port ${port}…`);
  try {
    process.kill(n, 'SIGTERM');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[free-port] SIGTERM failed for PID ${n}: ${message}`);
  }
}

// Allow the OS to release the socket before vite binds.
execSync('sleep 0.4');

const remaining = listListenerPids(port);
if (remaining.length === 0) {
  console.log(`[free-port] Port ${port} released.`);
  process.exit(0);
}

for (const pid of remaining) {
  const n = Number(pid);
  if (!Number.isFinite(n) || n <= 0) continue;
  console.log(`[free-port] Force-stopping PID ${n} on port ${port}…`);
  try {
    process.kill(n, 'SIGKILL');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[free-port] SIGKILL failed for PID ${n}: ${message}`);
  }
}

execSync('sleep 0.2');
const stillBusy = listListenerPids(port);
if (stillBusy.length > 0) {
  console.warn(
    `[free-port] Port ${port} is still in use (PIDs: ${stillBusy.join(', ')}). ` +
      `Vite will pick the next free port, or run: kill ${stillBusy.join(' ')}`,
  );
  process.exit(0);
}

console.log(`[free-port] Port ${port} released.`);
