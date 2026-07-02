/**
 * Load repo .env into process.env (does not override existing vars).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

let loaded = false;

export function loadDotEnv() {
  if (loaded) return;
  loaded = true;

  for (const file of [
    path.join(ROOT, '.env'),
    path.join(ROOT, '.env.local'),
    path.join(ROOT, 'artifacts/instacollab/.env'),
  ]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const m = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!m || process.env[m[1]] !== undefined) continue;
      let value = m[2].trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[m[1]] = value;
    }
  }
}
