#!/usr/bin/env node
/**
 * App Handoff — unified task queue for the background ML agent.
 * Any screen, error, or system can enqueue work; the agent handles it silently.
 *
 * Task types: heal, deploy, verify, cloud_data, health, gemini, ux_learn, custom
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const QUEUE = path.join(ROOT, '.local/handoff-queue.jsonl');
const LOG = path.join(ROOT, '.local/handoff.log');
const STATE = path.join(ROOT, '.local/handoff-state.json');
const AUTO_DEPLOY = process.env.HANDOFF_AUTO_DEPLOY === '1';
const DEPLOY_EVERY_CYCLES = Number(process.env.HANDOFF_DEPLOY_CYCLES ?? '30');
const CLOUD_CHECK_MS = Number(process.env.HANDOFF_CLOUD_CHECK_MS ?? '3600000');

const TASK_PRIORITY = {
  cloud_data: 1,
  heal: 2,
  health: 3,
  ux_learn: 4,
  gemini: 5,
  verify: 6,
  deploy: 7,
  custom: 8,
};

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  fs.mkdirSync(path.dirname(LOG), { recursive: true });
  fs.appendFileSync(LOG, line);
  if (process.env.HANDOFF_VERBOSE === '1') console.log(`[handoff] ${msg}`);
}

export function enqueueHandoffTask(task) {
  const entry = {
    id: `h_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    t: Date.now(),
    status: 'pending',
    priority: TASK_PRIORITY[task.type] ?? 9,
    ...task,
  };
  fs.mkdirSync(path.dirname(QUEUE), { recursive: true });
  fs.appendFileSync(QUEUE, `${JSON.stringify(entry)}\n`);
  return entry.id;
}

function readQueue() {
  if (!fs.existsSync(QUEUE)) return [];
  return fs
    .readFileSync(QUEUE, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function writeQueue(tasks) {
  fs.mkdirSync(path.dirname(QUEUE), { recursive: true });
  fs.writeFileSync(QUEUE, tasks.length ? `${tasks.map((t) => JSON.stringify(t)).join('\n')}\n` : '');
}

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE, 'utf8'));
  } catch {
    return { lastCycle: 0, completed: 0 };
  }
}

function writeState(state) {
  fs.mkdirSync(path.dirname(STATE), { recursive: true });
  fs.writeFileSync(STATE, `${JSON.stringify(state, null, 2)}\n`);
}

function runQuiet(cmd, args, opts = {}) {
  const logFd = fs.openSync(LOG, 'a');
  const r = spawnSync(cmd, args, {
    cwd: opts.cwd ?? ROOT,
    stdio: ['ignore', logFd, logFd],
    env: { ...process.env, UX_AGENT_SILENT: '1', CHECK_HEALTH_AUTOFIX: '1', ...opts.env },
  });
  fs.closeSync(logFd);
  return r.status ?? 1;
}

function readEnv() {
  const out = {};
  for (const file of [
    path.join(ROOT, '.env'),
    path.join(ROOT, 'artifacts/instacollab/.env'),
  ]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) out[m[1]] = m[1].endsWith('_KEY') ? m[2].trim().replace(/^["']|["']$/g, '') : m[2].trim();
    }
  }
  return { ...out, ...process.env };
}

async function checkCloudDataFlow() {
  const env = readEnv();
  const url = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const anon = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || '';
  if (!url || !anon) {
    return { ok: false, issue: 'supabase_env_missing', message: 'Supabase URL/anon key missing' };
  }

  try {
    const postsRes = await fetch(`${url}/rest/v1/posts?select=id&limit=1`, {
      headers: { apikey: anon, Authorization: `Bearer ${anon}` },
    });
    if (postsRes.status === 404 || postsRes.status === 406) {
      return {
        ok: false,
        issue: 'posts_table_missing',
        message: 'public.posts table not found — run posts migration',
      };
    }
    if (!postsRes.ok) {
      const text = await postsRes.text();
      if (/relation.*posts.*does not exist/i.test(text)) {
        return { ok: false, issue: 'posts_table_missing', message: text.slice(0, 200) };
      }
    }
  } catch (err) {
    return {
      ok: false,
      issue: 'cloud_unreachable',
      message: err instanceof Error ? err.message : String(err),
    };
  }

  return { ok: true };
}

async function runTask(task) {
  log(`run ${task.type} — ${task.reason || task.detail || task.id}`);

  switch (task.type) {
    case 'heal':
      return runQuiet('node', ['scripts/self-heal.mjs']) === 0;
    case 'health':
      return (
        runQuiet('node', ['scripts/check-health.mjs'], {
          cwd: path.join(ROOT, 'artifacts/instacollab'),
        }) === 0
      );
    case 'ux_learn':
      return runQuiet('node', ['scripts/ux-learning-engine.mjs']) === 0;
    case 'verify':
      return runQuiet('node', ['scripts/verify-production.mjs']) === 0;
    case 'cloud_data': {
      const check = await checkCloudDataFlow();
      if (check.ok) return true;
      log(`cloud_data issue: ${check.issue} — ${check.message}`);
      runQuiet('node', ['scripts/posts-bootstrap-db.mjs'], {
        cwd: path.join(ROOT, 'artifacts/instacollab'),
      });
      enqueueHandoffTask({
        type: 'heal',
        reason: `after_${check.issue}`,
        source: 'handoff',
      });
      return false;
    }
    case 'gemini': {
      try {
        const mod = await import('./ux-gemini-fix.mjs');
        const r = await mod.runUxGeminiFix();
        return r.applied > 0 || r.features > 0;
      } catch {
        return false;
      }
    }
    case 'deploy': {
      runQuiet('node', ['scripts/self-heal.mjs']);
      const status = spawnSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' });
      if ((status.stdout || '').trim()) {
        spawnSync('git', ['add', '-A'], { cwd: ROOT, stdio: 'ignore' });
        const stamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
        spawnSync('git', ['commit', '-m', `auto: handoff ${stamp}`], { cwd: ROOT, stdio: 'ignore' });
        runQuiet('bash', ['scripts/github-push.sh']);
      }
      return runQuiet('bash', ['scripts/vercel-deploy.sh', '--prod']) === 0;
    }
    case 'custom':
      log(`custom task: ${task.detail || task.reason || 'unspecified'}`);
      enqueueHandoffTask({ type: 'gemini', reason: task.detail || task.reason, source: 'custom' });
      return true;
    default:
      log(`unknown task type: ${task.type}`);
      return false;
  }
}

/** Map UX / runtime signals → handoff tasks (critical only — no flood) */
export function handoffFromSignal(signal) {
  const detail = String(signal.detail || '');
  const type = signal.type;

  if (type === 'error' && /posts|cloud|supabase|sync|relation.*posts/i.test(detail)) {
    return enqueueHandoffTask({
      type: 'cloud_data',
      reason: 'runtime_error',
      detail,
      screen: signal.screen,
      source: 'ux',
    });
  }

  if (type === 'rage_tap') {
    return enqueueHandoffTask({
      type: 'custom',
      reason: 'ui_friction',
      detail: `Rage taps on ${detail}`,
      screen: signal.screen,
      source: 'ux',
    });
  }

  return null;
}

