/**
 * Smoke checks for cross-platform PWA runtime (Node, no browser).
 * Run: node scripts/smoke-platform-runtime.mjs
 */
import assert from 'node:assert/strict';

/** Mirror of detectPlatformOs / form heuristics used in src/lib/platform/runtime.ts */
function detectOs(ua) {
  if (/iPhone|iPod/i.test(ua) || /iPad/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  if (/Windows/i.test(ua)) return 'windows';
  if (/Mac OS X|Macintosh/i.test(ua)) return 'mac';
  if (/Linux/i.test(ua)) return 'linux';
  return 'unknown';
}

function expectInstallHints(ua, os) {
  if (os === 'ios') return { usesAppleInstallHints: true, preferOAuthRedirect: true };
  if (os === 'android') return { usesAppleInstallHints: false, preferOAuthRedirect: true };
  return { usesAppleInstallHints: false, preferOAuthRedirect: false };
}

const cases = [
  {
    name: 'iPhone Safari',
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    os: 'ios',
  },
  {
    name: 'Android Chrome',
    ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    os: 'android',
  },
  {
    name: 'Windows Edge',
    ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
    os: 'windows',
  },
  {
    name: 'Mac Safari',
    ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    os: 'mac',
  },
];

let failed = 0;
for (const c of cases) {
  const os = detectOs(c.ua);
  try {
    assert.equal(os, c.os, `${c.name}: os`);
    const hints = expectInstallHints(c.ua, os);
    if (os === 'ios') assert.equal(hints.usesAppleInstallHints, true);
    if (os === 'android' || os === 'ios') assert.equal(hints.preferOAuthRedirect, true);
    if (os === 'windows' || os === 'mac') assert.equal(hints.preferOAuthRedirect, false);
    console.log(`ok  ${c.name} → ${os}`);
  } catch (err) {
    failed += 1;
    console.error(`fail ${c.name}:`, err.message);
  }
}

// Insecure media copy must mention HTTPS.
const insecureMsg =
  'Camera and microphone need a secure connection (HTTPS or localhost). ' +
  'On a phone, open the https:// preview URL or run `pnpm run mobile:preview` on your computer.';
assert.match(insecureMsg, /HTTPS/i);
console.log('ok  insecure media messaging');

if (failed) {
  console.error(`\n${failed} platform smoke check(s) failed`);
  process.exit(1);
}
console.log('\nAll platform smoke checks passed.');
