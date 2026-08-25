#!/usr/bin/env node
/**
 * test:n-user-dataflow — static N-user (A/B/C/D/…) identity + isolation contracts.
 * No pair-only QA branches; canonical PERSON = auth user.id.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const appSrc = path.join(root, 'artifacts/instacollab/src');
const apiRoutes = path.join(root, 'artifacts/api-server/src/routes');

const checks = [];
function check(name, ok, detail = '') {
  checks.push({ name, ok, detail });
  console.log(ok ? `PASS ${name}` : `FAIL ${name}${detail ? ` — ${detail}` : ''}`);
}

function read(relFromApp) {
  return fs.readFileSync(path.join(appSrc, relFromApp), 'utf8');
}

function readApi(file) {
  return fs.readFileSync(path.join(apiRoutes, file), 'utf8');
}

function walkTs(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules') continue;
      walkTs(full, acc);
    } else if (/\.(tsx?|jsx?)$/.test(ent.name)) {
      acc.push(full);
    }
  }
  return acc;
}

// 1. Comment author always from session, not client body
const authPosts = read('lib/db/domains/authPosts.ts');
check(
  'comment_enrich_uses_session_user_id',
  /enrichCommentPayload/.test(authPosts) && /userId:\s*meId/.test(authPosts),
);

// 2. buildCommentPayload uses author.id but enrich overrides on persist
const entityResolve = fs.readFileSync(path.join(appSrc, 'lib/entityResolve.ts'), 'utf8');
check('build_comment_payload_canonical_fields', /userId:\s*user\.id/.test(entityResolve));

// 3. Account switch generation guard (late response race)
const authProvider = read('lib/auth/AuthProvider.tsx');
check(
  'account_switch_generation_guard',
  /accountSwitchGenerationRef/.test(authProvider) &&
    /accountSwitchGenerationRef\.current !== switchGen/.test(authProvider),
);

// 4. Logout clears identity-scoped storage (generic N-user)
const authHandoff = fs.readFileSync(path.join(appSrc, 'lib/auth/authHandoff.ts'), 'utf8');
check(
  'signout_clears_identity_scoped_storage',
  /IDENTITY_SCOPED_STORAGE_PREFIXES/.test(authHandoff) && /signOutFast/.test(authHandoff),
);

// 5. No hardcoded qa_device / qa_mac / pair-only user branches in app source
const allAppFiles = walkTs(appSrc);
const forbidden = [];
for (const file of allAppFiles) {
  const src = fs.readFileSync(file, 'utf8');
  if (/qa_device|qa_mac|qa\.device|qa\.mac/.test(src)) forbidden.push(path.relative(appSrc, file));
  if (/if\s*\([^)]*user\s*===\s*['"]qa_/.test(src)) forbidden.push(path.relative(appSrc, file));
}
check('no_hardcoded_qa_user_branches', forbidden.length === 0, forbidden.join(', ') || '');

// 6. DM / chat routes use auth actor
const chatRoute = readApi('chat.ts');
check(
  'chat_route_auth_actor',
  /req\.authUser!\.id/.test(chatRoute) && !/body\.senderId/.test(chatRoute),
);

// 7. Wallet isolation
const walletRoute = readApi('wallet.ts');
check('wallet_route_auth_actor', /req\.authUser!\.id/.test(walletRoute));

// 8. Gifts sender from auth
const giftsRoute = readApi('gifts.ts');
check(
  'gifts_route_auth_sender',
  /req\.authUser!\.id/.test(giftsRoute) && /senderId\s*=\s*req\.authUser!\.id/.test(giftsRoute),
);

// 9. LiveKit token bound to auth user
const livekitRoute = readApi('livekit.ts');
check('livekit_route_auth_user', /req\.authUser!\.id/.test(livekitRoute));

// 10. Cache keys should not be bare ["messages"] without person scope (sample high-risk files)
const reactQueryFiles = allAppFiles.filter((f) => {
  const s = fs.readFileSync(f, 'utf8');
  return /useQuery|queryKey/.test(s);
});
let bareGlobalKeys = 0;
for (const file of reactQueryFiles) {
  const s = fs.readFileSync(file, 'utf8');
  if (/queryKey:\s*\[\s*['"](?:messages|wallet|profile)['"]\s*\]/.test(s)) bareGlobalKeys += 1;
}
check(
  'react_query_no_bare_global_person_keys',
  bareGlobalKeys === 0,
  bareGlobalKeys ? `${bareGlobalKeys} file(s) with bare person keys` : '',
);

const failed = checks.filter((c) => !c.ok);
if (failed.length) {
  console.error(`\n${failed.length} n-user dataflow gate(s) failed`);
  process.exit(1);
}
console.log('\nn-user-dataflow static gates PASS (generic A/B/C/D/…)');
