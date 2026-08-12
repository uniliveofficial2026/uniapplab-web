import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Walk up from this package to the monorepo root (contains pnpm-workspace.yaml). */
export function findRepoRoot(start = __dirname): string {
  let dir = resolve(start);
  for (let i = 0; i < 12; i++) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return resolve(process.cwd());
}

export const REPO_ROOT = findRepoRoot();
export const ENV_LOCAL_PATH = join(REPO_ROOT, '.env.local');

function parseEnvFile(contents: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of contents.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

let cached: Record<string, string> | null = null;

/** Load root `.env.local` into process.env (does not overwrite already-set vars). Never logs values. */
export function loadEnvLocal(): Record<string, string> {
  if (cached) return cached;
  if (!existsSync(ENV_LOCAL_PATH)) {
    cached = {};
    return cached;
  }
  const parsed = parseEnvFile(readFileSync(ENV_LOCAL_PATH, 'utf8'));
  for (const [k, v] of Object.entries(parsed)) {
    if (process.env[k] === undefined) process.env[k] = v;
  }
  cached = parsed;
  return cached;
}

export function envGet(name: string): string {
  loadEnvLocal();
  return (process.env[name] ?? '').trim();
}

export function envTruthy(name: string, fallback = false): boolean {
  const v = envGet(name).toLowerCase();
  if (!v) return fallback;
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

export function envInt(name: string, fallback: number): number {
  const n = Number.parseInt(envGet(name), 10);
  return Number.isFinite(n) ? n : fallback;
}

export interface AssetStudioSafetyConfig {
  dryRun: boolean;
  maxPaidCalls: number;
  autoRetry: boolean;
  requireApproval: boolean;
  openaiImageModel: string;
}

export function getSafetyConfig(): AssetStudioSafetyConfig {
  loadEnvLocal();
  return {
    dryRun: envTruthy('ASSET_STUDIO_DRY_RUN', true),
    maxPaidCalls: Math.max(0, envInt('ASSET_STUDIO_MAX_PAID_CALLS', 1)),
    autoRetry: envTruthy('ASSET_STUDIO_AUTO_RETRY', false),
    requireApproval: envTruthy('ASSET_STUDIO_REQUIRE_APPROVAL', true),
    openaiImageModel: envGet('OPENAI_IMAGE_MODEL') || 'gpt-image-2',
  };
}

export function assertNoViteSecrets(): string[] {
  loadEnvLocal();
  const bad: string[] = [];
  const needle = ['OPENAI', 'MESHY', 'RUNWAY', 'KLING', 'ELEVEN', 'SECRET', 'SERVICE_ROLE'];
  for (const key of Object.keys(process.env)) {
    if (!key.startsWith('VITE_')) continue;
    if (needle.some((n) => key.includes(n))) bad.push(key);
  }
  return bad;
}
