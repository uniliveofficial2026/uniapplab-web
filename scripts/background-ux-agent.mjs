#!/usr/bin/env node
/**
 * Silent background UX learning agent — runs 24/7 alongside pnpm develop.
 * Learns from user behavior, auto-heals, optionally applies Gemini fixes, deploys + pushes.
 *
 * Logs: .local/ux-agent.log (silent unless UX_AGENT_VERBOSE=1)
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOG = path.join(ROOT, '.local/ux-agent.log');
const PID_FILE = path.join(ROOT, '.local/ux-agent.pid');
const SIGNALS = path.join(ROOT, '.local/ux-signals.jsonl');
const CYCLE_MS = Number(process.env.UX_AGENT_CYCLE_MS ?? '180000'); // 3 min
const DEPLOY_EVERY_CYCLES = Number(process.env.UX_AGENT_DEPLOY_CYCLES ?? '5'); // ~15 min
const SILENT = process.env.UX_AGENT_SILENT === '1';
const VERBOSE = process.env.UX_AGENT_VERBOSE === '1';

let cycle = 0;
let lastSignalSize = 0;
let running = false;

function agentLog(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  fs.mkdirSync(path.dirname(LOG), { recursive: true });
  fs.appendFileSync(LOG, line);
  if (VERBOSE || !SILENT) console.log(`[ux-agent] ${msg}`);
}

function runQuiet(cmd, args, opts = {}) {
  const logFd = fs.openSync(LOG, 'a');
  const r = spawnSync(cmd, args, {
    cwd: opts.cwd ?? ROOT,
    stdio: ['ignore', logFd, logFd],
    env: { ...process.env, UX_AGENT_SILENT: '1', CHECK_HEALTH_AUTOFIX: '1' },
  });
  fs.closeSync(logFd);
  return r.status ?? 1;
}

async function runGemini() {
  try {
    const mod = await import('./ux-gemini-fix.mjs');
    return mod.runUxGeminiFix();
  } catch (err) {
    agentLog(`gemini skip: ${err instanceof Error ? err.message : err}`);
    return { applied: 0, features: 0 };
  }
}

function silentDeploy(reason) {
  agentLog(`silent deploy (${reason})…`);
  runQuiet('node', ['scripts/self-heal.mjs']);

  const status = spawnSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' });
  if ((status.stdout || '').trim()) {
    spawnSync('git', ['add', '-A'], { cwd: ROOT, stdio: 'ignore' });
    const stamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    spawnSync('git', ['commit', '-m', `auto: ux-agent ${stamp}`], { cwd: ROOT, stdio: 'ignore' });
    runQuiet('bash', ['scripts/github-push.sh']);
  }

  const logFd = fs.openSync(LOG, 'a');
  const child = spawn('bash', ['scripts/vercel-deploy.sh', '--prod'], {
    cwd: ROOT,
    stdio: ['ignore', logFd, logFd],
    env: {
      ...process.env,
      NPM_CONFIG_USERCONFIG: undefined,
      NPM_CONFIG_GLOBALCONFIG: undefined,
    },
  });

  child.on('close', (code) => {
    fs.closeSync(logFd);
    agentLog(code === 0 ? 'deploy OK' : `deploy failed (${code})`);
    if (code === 0) {
      setTimeout(() => runQuiet('node', ['scripts/verify-production.mjs']), 45_000);
    }
  });
}

async function runCycle() {
  if (running) return;
  running = true;
  cycle += 1;

  try {
    const size = fs.existsSync(SIGNALS) ? fs.statSync(SIGNALS).size : 0;
    const newSignals = size > lastSignalSize;
    lastSignalSize = size;

    runQuiet('node', ['scripts/ux-learning-engine.mjs']);

    let learning = { frictionScore: 0, intents: [] };
    try {
      learning = JSON.parse(fs.readFileSync(path.join(ROOT, '.local/ux-learning.json'), 'utf8'));
    } catch {
      /* first run */
    }

    const healCode = runQuiet('node', ['scripts/self-heal.mjs']);
    const gemini = await runGemini();

    const critical = (learning.intents ?? []).some((i) => i.priority === 'critical');
    const highFriction = learning.frictionScore >= 25;
    const shouldDeploy =
      cycle % DEPLOY_EVERY_CYCLES === 0 ||
      newSignals ||
      healCode !== 0 ||
      gemini.applied > 0 ||
      critical ||
      highFriction;

    if (shouldDeploy) {
      const reason = gemini.applied
        ? `ml-fix-${gemini.applied}`
        : critical
          ? 'critical-friction'
          : highFriction
            ? 'high-friction'
            : `cycle-${cycle}`;
      silentDeploy(reason);
    } else {
      agentLog(`cycle ${cycle} — friction ${learning.frictionScore}, no deploy needed`);
    }
  } catch (err) {
    agentLog(`cycle error: ${err instanceof Error ? err.message : err}`);
  } finally {
    running = false;
  }
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
agentLog(`started (cycle ${CYCLE_MS / 1000}s, deploy every ${DEPLOY_EVERY_CYCLES} cycles)`);

void runCycle();
setInterval(() => void runCycle(), CYCLE_MS);
