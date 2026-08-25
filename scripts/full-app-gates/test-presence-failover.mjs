#!/usr/bin/env node
/**
 * Static (+ optional live) gate: presence failover chain.
 * - presence.ts: upstash → postgres → memory
 * - migration presence_ephemeral exists
 * - Optional live probe when FULL_APP_QA_EMAIL + FULL_APP_QA_PASSWORD are set
 *   (never prints tokens)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const checks = [];
function check(name, ok, detail = '') {
  checks.push({ name, ok, detail });
  console.log(ok ? `PASS ${name}` : `FAIL ${name}${detail ? ` — ${detail}` : ''}`);
}

const presence = fs.readFileSync(
  path.join(root, 'artifacts/api-server/src/routes/presence.ts'),
  'utf8',
);
const migration = path.join(
  root,
  'supabase/migrations/20260825120000_presence_ephemeral.sql',
);

check(
  'presence_upstash_try_helpers',
  /tryUpstash/.test(presence) && /isUpstashConfigured/.test(presence),
  'missing Upstash branch',
);

check(
  'presence_postgres_try_helpers',
  /tryPostgres/.test(presence) &&
    /postgresSetUserOnline/.test(presence) &&
    /postgresIsUserOnline/.test(presence),
  'missing Postgres failover branch',
);

check(
  'presence_memory_failover',
  /memorySetUserOnline/.test(presence) && /memoryIsUserOnline/.test(presence),
  'missing in-memory failover branch',
);

check(
  'presence_actor_is_authUser',
  /const userId = req\.authUser!\.id/.test(presence) &&
    /router\.(get|post)\("\/presence\/online"/.test(presence) &&
    /router\.post\("\/presence\/offline"/.test(presence),
  'presence routes must auth and use req.authUser!.id',
);

check(
  'presence_ephemeral_migration_exists',
  fs.existsSync(migration) &&
    fs.readFileSync(migration, 'utf8').includes('create table if not exists public.presence_ephemeral'),
  'missing supabase/migrations/20260825120000_presence_ephemeral.sql',
);

async function optionalLiveProbe() {
  const email = process.env.FULL_APP_QA_EMAIL?.trim();
  const password = process.env.FULL_APP_QA_PASSWORD?.trim();
  if (!email || !password) {
    console.log('SKIP live_presence_probe — set FULL_APP_QA_EMAIL and FULL_APP_QA_PASSWORD to enable');
    return;
  }

  const base = (process.env.FULL_APP_QA_BASE_URL || 'https://app.uniapplab.com').replace(/\/$/, '');
  const supabaseUrl = process.env.FULL_APP_QA_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseAnon =
    process.env.FULL_APP_QA_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnon) {
    check(
      'live_presence_probe_env',
      false,
      'QA email/password set but missing FULL_APP_QA_SUPABASE_URL / anon key',
    );
    return;
  }

  const tokenRes = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: supabaseAnon,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });
  if (!tokenRes.ok) {
    check('live_presence_probe_login', false, `supabase login HTTP ${tokenRes.status}`);
    return;
  }
  const tokenJson = await tokenRes.json();
  const accessToken = tokenJson.access_token;
  if (!accessToken) {
    check('live_presence_probe_login', false, 'no access_token in response');
    return;
  }

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'X-Device-Id': `gate-presence-${Date.now()}`,
  };

  const post = await fetch(`${base}/api/presence/online`, {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  });
  const postBody = await post.json().catch(() => ({}));
  const backend = String(postBody.backend || '');
  const online = postBody.online === true;
  const backendOk = backend === 'postgres' || backend === 'upstash' || backend === 'memory';

  check(
    'live_presence_post_online',
    post.status === 200 && online && backendOk,
    `status=${post.status} online=${postBody.online} backend=${backend || 'n/a'}`,
  );

  // Do not print tokens / full bodies with secrets
  console.log(`live_presence_backend=${backend || 'n/a'} online=${online}`);
}

await optionalLiveProbe();

const failed = checks.filter((c) => !c.ok);
if (failed.length) {
  console.error(`\n${failed.length} presence-failover gate(s) failed`);
  process.exit(1);
}
console.log('\npresence-failover gates PASS');
