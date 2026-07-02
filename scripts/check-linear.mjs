#!/usr/bin/env node
/**
 * Verify Linear API + optional production health endpoint.
 * Usage: pnpm run linear:check [--prod]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadDotEnv() {
  for (const file of [
    path.join(ROOT, '.env'),
    path.join(ROOT, '.env.local'),
    path.join(ROOT, 'artifacts/instacollab/.env'),
  ]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
      }
    }
  }
}

loadDotEnv();

const { isLinearConfigured, getViewer, listTeams } = await import('../lib/linear/index.mjs');

let failed = 0;

if (!isLinearConfigured()) {
  console.error('[linear] ✗ LINEAR_API_KEY not set — run: pnpm run linear:setup');
  failed += 1;
} else {
  try {
    const viewer = await getViewer();
    if (viewer) {
      console.log(`[linear] ✓ API key valid — ${viewer.name} <${viewer.email}>`);
    } else {
      console.error('[linear] ✗ viewer query returned empty');
      failed += 1;
    }

    const teams = await listTeams();
    if (teams.length) {
      console.log('[linear] ✓ Teams (set LINEAR_TEAM_ID to one of these):');
      for (const t of teams) {
        const mark = process.env.LINEAR_TEAM_ID === t.id ? ' ← configured' : '';
        console.log(`  ${t.key.padEnd(8)} ${t.name}  id=${t.id}${mark}`);
      }
    } else {
      console.error('[linear] ✗ no teams found');
      failed += 1;
    }

    if (!process.env.LINEAR_TEAM_ID?.trim()) {
      console.warn('[linear] ⚠ LINEAR_TEAM_ID not set — handoff cannot create issues');
    }
  } catch (err) {
    console.error(`[linear] ✗ ${err instanceof Error ? err.message : String(err)}`);
    failed += 1;
  }
}

if (process.argv.includes('--prod')) {
  const { probeProdApi } = await import('./probe-prod-api.mjs');
  const origin = (process.env.PUBLIC_APP_ORIGIN || 'https://app.uniapplab.com').replace(/\/$/, '');
  const result = await probeProdApi(origin, '/api/linear/health', { retries: 2 });
  if (result.ok && result.body?.configured) {
    console.log(`[linear] ✓ production ${origin}/api/linear/health`);
  } else {
    console.error(`[linear] ✗ production health: ${result.reason || result.status}`);
    failed += 1;
  }

  const flyOrigin = (process.env.FLY_API_ORIGIN || '').replace(/\/$/, '');
  if (flyOrigin) {
    const flyResult = await probeProdApi(flyOrigin, '/api/linear/health', { retries: 1 });
    if (flyResult.ok) {
      console.log(`[linear] ✓ fly ${flyOrigin}/api/linear/health`);
    } else {
      console.warn(`[linear] ⚠ fly health: ${flyResult.reason || flyResult.status}`);
    }
  }
}

process.exit(failed > 0 ? 1 : 0);
