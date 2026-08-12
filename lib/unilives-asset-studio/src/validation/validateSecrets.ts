import { assertNoViteSecrets, ENV_LOCAL_PATH, loadEnvLocal } from '../config/env.js';
import { existsSync } from 'node:fs';

export function validateSecrets(): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  loadEnvLocal();
  if (!existsSync(ENV_LOCAL_PATH)) {
    issues.push('.env.local missing at repository root');
  }
  const viteBad = assertNoViteSecrets();
  for (const k of viteBad) {
    issues.push(`Provider-like secret must not use VITE_ prefix: ${k}`);
  }
  return { ok: issues.length === 0, issues };
}
