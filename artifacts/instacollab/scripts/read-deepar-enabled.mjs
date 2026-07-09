#!/usr/bin/env node
/** Reads `DEEPAR_ENABLED` from src/lib/deepar/deeparEnabled.ts (build scripts). */
import fs from 'node:fs';
import path from 'node:path';

export function readDeeparEnabled(appRoot) {
  const file = path.join(appRoot, 'src/lib/deepar/deeparEnabled.ts');
  const src = fs.readFileSync(file, 'utf8');
  return /export const DEEPAR_ENABLED = true\b/.test(src);
}
