#!/usr/bin/env node
/**
 * test:n-user-authorization — cross-user forgery / impersonation static gates.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const routesDir = path.join(root, 'artifacts/api-server/src/routes');
const authMw = path.join(root, 'artifacts/api-server/src/middlewares/auth.ts');

const checks = [];
function check(name, ok, detail = '') {
  checks.push({ name, ok, detail });
  console.log(ok ? `PASS ${name}` : `FAIL ${name}${detail ? ` — ${detail}` : ''}`);
}

const routeFiles = fs.readdirSync(routesDir).filter((f) => f.endsWith('.ts'));
const actorBodyPatterns = [
  /senderId\s*=\s*(?:String\()?[^;\n]*req\.body/,
  /authorId\s*=\s*(?:String\()?[^;\n]*req\.body/,
  /ownerId\s*=\s*(?:String\()?[^;\n]*req\.body/,
  /buyerId\s*=\s*(?:String\()?[^;\n]*req\.body/,
  /personId\s*=\s*(?:String\()?[^;\n]*req\.body/,
];

const protectedRoutes = [
  'chat.ts',
  'gifts.ts',
  'wallet.ts',
  'livekit.ts',
  'stream.ts',
  'me.ts',
  'marketplace.ts',
  'seller.ts',
  'social.ts',
  'posts.ts',
].filter((f) => fs.existsSync(path.join(routesDir, f)));

for (const file of protectedRoutes) {
  const src = fs.readFileSync(path.join(routesDir, file), 'utf8');
  const trustsBodyActor = actorBodyPatterns.some((re) => re.test(src));
  check(`${file}_no_body_actor_spoof`, !trustsBodyActor, trustsBodyActor ? 'trusts body actor id' : '');
  if (/req\.authUser/.test(src)) {
    check(`${file}_uses_auth_user`, /req\.authUser!\.id|req\.authUser\.id/.test(src));
  }
}

const authSrc = fs.readFileSync(authMw, 'utf8');
check(
  'auth_middleware_impersonation_guard',
  /body\?\.userId/.test(authSrc) && /impersonation/.test(authSrc),
);

// Client comment forgery rejected at enrich layer
const authPosts = fs.readFileSync(
  path.join(root, 'artifacts/instacollab/src/lib/db/domains/authPosts.ts'),
  'utf8',
);
check(
  'client_comment_forgery_stripped',
  /enrichCommentPayload/.test(authPosts) && /userId:\s*meId/.test(authPosts),
);

const failed = checks.filter((c) => !c.ok);
if (failed.length) {
  console.error(`\n${failed.length} n-user authorization gate(s) failed`);
  process.exit(1);
}
console.log('\nn-user-authorization static gates PASS');
