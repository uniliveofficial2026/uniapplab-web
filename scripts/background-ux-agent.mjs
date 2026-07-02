#!/usr/bin/env node
/**
 * Silent background ML handoff agent — handles ANY app task from the queue.
 * Replaces standalone UX-only cycles with unified app-handoff runner.
 *
 * Logs: .local/handoff.log + .local/ux-agent.log
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOG = path.join(ROOT, '.local/ux-agent.log');
const PID_FILE = path.join(ROOT, '.local/ux-agent.pid');
const CYCLE_MS = Number(process.env.UX_AGENT_CYCLE_MS ?? '600000');
const SILENT = process.env.UX_AGENT_SILENT !== '0';
const VERBOSE = process.env.UX_AGENT_VERBOSE === '1';

function agentLog(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  fs.mkdirSync(path.dirname(LOG), { recursive: true });
  fs.appendFileSync(LOG, line);
  if (VERBOSE || !SILENT) console.log(`[handoff-agent] ${msg}`);
}

let handoffCycle = 0;

function runCycle() {
  handoffCycle += 1;
  const logFd = fs.openSync(LOG, 'a');
  const child = spawn('node', ['scripts/app-handoff.mjs', 'cycle', String(handoffCycle)], {
    cwd: ROOT,
    stdio: ['ignore', logFd, logFd],
    env: { ...process.env, UX_AGENT_SILENT: '1', HANDOFF_VERBOSE: VERBOSE ? '1' : '0' },
  });
  child.on('close', (code) => {
    fs.closeSync(logFd);
    agentLog(code === 0 ? 'handoff cycle OK' : `handoff cycle exit ${code}`);
  });
}

function writePid() {
  fs.mkdirSync(path.dirname(PID_FILE), { recursive: true });
  fs.writeFileSync(PID_FILE, String(process.pid));
}

function shutdown() {
  agentLog('shutting down');
  try {
    fs.unlinkSync(PID_FILE);
  } catch {
    /* ignore */
  }
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

writePid();
agentLog(`started — unified handoff every ${CYCLE_MS / 1000}s`);

runCycle();
setInterval(runCycle, CYCLE_MS);
