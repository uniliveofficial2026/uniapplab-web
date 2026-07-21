#!/usr/bin/env node
/** Smoke test: Greedy Tap bundled with UniLive dev server. */
import { spawnSync } from 'node:child_process';

const viteOrigin = process.env.SMOKE_ORIGIN || 'http://127.0.0.1:5173';
const greedyOrigin = process.env.GREEDY_TAP_INTERNAL_URL || 'http://127.0.0.1:3000';

function curl(url) {
  const res = spawnSync('curl', ['-s', '-f', url], { encoding: 'utf8' });
  return { ok: res.status === 0, body: res.stdout || '', status: res.status };
}

function isGreedyHealth(body) {
  try {
    const json = JSON.parse(body);
    return json.status === 'ok' && typeof json.time === 'string' && typeof json.mode === 'string';
  } catch {
    return false;
  }
}

const checks = [
  {
    name: 'greedy-direct-health',
    run: () => {
      const r = curl(`${greedyOrigin}/api/health`);
      return r.ok && isGreedyHealth(r.body);
    },
  },
  {
    name: 'unilive-proxied-greedy-health',
    run: () => {
      const r = curl(`${viteOrigin}/api/health`);
      return r.ok && isGreedyHealth(r.body);
    },
  },
  {
    name: 'unilive-shell',
    run: () => {
      const r = curl(`${viteOrigin}/`);
      return r.ok && r.body.includes('root');
    },
  },
  {
    name: 'greedy-static-index',
    run: () => {
      const r = curl(`${viteOrigin}/games/greedy-slot/index.html`);
      return r.ok && r.body.includes('root');
    },
  },
];

let failed = 0;
for (const check of checks) {
  const ok = check.run();
  console.log(`${ok ? '✓' : '✗'} ${check.name}`);
  if (!ok) failed += 1;
}

process.exit(failed ? 1 : 0);
