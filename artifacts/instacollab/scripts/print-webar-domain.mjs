#!/usr/bin/env node
/**
 * Print Tencent WebAR license domain checklist.
 * Domain mismatch (SDK code 104) = page hostname ≠ Web License “Domain”.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = ['.env', '.env.local'].map((f) => path.join(root, f)).find((p) => fs.existsSync(p));

function readEnv(key) {
  if (!envPath) return '';
  const line = fs.readFileSync(envPath, 'utf8').split('\n').find((l) => l.startsWith(`${key}=`));
  return line ? line.slice(key.length + 1).trim() : '';
}

const appId = readEnv('VITE_TENCENT_WEBAR_APP_ID');
const hasKey = Boolean(readEnv('VITE_TENCENT_WEBAR_LICENSE_KEY'));
const hasToken = Boolean(readEnv('VITE_TENCENT_WEBAR_TOKEN'));

console.log('');
console.log('Tencent WebAR — Web License domain');
console.log('──────────────────────────────────');
console.log(`  App ID:     ${appId || '(missing)'}`);
console.log(`  LicenseKey: ${hasKey ? 'set' : 'missing'}`);
console.log(`  Token:      ${hasToken ? 'set' : 'missing'}`);
console.log('');
console.log('  Console: https://console.tencentcloud.com/x-rtc/effect/web-license');
console.log('  Docs:    https://www.tencentcloud.com/document/product/1143/54277');
console.log('');
console.log('  Bind Domain for production:');
console.log('    app.uniapplab.com');
console.log('  Always allowed without binding:');
console.log('    localhost   (NOT 127.0.0.1 — use http://localhost:5173)');
console.log('');
console.log('  Trial license → Edit can change domain.');
console.log('  Official license → domain is fixed; create a new license for another host.');
console.log('');
console.log('  Note: correct License Key/Token still fail with domain mismatch when');
console.log('  the page hostname is not the Domain bound on that Web License.');
console.log('  Do not put a second VITE_TENCENT_WEBAR_* set in repo-root .env.local');
console.log('  (it can override the keys you expect).');
console.log('');
