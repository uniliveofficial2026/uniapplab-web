#!/usr/bin/env node
/**
 * Create (or replace) QStash schedule for background handoff cycles.
 * Usage: pnpm run upstash:schedule
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'lib/upstash/package.json'));
const { Client } = require('@upstash/qstash');

function loadDotEnv() {
  for (const file of [path.join(ROOT, '.env'), path.join(ROOT, '.env.local')]) {
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

const token = process.env.QSTASH_TOKEN?.trim();
if (!token) {
  console.error('[upstash] QSTASH_TOKEN missing — enable QStash in Upstash console first.');
  process.exit(1);
}

const origin = (process.env.PUBLIC_APP_ORIGIN || 'https://app.uniapplab.com').replace(/\/$/, '');
const destination = `${origin}/api/qstash/handoff-cycle`;
const cron = process.env.QSTASH_HANDOFF_CRON || '*/10 * * * *';

const client = new Client({ token });

const existing = await client.schedules.list();
for (const schedule of existing) {
  if (schedule.destination === destination) {
    await client.schedules.delete(schedule.scheduleId);
    console.log(`[upstash] Removed old schedule ${schedule.scheduleId}`);
  }
}

const created = await client.schedules.create({
  destination,
  cron,
  body: JSON.stringify({ source: 'qstash' }),
});

console.log(`[upstash] ✓ Schedule ${created.scheduleId}`);
console.log(`[upstash]   ${cron} → ${destination}`);