export async function runHandoffCycle(options = {}) {
  const { forceDeploy = false, cycle = 0 } = options;
  const state = readState();
  let tasks = readQueue().filter((t) => t.status === 'pending');

  const now = Date.now();
  if (!tasks.some((t) => t.type === 'cloud_data') && now - (state.lastCloudCheck ?? 0) > CLOUD_CHECK_MS) {
    enqueueHandoffTask({ type: 'cloud_data', reason: 'periodic_check', source: 'agent' });
    writeState({ ...state, lastCloudCheck: now });
  }
  tasks = readQueue().filter((t) => t.status === 'pending');

  tasks.sort((a, b) => (a.priority ?? 9) - (b.priority ?? 9) || a.t - b.t);

  let anyFixed = false;
  const completed = [];

  for (const task of tasks.slice(0, 12)) {
    task.status = 'running';
    writeQueue(readQueue().map((t) => (t.id === task.id ? task : t)));

    const ok = await runTask(task);
    task.status = ok ? 'done' : 'failed';
    task.finishedAt = Date.now();
    completed.push(task);
    if (ok) anyFixed = true;

    const all = readQueue().map((t) => (t.id === task.id ? task : t));
    writeQueue(all.filter((t) => t.status === 'pending'));
  }

  if (tasks.length > 0 && !tasks.some((t) => t.type === 'ux_learn')) {
    await runTask({ type: 'ux_learn', id: 'standing', reason: 'cycle' });
  }
  if (tasks.some((t) => t.type === 'custom' || t.type === 'gemini')) {
    const geminiOk = await runTask({ type: 'gemini', id: 'standing', reason: 'cycle' });
    if (geminiOk) anyFixed = true;
  }

  const shouldDeploy =
    forceDeploy ||
    AUTO_DEPLOY ||
    (cycle > 0 && cycle % DEPLOY_EVERY_CYCLES === 0 && anyFixed);

  if (shouldDeploy) {
    await runTask({ type: 'deploy', id: 'auto', reason: 'handoff_cycle' });
    setTimeout(() => void runTask({ type: 'verify', id: 'auto', reason: 'post_deploy' }), 45_000);
  }

  writeState({ ...state, lastCycle: Date.now(), completed: (state.completed || 0) + completed.length });
  log(`cycle done — ${completed.length} task(s), deploy=${shouldDeploy}`);
  return { completed: completed.length, deployed: shouldDeploy };
}

function drainUxSignals() {
  const signalsPath = path.join(ROOT, '.local/ux-signals.jsonl');
  if (!fs.existsSync(signalsPath)) return 0;
  const lines = fs.readFileSync(signalsPath, 'utf8').split('\n').filter(Boolean);
  let n = 0;
  for (const line of lines) {
    try {
      const signal = JSON.parse(line);
      if (handoffFromSignal(signal)) n += 1;
    } catch {
      /* skip */
    }
  }
  if (lines.length > 500) {
    fs.writeFileSync(signalsPath, `${lines.slice(-200).join('\n')}\n`);
  }
  return n;
}

function isMainModule() {
  const entry = process.argv[1];
  if (!entry) return false;
  return path.resolve(entry) === fileURLToPath(import.meta.url);
}

if (isMainModule()) {
  const cmd = process.argv[2];
  if (cmd === 'enqueue' && process.argv[3]) {
    const type = process.argv[3];
    const detail = process.argv.slice(4).join(' ') || undefined;
    const id = enqueueHandoffTask({ type, detail, reason: detail, source: 'cli' });
    console.log(id);
  } else if (cmd === 'cycle') {
    const cycleNum = Number(process.argv[3] ?? '0');
    void runHandoffCycle({ forceDeploy: process.argv.includes('--deploy'), cycle: cycleNum }).then((r) => {
      if (process.env.HANDOFF_VERBOSE === '1') console.log(JSON.stringify(r));
    });
  } else {
    drainUxSignals();
    void runHandoffCycle().then((r) => console.log(JSON.stringify(r)));
  }
}
