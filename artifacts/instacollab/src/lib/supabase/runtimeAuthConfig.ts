/** Committed at build time — used when /supabase-config.json is missing on the CDN. */
import bundledSupabaseConfig from '../../../public/supabase-config.json';

export type RuntimeSupabaseConfig = {
  supabaseUrl: string;
  supabaseAnonKey: string;
};

/** Retired Supabase project refs — never use for auth (Vercel env may still point here). */
export const STALE_SUPABASE_PROJECT_REFS = new Set([
  'kgiaflmukkguzjtmcuqd',
  'otiqckextvdbudbxzmau',
  'ffhvdoooxkthlvlvdiiu', // replaced by ldxrdbyznheayhbkvxlq (2026-07-17)
]);

const STALE_PROJECT_REFS = STALE_SUPABASE_PROJECT_REFS;

export function isStaleSupabaseProjectRef(ref: string | null | undefined): boolean {
  if (!ref) return false;
  return STALE_PROJECT_REFS.has(ref.trim().toLowerCase());
}

export function supabaseUrlProjectRef(url: string): string | null {
  return url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1]?.toLowerCase() ?? null;
}

let runtime: RuntimeSupabaseConfig | null = null;
let networkRefreshStarted = false;

function isUsableConfig(value: unknown): value is RuntimeSupabaseConfig {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  const url = String(row.supabaseUrl || '').trim();
  const key = String(row.supabaseAnonKey || '').trim();
  if (!url || !key) return false;
  if (/your[_-]?(project|anon|publishable)/i.test(url + key)) return false;
  const ref = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1];
  if (ref && STALE_PROJECT_REFS.has(ref)) return false;
  return true;
}

function applyConfig(data: RuntimeSupabaseConfig): void {
  runtime = {
    supabaseUrl: data.supabaseUrl.trim().replace(/\/$/, ''),
    supabaseAnonKey: data.supabaseAnonKey.trim(),
  };
  if (typeof window !== 'undefined') {
    const ref = supabaseUrlProjectRef(runtime.supabaseUrl);
    (window as unknown as { __UNILIVE_SUPABASE_REF__?: string | null }).__UNILIVE_SUPABASE_REF__ =
      ref;
  }
}

/** Instant — uses bundled config so UI never waits on network. */
export function ensureBundledAuthConfig(): void {
  if (runtime) return;
  if (isUsableConfig(bundledSupabaseConfig)) {
    applyConfig(bundledSupabaseConfig);
  }
}

/**
 * Load auth config without blocking first paint.
 * 1) Apply bundled config synchronously
 * 2) Optionally refresh from /supabase-config.json in the background
 */
export async function loadRuntimeAuthConfig(): Promise<void> {
  ensureBundledAuthConfig();

  if (networkRefreshStarted || typeof window === 'undefined') return;
  networkRefreshStarted = true;

  void (async () => {
    try {
      const res = await fetch('/supabase-config.json', { cache: 'no-store' });
      if (!res.ok) return;
      const data: unknown = await res.json();
      if (!isUsableConfig(data)) return;
      const nextUrl = data.supabaseUrl.trim().replace(/\/$/, '');
      const nextKey = data.supabaseAnonKey.trim();
      if (
        runtime &&
        runtime.supabaseUrl === nextUrl &&
        runtime.supabaseAnonKey === nextKey
      ) {
        return;
      }
      applyConfig(data);
      // Recreate client if URL/key changed after first paint.
      const { resetSupabaseClient, initSupabaseClient } = await import('./client');
      resetSupabaseClient();
      void initSupabaseClient();
    } catch {
      /* keep bundled / env config */
    }
  })();
}

export function getRuntimeSupabaseConfig(): RuntimeSupabaseConfig | null {
  return runtime;
}

export function clearRuntimeSupabaseConfigForTests(): void {
  runtime = null;
  networkRefreshStarted = false;
}
