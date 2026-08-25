#!/usr/bin/env node
/**
 * Static gate: account switch / logout clears presence + session stores.
 *
 * Physical evidence key (NOT asserted here):
 *   physicalAccountSwitchAtoB — sign in as A, verify shell/presence/API actor,
 *   switch to B on same device, prove A presence/session/wallet/chat actor gone
 *   and B is sole actor. Record under docs/full-app-recovery/evidence/.
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

const handoff = fs.readFileSync(
  path.join(root, 'artifacts/instacollab/src/lib/auth/authHandoff.ts'),
  'utf8',
);
const presenceHb = fs.readFileSync(
  path.join(root, 'artifacts/instacollab/src/lib/presenceHeartbeat.ts'),
  'utf8',
);
const sessionMgr = fs.readFileSync(
  path.join(root, 'artifacts/instacollab/src/lib/auth/sessionManager.ts'),
  'utf8',
);

check(
  'signOutFast_posts_presence_offline',
  /postPresenceOffline/.test(handoff) && /signOutFast/.test(handoff),
  'authHandoff signOutFast must call postPresenceOffline',
);

check(
  'signOutFast_clears_session_cache',
  /clearSessionCache\(/.test(handoff) && /clearApiAuthHeaderCache\(/.test(handoff),
  'logout must clear session + API auth header caches',
);

check(
  'signOutFast_clears_identity_scoped_localStorage',
  /IDENTITY_SCOPED_STORAGE_PREFIXES/.test(handoff) && /localStorage\.removeItem/.test(handoff),
  'logout must strip identity-scoped localStorage keys',
);

check(
  'signOutFast_clears_push_person_binding',
  /clearPushPersonBindingOnLogout/.test(handoff),
  'logout must clear push PERSON binding',
);

check(
  'presence_heartbeat_stops_on_signed_out',
  /SIGNED_OUT/.test(presenceHb) &&
    /postPresenceOffline/.test(presenceHb) &&
    /function stopPresenceHeartbeat/.test(presenceHb) &&
    /clearTimer\(/.test(presenceHb),
  'presenceHeartbeat must pause/offline on SIGNED_OUT and export stopPresenceHeartbeat',
);

check(
  'sessionManager_logout_path',
  /logout\(/.test(sessionMgr) || /teardownCloudSession|db\.logout/.test(sessionMgr),
  'sessionManager must tear down local session on logout',
);

console.log(
  '\nEVIDENCE_REQUIRED physicalAccountSwitchAtoB — static gate cannot prove A→B isolation on device',
);

const failed = checks.filter((c) => !c.ok);
if (failed.length) {
  console.error(`\n${failed.length} account-switch isolation gate(s) failed`);
  process.exit(1);
}
console.log('\naccount-switch isolation static gates PASS');
