import { getRuntimeSupabaseConfig } from './runtimeAuthConfig';

export function isSupabaseConfigured(): boolean {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  const placeholder =
    /your[_-]?(project|publishable|anon|supabase)/i.test(url) ||
    /your[_-]?(project|publishable|anon|supabase)/i.test(key);
  return url.length > 0 && key.length > 0 && !placeholder;
}

export function getSupabaseUrl(): string {
  const runtime = getRuntimeSupabaseConfig();
  if (runtime?.supabaseUrl) return runtime.supabaseUrl;
  return String(import.meta.env.VITE_SUPABASE_URL || '').trim();
}

export function getSupabaseProjectRef(): string | null {
  const url = getSupabaseUrl();
  if (!url) return null;
  try {
    return new URL(url).hostname.split('.')[0] || null;
  } catch {
    return null;
  }
}

export function getSupabaseAnonKey(): string {
  const runtime = getRuntimeSupabaseConfig();
  if (runtime?.supabaseAnonKey) return runtime.supabaseAnonKey;
  return String(
    import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || ''
  ).trim();
}
