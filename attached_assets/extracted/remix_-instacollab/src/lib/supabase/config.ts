export function isSupabaseConfigured(): boolean {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  return url.length > 0 && key.length > 0 && !key.includes('your_publishable_or_anon_key');
}

export function getSupabaseUrl(): string {
  return String(import.meta.env.VITE_SUPABASE_URL || '').trim();
}

export function getSupabaseAnonKey(): string {
  return String(
    import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || ''
  ).trim();
}
