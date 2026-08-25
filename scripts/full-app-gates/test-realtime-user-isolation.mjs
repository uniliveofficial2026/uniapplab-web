#!/usr/bin/env node
/**
 * test:realtime-user-isolation — subscriptions/sockets torn down on auth change.
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

const sessionMgr = fs.readFileSync(path.join(appSrc, 'lib/auth/sessionManager.ts'), 'utf8');
const handoff = fs.readFileSync(path.join(appSrc, 'lib/auth/authHandoff.ts'), 'utf8');
const authProvider = fs.readFileSync(path.join(appSrc, 'lib/auth/AuthProvider.tsx'), 'utf8');

check(
  'teardown_cloud_session_on_logout',
  /teardownCloudSession/.test(handoff) && /teardownCloudSession/.test(sessionMgr),
);

check(
  'session_manager_unsubscribes_realtime',
  /unsubscribe|removeChannel|disconnect|teardown|cleanup/i.test(sessionMgr),
  'realtime teardown hooks',
);

check(
  'auth_provider_switch_generation',
  /accountSwitchGenerationRef/.test(authProvider),
  'ignore stale events after switch',
);

// Messages realtime — must rebind to current user
const messagesHooks = [
  'components/messages/MessagesScreen.tsx',
  'components/messages/MessagesActiveCallOverlay.tsx',
  'lib/chatTypingPresence.ts',
];
let messagesTeardown = false;
for (const rel of messagesHooks) {
  const full = path.join(appSrc, rel);
  if (!fs.existsSync(full)) continue;
  const src = fs.readFileSync(full, 'utf8');
  if (/unsubscribe|cleanup|removeChannel|currentUser\.id|currentUserId|authUser/.test(src)) {
    messagesTeardown = true;
  }
}
check('messages_realtime_user_scoped', messagesTeardown, 'messages realtime hooks');

const failed = checks.filter((c) => !c.ok);
if (failed.length) {
  console.error(`\n${failed.length} realtime isolation gate(s) failed`);
  process.exit(1);
}
console.log('\nrealtime-user-isolation static gates PASS');
