#!/usr/bin/env node
/**
 * Full autopilot — local dev + background handoff agent + deploy on save.
 *
 *   pnpm autopilot
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isAutopilotOn, writeAutomationConfig } from './lib/automation-config.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function log(msg) {
  console.log(`[autopilot] ${msg}`);
}

function ensureConfigOn() {
  if (!isAutopilotOn()) {
    writeAutomationConfig({ autopilot: true });
    log('enabled autopilot in config/auto-deploy.json');
  }
}

function startUxAgent() {
  const pidFile = path.join(ROOT, '.local/ux-agent.pid');
  try {
    const pid = Number(fs.readFileSync(pidFile, 'utf8').trim());
    process.kill(pid, 0);
    log(`UX agent already running (pid ${pid})`);
    return;
  } catch {
    /* start fresh */
  }

  const logFile = path.join(ROOT, '.local/ux-agent.log');
  fs.mkdirSync(path.dirname(logFile), { recursive: true });
  const out = fs.openSync(logFile, 'a');
  const child = spawn('node', ['scripts/background-ux-agent.mjs'], {
    cwd: ROOT,
    detached: true,
    stdio: ['ignore', out, out],
    env: {
      ...process.env,
      UX_AGENT_SILENT: '0',
      UX_AGENT_VERBOSE: '1',
      UX_AGENT_CYCLE_MS: process.env.UX_AGENT_CYCLE_MS ?? '300000',
    },
  });
  child.unref();
  log(`started background handoff agent (pid ${child.pid})`);
}

function startLive() {
  const pidFile = path.join(ROOT, '.local/live-sync.pid');
  try {
    const pid = Number(fs.readFileSync(pidFile, 'utf8').trim());
    process.kill(pid, 0);
    log(`live dev already running (pid ${pid})`);
    return;
  } catch {
    /* start fresh */
  }

  const logFile = path.join(ROOT, '.local/live-sync.log');
  fs.mkdirSync(path.dirname(logFile), { recursive: true });
  const out = fs.openSync(logFile, 'a');
  const child = spawn('pnpm', ['live'], {
    cwd: ROOT,
    detached: false,
    stdio: ['inherit', out, out],
    env: {
      ...process.env,
      LIVE_SYNC_DEPLOY: process.env.LIVE_SYNC_DEPLOY ?? '1',
      LIVE_SYNC_AUTO_PUSH: process.env.LIVE_SYNC_AUTO_PUSH ?? '1',
      UX_AGENT: '1',
    },
  });

  child.on('exit', (code) => {
    fs.closeSync(out);
    process.exit(code ?? 0);
  });
}

ensureConfigOn();
startUxAgent();
log('starting live dev with auto-deploy on save…');
startLive();
