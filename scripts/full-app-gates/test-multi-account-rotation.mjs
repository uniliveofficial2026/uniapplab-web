#!/usr/bin/env node
/**
 * test:multi-account-rotation — A→B→C→D→A static handoff contracts.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const appSrc = path.join(root, 'artifacts/instacollab/src');

const checks = [];
function check(name, ok, detail = '') {
  checks.push({ name, ok, detail });
  console.log(ok ? `PASS ${name}` : `FAIL ${name}${detail ? ` — ${detail}` : ''}`);
}

const handoff = fs.readFileSync(path.join(appSrc, 'lib/auth/authHandoff.ts'), 'utf8');
const authProvider = fs.readFileSync(path.join(appSrc, 'lib/auth/AuthProvider.tsx'), 'utf8');
const sessionMgr = fs.readFileSync(path.join(appSrc, 'lib/auth/sessionManager.ts'), 'utf8');
const presenceHb = fs.readFileSync(path.join(appSrc, 'lib/presenceHeartbeat.ts'), 'utf8');

check('signout_clears_session_cache', /clearSessionCache\(/.test(handoff));
check('signout_clears_api_auth_header', /clearApiAuthHeaderCache\(/.test(handoff));
check('signout_teardowns_local_db', /finalizeLocalAuthSession/.test(handoff) && /db\.logout/.test(handoff));
check('signout_ends_host_media', /endHostMediaSession\('logout'\)/.test(handoff));
check('signout_clears_push_binding', /clearPushPersonBindingOnLogout/.test(handoff));

check(
  'account_switch_stale_async_guard',
  /accountSwitchGenerationRef/.test(authProvider),
  'generation ref for A/B/C/D rotation',
);

check(
  'session_manager_teardown',
  /teardownCloudSession/.test(sessionMgr) || /logout/.test(sessionMgr),
);

check(
  'presence_stops_on_signout',
  /SIGNED_OUT/.test(presenceHb) && /stopPresenceHeartbeat|postPresenceOffline/.test(presenceHb),
);

// db.logout must exist and be invoked on handoff
const dbLayers = fs.readFileSync(path.join(appSrc, 'lib/db/layers.ts'), 'utf8');
const authPosts = fs.readFileSync(path.join(appSrc, 'lib/db/domains/authPosts.ts'), 'utf8');
check('local_db_logout_exported', /logout\s*\(\)/.test(dbLayers) && /logout\s*\(\)/.test(authPosts));

console.log(
  '\nEVIDENCE_REQUIRED physicalAccountRotationABCD — static gate; device must run A→B→C→D→A',
);

const failed = checks.filter((c) => !c.ok);
if (failed.length) {
  console.error(`\n${failed.length} multi-account rotation gate(s) failed`);
  process.exit(1);
}
console.log('\nmulti-account-rotation static gates PASS');
