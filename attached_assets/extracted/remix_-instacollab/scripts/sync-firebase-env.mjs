#!/usr/bin/env node
/**
 * Writes VITE_FIREBASE_* into .env (never commit .env).
 *
 * Priority:
 *  1. firebase.web.config.json — paste your Firebase Console web config here
 *  2. google-services.json (partial)
 *  3. Built-in uchat web app defaults
 *
 * Run: npm run firebase:sync-env
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const envPath = join(root, '.env');
const googleServicesPath = join(root, 'google-services.json');
const webConfigPath = join(root, 'firebase.web.config.json');

/** Fallback when firebase.web.config.json is missing — paste real values locally only. */
const WEB_SDK_DEFAULTS = {
  VITE_FIREBASE_API_KEY: 'YOUR_FIREBASE_API_KEY',
  VITE_FIREBASE_AUTH_DOMAIN: 'your-project.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'your-project-id',
  VITE_FIREBASE_STORAGE_BUCKET: 'your-project.firebasestorage.app',
  VITE_FIREBASE_MESSAGING_SENDER_ID: '000000000000',
  VITE_FIREBASE_APP_ID: '1:000000000000:web:0000000000000000000000',
  VITE_FIREBASE_DATABASE_URL: 'https://your-project-default-rtdb.firebaseio.com',
  VITE_FIREBASE_MEASUREMENT_ID: 'G-XXXXXXXXXX',
};

function parseFirebaseConfigText(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    /* continue */
  }
  const objectMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!objectMatch) return null;
  try {
    return JSON.parse(objectMatch[0]);
  } catch {
    const relaxed = objectMatch[0]
      .replace(/(\w+)\s*:/g, '"$1":')
      .replace(/'/g, '"');
    try {
      return JSON.parse(relaxed);
    } catch {
      return null;
    }
  }
}

function mapFirebaseConfigToEnv(cfg) {
  if (!cfg || typeof cfg !== 'object') return null;
  return {
    VITE_FIREBASE_API_KEY: cfg.apiKey,
    VITE_FIREBASE_AUTH_DOMAIN: cfg.authDomain,
    VITE_FIREBASE_PROJECT_ID: cfg.projectId,
    VITE_FIREBASE_STORAGE_BUCKET: cfg.storageBucket,
    VITE_FIREBASE_MESSAGING_SENDER_ID: cfg.messagingSenderId,
    VITE_FIREBASE_APP_ID: cfg.appId,
    VITE_FIREBASE_DATABASE_URL: cfg.databaseURL,
    VITE_FIREBASE_MEASUREMENT_ID: cfg.measurementId,
  };
}

function loadFromWebConfigFile() {
  if (!existsSync(webConfigPath)) return null;
  const raw = readFileSync(webConfigPath, 'utf8');
  const cfg = parseFirebaseConfigText(raw);
  const mapped = mapFirebaseConfigToEnv(cfg);
  if (!mapped?.VITE_FIREBASE_API_KEY || !mapped.VITE_FIREBASE_APP_ID) {
    console.error(
      'firebase.web.config.json is missing apiKey or appId. Copy firebase.web.config.json.example and paste your values.'
    );
    process.exit(1);
  }
  console.log('Using firebase.web.config.json (your pasted Firebase web config)');
  return mapped;
}

function loadFromGoogleServices() {
  if (!existsSync(googleServicesPath)) return null;
  const json = JSON.parse(readFileSync(googleServicesPath, 'utf8'));
  const info = json.project_info;
  const client = json.client?.[0];
  if (!info || !client) return null;
  return {
    VITE_FIREBASE_PROJECT_ID: info.project_id,
    VITE_FIREBASE_STORAGE_BUCKET: info.storage_bucket,
    VITE_FIREBASE_MESSAGING_SENDER_ID: info.project_number,
    VITE_FIREBASE_DATABASE_URL: info.firebase_url,
    VITE_FIREBASE_AUTH_DOMAIN: `${info.project_id}.firebaseapp.com`,
    VITE_FIREBASE_API_KEY: client.api_key?.[0]?.current_key,
  };
}

const fromFile = loadFromWebConfigFile();
const vars = {
  ...WEB_SDK_DEFAULTS,
  ...loadFromGoogleServices(),
  ...(fromFile || {}),
};

const lines = [];
if (existsSync(envPath)) {
  const existing = readFileSync(envPath, 'utf8');
  const kept = existing
    .split('\n')
    .filter((line) => !/^VITE_FIREBASE_/.test(line.trim()));
  lines.push(...kept.filter((l, i, arr) => !(l === '' && i === arr.length - 1)));
} else {
  lines.push('# InstaCollab environment');
}

if (!lines.some((l) => l.includes('VITE_FIREBASE'))) {
  lines.push('', '# Firebase Web SDK');
}
for (const [key, value] of Object.entries(vars)) {
  if (value) lines.push(`${key}=${value}`);
}
lines.push('');

writeFileSync(envPath, lines.join('\n'));
console.log('Updated', envPath);
console.log('Firebase project:', vars.VITE_FIREBASE_PROJECT_ID);
console.log('Web app ID:', vars.VITE_FIREBASE_APP_ID);
console.log('Restart: npm run dev');
