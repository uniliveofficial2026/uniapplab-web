import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAnonKey, getSupabaseUrl, isSupabaseConfigured } from './config';
import { loadRuntimeAuthConfig } from './runtimeAuthConfig';

let client: SupabaseClient | null = null;
let clientProjectUrl: string | null = null;
let initPromise: Promise<SupabaseClient | null> | null = null;

function buildClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  const url = getSupabaseUrl();
  clientProjectUrl = url;
  return createClient(url, getSupabaseAnonKey(), {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

/** Load runtime config then return the singleton Supabase client. */
export async function initSupabaseClient(): Promise<SupabaseClient | null> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    await loadRuntimeAuthConfig();
    const url = getSupabaseUrl();
    if (client && clientProjectUrl && clientProjectUrl !== url) {
      client = null;
      clientProjectUrl = null;
    }
    if (!client) client = buildClient();
    return client;
  })();
  return initPromise;
}

/** Prefer this for sign-in — always waits for runtime config before OAuth. */
export async function getSupabaseClientAsync(): Promise<SupabaseClient | null> {
  return initSupabaseClient();
}

export function getSupabaseClient(): SupabaseClient | null {
  return client;
}

export function resetSupabaseClient(): void {
  client = null;
  clientProjectUrl = null;
  initPromise = null;
}
