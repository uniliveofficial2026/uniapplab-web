import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('upstash Vercel env sync requires the Supabase service role key', () => {
  const result = spawnSync(process.execPath, ['scripts/sync-upstash-vercel-env.mjs'], {
    cwd: ROOT,
    encoding: 'utf8',
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      CI: '1',
      PUBLIC_APP_ORIGIN: 'https://app.uniapplab.com',
      QSTASH_CURRENT_SIGNING_KEY: 'test-signing-key',
      QSTASH_TOKEN: 'test-qstash-token',
      SUPABASE_ANON_KEY: 'test-anon-key',
      SUPABASE_SERVICE_ROLE_KEY: '',
      SUPABASE_URL: 'https://example.supabase.co',
      UPSTASH_REDIS_REST_TOKEN: 'test-redis-token',
      UPSTASH_REDIS_REST_URL: 'https://example.upstash.io',
    },
  });

  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stderr, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(result.stdout, /Syncing server env to Vercel/);
});
