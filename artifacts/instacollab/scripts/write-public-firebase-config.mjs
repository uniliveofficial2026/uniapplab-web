#!/usr/bin/env node
/**
 * Write public/firebase-config.json before Vite build (OAuth backup lane).
 */
import fs from 'node:fs';
import path from 'node:path';
import { findEnvFile, getAppRoot, getWorkspaceRoot, readEnvFile } from './resolveProjectEnv.mjs';

function loadBuildEnv() {
  const appRoot = getAppRoot(import.meta.dirname);
  const repoRoot = getWorkspaceRoot(appRoot);
  const merged = { ...readEnvFile(findEnvFile(import.meta.dirname)) };
  for (const dir of [appRoot, repoRoot]) {
    for (const name of ['.env.production', '.env.production.local', '.env', '.env.local']) {
      const file = path.join(dir, name);
      if (!fs.existsSync(file)) continue;
      for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const m = trimmed.match(/^([A-Z0-9_]+)=(.*)$/);
        if (!m) continue;
        merged[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
      }
    }
  }
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith('VITE_FIREBASE_') && value) merged[key] = value;
  }
  return merged;
}

const appRoot = getAppRoot(import.meta.dirname);
const outPath = path.join(appRoot, 'public', 'firebase-config.json');
const existing = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, 'utf8')) : null;
const env = loadBuildEnv();

const payload = {
  apiKey: (env.VITE_FIREBASE_API_KEY || existing?.apiKey || '').trim(),
  authDomain: (env.VITE_FIREBASE_AUTH_DOMAIN || existing?.authDomain || '').trim(),
  projectId: (env.VITE_FIREBASE_PROJECT_ID || existing?.projectId || '').trim(),
  storageBucket: (env.VITE_FIREBASE_STORAGE_BUCKET || existing?.storageBucket || '').trim(),
  messagingSenderId: (env.VITE_FIREBASE_MESSAGING_SENDER_ID || existing?.messagingSenderId || '').trim(),
  appId: (env.VITE_FIREBASE_APP_ID || existing?.appId || '').trim(),
  databaseURL: (env.VITE_FIREBASE_DATABASE_URL || existing?.databaseURL || '').trim() || undefined,
  measurementId: (env.VITE_FIREBASE_MEASUREMENT_ID || existing?.measurementId || '').trim() || undefined,
};

const required = ['apiKey', 'authDomain', 'projectId', 'appId'];
const missing = required.filter((key) => !payload[key] || /your[_-]?firebase/i.test(payload[key]));
if (missing.length) {
  if (existing?.apiKey && existing?.projectId) {
    fs.writeFileSync(outPath, `${JSON.stringify(existing, null, 2)}\n`);
    console.log(`[firebase-config] Kept existing ${outPath} (${existing.projectId})`);
    process.exit(0);
  }
  console.warn('[firebase-config] Firebase env missing — skipping write (Supabase-only build OK)');
  process.exit(0);
}

fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`[firebase-config] Wrote ${outPath} (${payload.projectId})`);
