#!/usr/bin/env node
/**
 * CI-safe real-device / production mapping gate.
 * Does not require physical hardware. Fails closed on broken contracts.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LIVEKIT_CLIENT_IMPORT_ALLOWLIST,
  LIVEKIT_SERVER_IMPORT_ALLOWLIST,
} from './livekit-import-allowlist.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name === '.git' || ent.name === 'dist') continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, acc);
    else if (/\.(ts|tsx|mjs|js|cjs)$/.test(ent.name)) acc.push(p);
  }
  return acc;
}

function rel(p) {
  return path.relative(root, p).replaceAll('\\', '/');
}

function allowlisted(file, list) {
  const r = rel(file);
  return list.some((prefix) => r.startsWith(prefix) || r.includes(prefix));
}

const scanRoots = [
  path.join(root, 'artifacts/instacollab/src'),
  path.join(root, 'lib'),
  path.join(root, 'artifacts/api-server/src'),
];

for (const scanRoot of scanRoots) {
  for (const file of walk(scanRoot)) {
    const text = fs.readFileSync(file, 'utf8');
    if (/from\s+['"]livekit-client['"]/.test(text) || /require\(['"]livekit-client['"]\)/.test(text)) {
      if (!allowlisted(file, LIVEKIT_CLIENT_IMPORT_ALLOWLIST)) {
        failures.push(`livekit-client import outside allowlist: ${rel(file)}`);
      }
    }
    if (
      /from\s+['"]livekit-server-sdk['"]/.test(text) ||
      /require\(['"]livekit-server-sdk['"]\)/.test(text)
    ) {
      if (!allowlisted(file, LIVEKIT_SERVER_IMPORT_ALLOWLIST)) {
        failures.push(`livekit-server-sdk import outside allowlist: ${rel(file)}`);
      }
    }
  }
}

const lgp = path.join(
  root,
  'artifacts/instacollab/src/components/games/LocalGamePlayer.tsx',
);
if (fs.existsSync(lgp)) {
  const text = fs.readFileSync(lgp, 'utf8');
  if (!/import\.meta\.env\.DEV/.test(text) || !/allowLocalFixed/.test(text)) {
    failures.push('LocalGamePlayer must gate localhost fixed-server probe behind import.meta.env.DEV');
  }
  // Production path must not call tryLocalFixedServer unconditionally
  if (/tryLocalFixedServer\(/.test(text) && !/allowLocalFixed/.test(text)) {
    failures.push('LocalGamePlayer probes local fixed server without allowLocalFixed guard');
  }
}

const capCfg = path.join(root, 'artifacts/instacollab/capacitor.config.ts');
if (fs.existsSync(capCfg)) {
  const text = fs.readFileSync(capCfg, 'utf8');
  if (!/app\.uniapplab\.com/.test(text)) {
    failures.push('capacitor.config.ts must target app.uniapplab.com for production native');
  }
}

const requiredDocs = [
  'docs/real-device-qa/FUNCTION-MAP.md',
  'docs/real-device-qa/DATAFLOW-MAP.md',
  'docs/real-device-qa/RTC-MAP.md',
  'docs/real-device-qa/CAMERA-OWNERSHIP-AUDIT.md',
  'docs/real-device-qa/LIVEKIT-BOUNDARY-AUDIT.md',
  'docs/real-device-qa/FINAL-STATUS.json',
];
for (const d of requiredDocs) {
  if (!fs.existsSync(path.join(root, d))) failures.push(`missing required doc: ${d}`);
}

const statusPath = path.join(root, 'docs/real-device-qa/FINAL-STATUS.json');
if (fs.existsSync(statusPath)) {
  const status = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
  if (status.uiUxChanged !== false) failures.push('FINAL-STATUS.json uiUxChanged must be false');
  if (status.productionRtcApi !== 'UniLiveRTC') {
    failures.push('FINAL-STATUS.json productionRtcApi must be UniLiveRTC');
  }
  if (status.productionMediaProvider !== 'LiveKit') {
    failures.push('FINAL-STATUS.json productionMediaProvider must be LiveKit');
  }
  // Honesty: do not allow PASS for APNS without credential claim
  if (status.push === 'PASS' && !status.apnsCredentialPresent) {
    failures.push('push cannot be PASS without apnsCredentialPresent=true');
  }
}

const out = {
  ok: failures.length === 0,
  suite: 'real-device-mapping-gate',
  failures,
};
console.log(JSON.stringify(out, null, 2));
process.exit(failures.length ? 1 : 0);
