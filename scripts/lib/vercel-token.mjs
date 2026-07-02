/**
 * Read Vercel API token from .env, env, CLI auth files, or macOS keychain.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadDotEnv } from './load-dotenv.mjs';

export function readVercelToken() {
  loadDotEnv();

  if (process.env.VERCEL_TOKEN?.trim()) {
    const token = process.env.VERCEL_TOKEN.trim();
    if (/your_token|placeholder|xxxx|example/i.test(token)) return null;
    return token;
  }

  const authNames = ['auth.json', 'config.json'];
  const dirs = [
    process.env.VERCEL_CONFIG_DIR,
    path.join(os.homedir(), '.local/share/com.vercel.cli'),
    path.join(os.homedir(), '.config/com.vercel.cli'),
    path.join(os.homedir(), 'Library', 'Application Support', 'com.vercel.cli'),
    path.join(os.homedir(), '.vercel'),
  ].filter(Boolean);

  for (const dir of dirs) {
    for (const name of authNames) {
      const authPath = path.join(dir, name);
      if (!fs.existsSync(authPath)) continue;
      try {
        const auth = JSON.parse(fs.readFileSync(authPath, 'utf8'));
        const token = auth.token?.trim() || auth.credentials?.[0]?.token?.trim();
        if (token) return token;
      } catch {
        /* next */
      }
    }
  }

  if (process.platform === 'darwin') {
    for (const service of ['Vercel CLI', 'vercel', 'com.vercel.cli']) {
      const result = spawnSync('security', ['find-generic-password', '-s', service, '-w'], {
        encoding: 'utf8',
      });
      const token = result.stdout?.trim();
      if (result.status === 0 && token) return token;
    }
  }

  return null;
}

export function requireVercelToken() {
  const token = readVercelToken();
  if (!token) {
    console.error('[vercel] VERCEL_TOKEN not found');
    console.error('[vercel]   Add to .env:  VERCEL_TOKEN=…');
    console.error('[vercel]   Or: pnpm dlx vercel@latest login');
    console.error('[vercel]   Create token: https://vercel.com/account/tokens');
    process.exit(1);
  }
  return token;
}

export function isRateLimitError(message) {
  return /rate|limited|api-deployments-free|100/i.test(message || '');
}
