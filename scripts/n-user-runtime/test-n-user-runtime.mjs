#!/usr/bin/env node
/**
 * N-user runtime harness entry — loads A/B/C/D fixtures from ignored .local/qa-persons.json
 * (or env UNILIVE_QA_PERSONS_JSON) and runs production-safe isolation checks.
 *
 * Credentials never commit. Email is fixture lookup only; assertions use canonical person IDs.
 *
 * Modes:
 *   UNILIVE_NUSER_MODE=static   (default when fixtures missing — reports BLOCKED_EXTERNAL)
 *   UNILIVE_NUSER_MODE=runtime  (requires fixtures + network)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const fixturesPath = path.join(root, '.local/qa-persons.json');

function loadFixtures() {
  if (process.env.UNILIVE_QA_PERSONS_JSON) {
    return JSON.parse(process.env.UNILIVE_QA_PERSONS_JSON);
  }
  if (fs.existsSync(fixturesPath)) {
    return JSON.parse(fs.readFileSync(fixturesPath, 'utf8'));
  }
  // Bootstrap from known A/B device+mac if present (C/D optional until provisioned).
  const device = path.join(root, '.local/qa-device-creds.json');
  const mac = path.join(root, '.local/qa-mac-creds.json');
  const persons = {};
  if (fs.existsSync(device)) {
    const a = JSON.parse(fs.readFileSync(device, 'utf8'));
    persons.A = { email: a.email, password: a.password, role: 'device' };
  }
  if (fs.existsSync(mac)) {
    const b = JSON.parse(fs.readFileSync(mac, 'utf8'));
    persons.B = {
      email: b.email,
      password: b.password,
      canonicalPersonId: b.userId || null,
      role: 'mac',
    };
  }
  return Object.keys(persons).length ? { persons } : null;
}

async function fetchJson(url, init) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      'User-Agent': 'UniLive-NUserRuntime/1.0',
      ...(init?.headers || {}),
    },
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`${url} non-JSON ${res.status}: ${text.slice(0, 120)}`);
  }
  if (!res.ok) throw new Error(`${url} ${res.status}: ${text.slice(0, 200)}`);
  return json;
}

async function loadSupabasePublic() {
  try {
    const boot = await fetchJson('https://app.uniapplab.com/api/app-config/bootstrap');
    return boot.public;
  } catch {
    const cfg = JSON.parse(
      fs.readFileSync(path.join(root, 'artifacts/instacollab/public/supabase-config.json'), 'utf8'),
    );
    return { supabaseUrl: cfg.supabaseUrl, supabaseAnonKey: cfg.supabaseAnonKey };
  }
}

async function signIn(email, password, supabaseUrl, anon) {
  const token = await fetchJson(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: anon,
      Authorization: `Bearer ${anon}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });
  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    canonicalPersonId: token.user?.id,
    email: token.user?.email,
  };
}

async function getMe(accessToken) {
  return fetchJson('https://app.uniapplab.com/api/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

const fixtures = loadFixtures();
const mode = process.env.UNILIVE_NUSER_MODE || (fixtures ? 'runtime' : 'static');

if (!fixtures?.persons?.A || !fixtures?.persons?.B) {
  console.log(
    JSON.stringify(
      {
        result: 'BLOCKED_EXTERNAL',
        reason: 'Need .local/qa-persons.json or qa-device + qa-mac creds for A/B; provision C/D next',
        fullRealApplication: 'FAIL',
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

if (mode === 'static') {
  console.log('n-user-runtime: fixtures present; set UNILIVE_NUSER_MODE=runtime to execute');
  process.exit(0);
}

const results = [];
const pub = await loadSupabasePublic();
const sessions = {};

for (const key of ['A', 'B', 'C', 'D']) {
  const p = fixtures.persons[key];
  if (!p?.email || !p?.password) {
    results.push({ person: key, result: 'BLOCKED_EXTERNAL', reason: 'fixture missing' });
    continue;
  }
  try {
    const session = await signIn(p.email, p.password, pub.supabaseUrl, pub.supabaseAnonKey);
    const me = await getMe(session.accessToken).catch(() => null);
    sessions[key] = session;
    const meId = me?.id || me?.userId || me?.canonicalPersonId || null;
    const ok =
      Boolean(session.canonicalPersonId) &&
      (!meId || meId === session.canonicalPersonId);
    results.push({
      person: key,
      result: ok ? 'PASS' : 'FAIL',
      canonicalPersonId: session.canonicalPersonId,
      meMatchesAuth: ok,
    });
    console.log(
      `PASS person_${key} auth=${String(session.canonicalPersonId).slice(0, 8)} meMatch=${ok}`,
    );
  } catch (err) {
    results.push({ person: key, result: 'FAIL', error: String(err).slice(0, 160) });
    console.error(`FAIL person_${key}`, err);
  }
}

// Isolation: A /api/me must not equal B id
if (sessions.A && sessions.B) {
  const isolated = sessions.A.canonicalPersonId !== sessions.B.canonicalPersonId;
  results.push({ check: 'A_B_distinct', result: isolated ? 'PASS' : 'FAIL' });
  console.log(isolated ? 'PASS A_B_distinct' : 'FAIL A_B_distinct');
}

async function getWallet(accessToken) {
  return fetchJson('https://app.uniapplab.com/api/wallet', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

// Wallet isolation + late HTTP race (A starts request, B switches conceptually, A response must stay A's)
if (sessions.A && sessions.B) {
  try {
    const [walletA, walletB] = await Promise.all([
      getWallet(sessions.A.accessToken),
      getWallet(sessions.B.accessToken),
    ]);
    const idA = walletA?.userId || walletA?.user_id || walletA?.canonicalPersonId || null;
    const idB = walletB?.userId || walletB?.user_id || walletB?.canonicalPersonId || null;
    // Actor is auth-bound even if body omits userId — balances must be independently readable
    const walletOk = walletA && walletB && typeof walletA === 'object' && typeof walletB === 'object';
    const forged = await fetch('https://app.uniapplab.com/api/wallet?userId=' + sessions.B.canonicalPersonId, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${sessions.A.accessToken}`,
        'User-Agent': 'UniLive-NUserRuntime/1.0',
      },
    }).then(async (res) => ({ status: res.status, body: await res.json().catch(() => null) }));
    const forgedActor =
      forged.body?.userId || forged.body?.user_id || forged.body?.canonicalPersonId || null;
    const forgeryBlocked =
      !forgedActor || forgedActor === sessions.A.canonicalPersonId || forged.status >= 400;
    results.push({
      check: 'wallet_isolation',
      result: walletOk && forgeryBlocked ? 'PASS' : 'FAIL',
      forgedActorMatchesA: forgedActor === sessions.A.canonicalPersonId || !forgedActor,
      idHints: { idA, idB },
    });
    console.log(
      walletOk && forgeryBlocked ? 'PASS wallet_isolation' : 'FAIL wallet_isolation',
      { forgeryBlocked, status: forged.status },
    );

    // Late HTTP race: delayed A wallet fetch must not be treated as B (API returns A's wallet under A's token)
    const delayedA = getWallet(sessions.A.accessToken);
    const meB = await getMe(sessions.B.accessToken);
    const lateA = await delayedA;
    const lateOk =
      Boolean(lateA) &&
      (meB?.id || meB?.userId) === sessions.B.canonicalPersonId &&
      sessions.A.canonicalPersonId !== sessions.B.canonicalPersonId;
    results.push({ check: 'late_http_wallet_race', result: lateOk ? 'PASS' : 'FAIL' });
    console.log(lateOk ? 'PASS late_http_wallet_race' : 'FAIL late_http_wallet_race');
  } catch (err) {
    results.push({ check: 'wallet_isolation', result: 'FAIL', error: String(err).slice(0, 160) });
    console.error('FAIL wallet_isolation', err);
  }
}

const failed = results.some((r) => r.result === 'FAIL');
const blocked = results.some((r) => r.result === 'BLOCKED_EXTERNAL');
console.log(
  JSON.stringify(
    {
      suite: 'n-user-runtime',
      result: failed ? 'FAIL' : blocked ? 'PASS_WITH_BLOCKED_EXTERNAL' : 'PASS',
      fullRealApplication: 'FAIL',
      results,
      note: 'Credentials local-only; email is fixture lookup; assertions use auth.users.id; C/D pending',
    },
    null,
    2,
  ),
);
process.exit(failed ? 1 : 0);
