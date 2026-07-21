#!/usr/bin/env node
/** Standalone Greedy Tap dev server (also started automatically by `pnpm dev`). */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startGreedyTapServer } from './greedy-tap-server.mjs';

const appRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const started = startGreedyTapServer(appRoot);
if (!started) process.exit(1);

const shutdown = (signal) => {
  console.log(`\n[greedy-tap] ${signal} — stopping…`);
  started.child.kill('SIGTERM');
  setTimeout(() => started.child.kill('SIGKILL'), 1500).unref();
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
started.child.on('exit', (code) => process.exit(code ?? 0));
