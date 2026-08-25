#!/usr/bin/env node
/**
 * Static gate: user identity SSOT on critical API routes.
 * - chat / gifts / wallet / livekit / stream / me actors use req.authUser!.id
 * - email is not used as ownership FK in those route files
 * - auth middleware documents Firebase → auth_identities mapping
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

const critical = {
  'chat.ts': [/req\.authUser!\.id/, /senderId\s*=\s*req\.authUser!\.id|userId\s*=\s*req\.authUser!\.id/],
  'gifts.ts': [/req\.authUser!\.id/, /senderId\s*=\s*req\.authUser!\.id/],
  'wallet.ts': [/req\.authUser!\.id/, /fromUser\s*=\s*req\.authUser!\.id|userId\s*=\s*req\.authUser!\.id|buyerId\s*=\s*req\.authUser!\.id/],
  'livekit.ts': [/req\.authUser!\.id/],
  'stream.ts': [/req\.authUser!\.id/],
  'me.ts': [/req\.authUser!\.id/, /req\.authUser!/],
};

for (const [file, patterns] of Object.entries(critical)) {
  const full = path.join(routesDir, file);
  const src = fs.readFileSync(full, 'utf8');
  check(
    `${file}_uses_authUser_id`,
    patterns.every((re) => re.test(src)),
    'missing req.authUser!.id actor pattern',
  );
  check(
    `${file}_no_email_ownership_fk`,
    !/\.eq\(\s*['"]email['"]|\.eq\(\s*['"]username['"]\s*,\s*(?:req\.body|body)/.test(src) &&
      !/(?:userId|senderId|ownerId|personId)\s*=\s*(?:[^;\n]*email|[^;\n]*username)/i.test(src),
    'email/username appears used as ownership key',
  );
  check(
    `${file}_no_body_sender_as_actor`,
    !/senderId\s*=\s*(?:String\()?[^;\n]*body\.senderId/.test(src) &&
      !/personId\s*=\s*(?:String\()?[^;\n]*body\.personId/.test(src),
    'trusts body.senderId/personId as actor',
  );
}

const authSrc = fs.readFileSync(authMw, 'utf8');
check(
  'auth_middleware_firebase_auth_identities_contract',
  /auth_identities/.test(authSrc) &&
    /Firebase token → verified provider subject → auth_identities → canonical user_id/.test(authSrc) &&
    /Email is never used as the identity key/.test(authSrc) &&
    /resolveOrLinkAuthIdentity/.test(authSrc),
  'missing Firebase→auth_identities comment/contract',
);

check(
  'auth_middleware_rejects_body_userId_impersonation',
  /error\.impersonation/.test(authSrc) && /body\?\.userId/.test(authSrc),
  'missing body userId impersonation guard',
);

const failed = checks.filter((c) => !c.ok);
if (failed.length) {
  console.error(`\n${failed.length} user-identity SSOT gate(s) failed`);
  process.exit(1);
}
console.log('\nuser-identity SSOT gates PASS');
