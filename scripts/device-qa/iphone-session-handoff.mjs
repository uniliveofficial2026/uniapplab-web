#!/usr/bin/env node
/**
 * Physical iPhone Cap session handoff — real Supabase QA session into Cap WebView.
 *
 * Modes:
 *   UNILIVE_HANDOFF_MODE=scheme  (default) custom scheme + access+refresh hash
 *   UNILIVE_HANDOFF_MODE=https   https://app.uniapplab.com/home#tokens
 *   UNILIVE_HANDOFF_MODE=query   custom scheme ?rt= refresh-only (needs new SPA)
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const udid = process.env.UNILIVE_IPHONE_UDID || '04E86E0A-14A3-524B-919C-EB7C477083EE';
const bundle = 'com.uniapplab.unilive';

function loadCreds() {
  if (process.env.UNILIVE_QA_EMAIL && process.env.UNILIVE_QA_PASSWORD) {
    return { email: process.env.UNILIVE_QA_EMAIL, password: process.env.UNILIVE_QA_PASSWORD };
  }
  const p = path.join(root, '.local/qa-device-creds.json');
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

async function fetchJson(url, init) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      'User-Agent': 'UniLive-DeviceQA/1.0',
      ...(init?.headers || {}),
    },
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`${url} returned non-JSON (${res.status}): ${text.slice(0, 120)}`);
  }
  if (!res.ok) throw new Error(`${url} ${res.status}: ${text.slice(0, 200)}`);
  return json;
}

const creds = loadCreds();
const boot = await fetchJson('https://app.uniapplab.com/api/app-config/bootstrap');
const supabaseUrl = boot.public.supabaseUrl;
const anon = boot.public.supabaseAnonKey;

const tokenJson = await fetchJson(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: {
    apikey: anon,
    Authorization: `Bearer ${anon}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ email: creds.email, password: creds.password }),
});

const access = tokenJson.access_token;
const refresh = tokenJson.refresh_token;
const uid = tokenJson.user?.id;
const me = await fetchJson('https://app.uniapplab.com/api/me', {
  headers: { Authorization: `Bearer ${access}` },
});

const dualHash = new URLSearchParams({
  access_token: access,
  refresh_token: refresh,
  expires_in: String(tokenJson.expires_in || 3600),
  token_type: 'bearer',
  type: 'magiclink',
}).toString();

const refreshOnlyHash = new URLSearchParams({
  refresh_token: refresh,
  type: 'recovery',
}).toString();

const urls = {
  https: `https://app.uniapplab.com/home#${dualHash}`,
  scheme: `com.uniapplab.unilive://auth/callback#${dualHash}`,
  query: `com.uniapplab.unilive://auth/callback?rt=${encodeURIComponent(refresh)}`,
  refresh: `com.uniapplab.unilive://auth/callback#${refreshOnlyHash}`,
};

const mode = process.env.UNILIVE_HANDOFF_MODE || 'scheme';
const url = urls[mode] || urls.scheme;

console.log(
  JSON.stringify(
    {
      uid: String(uid || '').slice(0, 8),
      profileSetupComplete: me.profileSetupComplete,
      username: me.username || me.publicUserId,
      mode,
      payloadLen: url.length,
      payload: url.replace(access, '<access>').replace(refresh, '<refresh>'),
    },
    null,
    2,
  ),
);

const r = spawnSync(
  'xcrun',
  [
    'devicectl',
    'device',
    'process',
    'launch',
    '--device',
    udid,
    '--terminate-existing',
    '--payload-url',
    url,
    bundle,
  ],
  { encoding: 'utf8', timeout: 90_000 },
);
if (r.status !== 0) {
  console.error(r.stderr || r.stdout);
  process.exit(r.status || 1);
}
console.log('LAUNCH_OK');
