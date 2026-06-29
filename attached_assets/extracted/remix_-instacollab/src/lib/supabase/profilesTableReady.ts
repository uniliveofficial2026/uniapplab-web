import { getSupabaseClient } from './client';
import { isSupabaseConfigured } from './config';

export type ProfilesTableStatus = 'ok' | 'missing' | 'unknown' | 'not_configured';

export function getSupabaseSqlEditorUrl(): string {
  const url = String(import.meta.env.VITE_SUPABASE_URL || '').trim();
  try {
    const ref = new URL(url).hostname.split('.')[0];
    if (ref) return `https://supabase.com/dashboard/project/${ref}/sql/new`;
  } catch {
    /* ignore */
  }
  return 'https://supabase.com/dashboard/project/_/sql/new';
}

/** Returns whether public.profiles exists (PostgREST schema cache). */
export async function probeProfilesTableStatus(): Promise<ProfilesTableStatus> {
  if (!isSupabaseConfigured()) return 'not_configured';
  const supabase = getSupabaseClient();
  if (!supabase) return 'not_configured';

  const { error } = await supabase.from('profiles').select('id').limit(0);
  if (!error) return 'ok';

  const msg = `${error.message} ${(error as { code?: string }).code ?? ''}`.toLowerCase();
  if (
    /schema cache|could not find.*profiles|pgrst205|relation.*profiles.*does not exist/i.test(msg)
  ) {
    return 'missing';
  }
  return 'unknown';
}
