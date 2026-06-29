import type { User } from '../../types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from './client';
import { profileRowToUser } from './profile';
import type { ProfileRow } from './types';

const SEARCH_LIMIT = 24;

type ProfileField = 'username' | 'display_name' | 'public_user_id';

function ilikePattern(term: string): string {
  return `%${term.replace(/[%_\\]/g, '\\$&')}%`;
}

function dedupeProfiles(rows: ProfileRow[]): ProfileRow[] {
  const byId = new Map<string, ProfileRow>();
  for (const row of rows) {
    if (row?.id) byId.set(row.id, row);
  }
  return Array.from(byId.values());
}

async function queryProfilesByField(
  supabase: SupabaseClient,
  field: ProfileField,
  pattern: string,
  limit: number,
  setupOnly: boolean,
): Promise<ProfileRow[]> {
  let query = supabase.from('profiles').select('*').ilike(field, pattern).limit(limit);
  if (setupOnly) {
    query = query.eq('profile_setup_complete', true);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ProfileRow[];
}

/** Search public.profiles for discoverable accounts (cross-device, anon-readable). */
export async function searchSupabaseProfiles(
  query: string,
  limit = SEARCH_LIMIT,
): Promise<User[]> {
  const supabase = getSupabaseClient();
  const term = query.trim().toLowerCase();
  if (!supabase || term.length < 1) return [];

  const pattern = ilikePattern(term);
  const attempts: Array<{ setupOnly: boolean; fields: ProfileField[] }> = [
    { setupOnly: true, fields: ['username', 'display_name', 'public_user_id'] },
    { setupOnly: true, fields: ['username', 'display_name'] },
    { setupOnly: false, fields: ['username', 'display_name', 'public_user_id'] },
    { setupOnly: false, fields: ['username', 'display_name'] },
  ];

  for (const attempt of attempts) {
    try {
      const batches = await Promise.all(
        attempt.fields.map((field) =>
          queryProfilesByField(supabase, field, pattern, limit, attempt.setupOnly),
        ),
      );
      return dedupeProfiles(batches.flat())
        .slice(0, limit)
        .map((row) => profileRowToUser(row));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (
        /profile_setup_complete|public_user_id|schema cache|does not exist|column/i.test(msg)
      ) {
        continue;
      }
      console.warn('[search] Supabase profile search failed:', msg);
      return [];
    }
  }

  return [];
}
