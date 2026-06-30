/** Committed at build time — used when /supabase-config.json is missing on the CDN. */
import bundledSupabaseConfig from '../../../public/supabase-config.json';

export type RuntimeSupabaseConfig = {
  supabaseUrl: string;
  supabaseAnonKey: string;
};

const STALE_PROJECT_REFS = new Set(['otiqckextvdbudbxzmau']);

let runtime: RuntimeSupabaseConfig | null = null;
let loadPromise: Promise<void> | null = null;

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

/** Load /supabase-config.json — overrides wrong VITE_* values baked at build time. */
export async function loadRuntimeAuthConfig(): Promise<void> {
  if (runtime) return;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      const res = await fetch('/supabase-config.json', { cache: 'no-store' });
      if (res.ok) {
        const data: unknown = await res.json();
        if (isUsableConfig(data)) {
          runtime = {
            supabaseUrl: data.supabaseUrl.trim().replace(/\/$/, ''),
            supabaseAnonKey: data.supabaseAnonKey.trim(),
          };
          return;
        }
      }
    } catch {
      /* try bundled fallback */
    }

    if (isUsableConfig(bundledSupabaseConfig)) {
      runtime = {
        supabaseUrl: bundledSupabaseConfig.supabaseUrl.trim().replace(/\/$/, ''),
        supabaseAnonKey: bundledSupabaseConfig.supabaseAnonKey.trim(),
      };
    }
  })();

  return loadPromise;
}

export function getRuntimeSupabaseConfig(): RuntimeSupabaseConfig | null {
  return runtime;
}

export function clearRuntimeSupabaseConfigForTests(): void {
  runtime = null;
  loadPromise = null;
}
