#!/usr/bin/env node
/**
 * Build supabase/bootstrap-full.sql — one paste for the complete cloud schema.
 * Usage: node scripts/build-bootstrap-full.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { getAppRoot } from './resolveProjectEnv.mjs';

const appRoot = getAppRoot(import.meta.dirname);
const supabaseDir = path.join(appRoot, 'supabase');
const outPath = path.join(supabaseDir, 'bootstrap-full.sql');

const base = fs.readFileSync(path.join(supabaseDir, 'bootstrap.sql'), 'utf8');

const migrationOrder = [
  '20260601130000_google_profile_metadata.sql',
  '20260601140000_apple_profile_metadata.sql',
  '20260601150000_public_user_id.sql',
  '20260601160000_user_app_state.sql',
  '20260601170000_profiles_realtime.sql',
  '20260601180000_profiles_roles.sql',
  '20260601190000_wallets.sql',
  '20260601200000_chat.sql',
  '20260601210000_streams.sql',
  '20260701120000_posts.sql',
  '20260702120000_profile_thought_note.sql',
  '20260703120000_social_discovery.sql',
];

const chunks = [
  base.trimEnd(),
  '',
  '-- ─── incremental migrations (idempotent) ───────────────────────────────────',
  '',
];

for (const file of migrationOrder) {
  const full = path.join(supabaseDir, 'migrations', file);
  if (!fs.existsSync(full)) {
    console.warn(`[bootstrap-full] skip missing ${file}`);
    continue;
  }
  chunks.push(`-- >>> ${file}`);
  chunks.push(fs.readFileSync(full, 'utf8').trimEnd());
  chunks.push('');
}

chunks.push('notify pgrst, \'reload schema\';');
chunks.push('');

fs.writeFileSync(outPath, chunks.join('\n'));
console.log(`Wrote ${outPath} (${chunks.join('\n').length} bytes)`);
