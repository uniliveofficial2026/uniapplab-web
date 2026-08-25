#!/usr/bin/env node
/**
 * Physical iPhone Cap session handoff — real Supabase QA session into Cap WebView.
 * Does NOT invent identity. Uses existing QA creds from ignored .local file or env.
 *
 * Usage:
 *   node scripts/device-qa/iphone-session-handoff.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

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

const creds = loadCreds();
const boot = await fetch('https://app.uniapplab.com/api/app-config/bootstrap').then((r) => r.json());
const sb = createClient(boot.public.supabaseUrl, boot.public.supabaseAnonKey);
const { data, error } = await sb.auth.signInWithPassword({
  email: creds.email,
  password: creds.password,
});
if (error) throw error;
const s = data.session;
const me = await fetch('https://app.uniapplab.com/api/me', {
  headers: { Authorization: `Bearer ${s.access_token}` },
}).then((r) => r.json());

const hash = new URLSearchParams({
  access_token: s.access_token,
  refresh_token: s.refresh_token,
  expires_in: String(s.expires_in || 3600),
  token_type: 'bearer',
  type: 'magiclink',
}).toString();

const urls = [
  `https://app.uniapplab.com/home#${hash}`,
  `com.uniapplab.unilive://auth/callback#${hash}`,
];

const mode = process.env.UNILIVE_HANDOFF_MODE === 'scheme' ? 1 : 0;
const url = urls[mode];

console.log(
  JSON.stringify(
    {
      uid: String(s.user.id).slice(0, 8),
      profileSetupComplete: me.profileSetupComplete,
      username: me.username || me.publicUserId,
      payload: url.split('#')[0] + '#<redacted>',
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
