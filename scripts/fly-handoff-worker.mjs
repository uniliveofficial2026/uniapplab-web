#!/usr/bin/env node
/**
 * Fly.io handoff worker — runs handoff cycles on a schedule (always-on process).
 */
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INTERVAL_MS = Number(process.env.HANDOFF_CYCLE_MS ?? 600_000);

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function main() {
  process.chdir(ROOT);
  console.log(`[fly-worker] handoff cycle every ${INTERVAL_MS}ms`);

  let cycle = 0;
  for (;;) {
    try {
      const { runHandoffCycle } = await import('./app-handoff.mjs');
      const result = await runHandoffCycle({ cycle });
      console.log(`[fly-worker] cycle ${cycle} done`, JSON.stringify(result));
    } catch (err) {
      console.error('[fly-worker] cycle error', err instanceof Error ? err.message : err);
    }
    cycle += 1;
    await sleep(INTERVAL_MS);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
