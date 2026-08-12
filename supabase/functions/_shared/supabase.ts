import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

let serviceClient: SupabaseClient | null = null;
let anonClient: SupabaseClient | null = null;

function env(name: string, fallback = ""): string {
  return String(Deno.env.get(name) || fallback).trim();
}

function supabaseUrl(): string {
  const url = env("SUPABASE_URL", env("PROJECT_URL"));
  if (!url) throw new Error("Missing SUPABASE_URL");
  return url;
}

/** Service-role client — bypasses RLS. Same role the Express API used. */
export function getSupabaseService(): SupabaseClient {
  if (!serviceClient) {
    const key = env("SERVICE_ROLE_KEY", env("SUPABASE_SERVICE_ROLE_KEY"));
    if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
    serviceClient = createClient(supabaseUrl(), key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return serviceClient;
}

export function getSupabaseAnon(): SupabaseClient {
  if (!anonClient) {
    const key = env("SUPABASE_ANON_KEY", env("ANON_KEY"));
    if (!key) throw new Error("Missing SUPABASE_ANON_KEY");
    anonClient = createClient(supabaseUrl(), key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return anonClient;
}

export type ProfileRecord = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  role: string;
  banned_at: string | null;
  ban_reason: string | null;
  muted_until: string | null;
  profile_setup_complete: boolean;
  public_user_id: string | null;
};

export async function fetchProfile(userId: string): Promise<ProfileRecord | null> {
  const { data, error } = await getSupabaseService()
    .from("profiles")
    .select(
      "id, username, display_name, avatar_url, bio, role, banned_at, ban_reason, muted_until, profile_setup_complete, public_user_id",
    )
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data as ProfileRecord | null;
}
