import fs from 'node:fs';
import path from 'node:path';

/** App root = artifacts/instacollab (parent of scripts/). */
export function getAppRoot(fromDir = import.meta.dirname) {
  return path.resolve(fromDir, '..');
}

export function getWorkspaceRoot(appRoot = getAppRoot()) {
  return path.resolve(appRoot, '../..');
}

/** First existing `.env` among app, monorepo root, legacy attached_assets copy. */
export function findEnvFile(fromDir = import.meta.dirname) {
  const appRoot = getAppRoot(fromDir);
  const workspaceRoot = getWorkspaceRoot(appRoot);
  const legacyRoot = path.resolve(
    workspaceRoot,
    'attached_assets/extracted/remix_-instacollab',
  );
  for (const dir of [appRoot, workspaceRoot, legacyRoot]) {
    const envPath = path.join(dir, '.env');
    if (fs.existsSync(envPath)) return envPath;
  }
  return path.join(appRoot, '.env');
}

export function readEnvFile(envPath = findEnvFile()) {
  if (!fs.existsSync(envPath)) return {};
  const env = {};
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const m = trimmed.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

export function supabaseProjectRefFromEnv(envPath = findEnvFile()) {
  const env = readEnvFile(envPath);
  const url = env.VITE_SUPABASE_URL || '';
  if (!url) return null;
  try {
    return new URL(url).hostname.split('.')[0] || null;
  } catch {
    return null;
  }
}
