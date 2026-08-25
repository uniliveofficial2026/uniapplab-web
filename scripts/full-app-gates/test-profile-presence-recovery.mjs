#!/usr/bin/env node
/**
 * Production-like gate: authenticated session with profile_setup_complete
 * must not remain on profile setup forever after legal+continue+trending.
 * Also asserts UniApplab hosts do not prefer broken Edge Function presence URLs.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const platformApi = fs.readFileSync(
  path.join(root, 'artifacts/instacollab/src/lib/platformApi.ts'),
  'utf8',
);

const checks = [];
function check(name, ok, detail = '') {
  checks.push({ name, ok, detail });
  console.log(ok ? `PASS ${name}` : `FAIL ${name}${detail ? ` — ${detail}` : ''}`);
}

check(
  'preferSameOriginApi_blocks_edge_on_uniapplab',
  platformApi.includes('function preferSameOriginApi()') &&
    platformApi.includes('preferSameOriginApi()') &&
    /if \(preferSameOriginApi\(\)\) return null;/.test(platformApi),
);

check(
  'edge_404_falls_back_to_express',
  /if \(res\.status === 404\) return null;/.test(platformApi),
);

const cloudProfile = fs.readFileSync(
  path.join(root, 'artifacts/instacollab/src/lib/auth/cloudProfile.ts'),
  'utf8',
);
check(
  'supabase_auth_skips_firebase_id_hang',
  cloudProfile.includes('isSupabaseAuthUserId(exceptUserId)') &&
    cloudProfile.includes('withAvailabilityTimeout'),
);

const presence = fs.readFileSync(
  path.join(root, 'artifacts/api-server/src/routes/presence.ts'),
  'utf8',
);
check(
  'presence_has_postgres_and_memory_failover',
  presence.includes('postgresSetUserOnline') && presence.includes('memorySetUserOnline'),
);

const failed = checks.filter((c) => !c.ok);
if (failed.length) {
  console.error(`\n${failed.length} gate(s) failed`);
  process.exit(1);
}
console.log('\nprofile-to-home / presence source gates PASS');
