import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

let anonClient: SupabaseClient | null = null;
let serviceClient: SupabaseClient | null = null;

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}

export function getSupabaseAnon(): SupabaseClient {
  if (!anonClient) {
    anonClient = createClient(
      requireEnv("SUPABASE_URL"),
      requireEnv("SUPABASE_ANON_KEY"),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }
  return anonClient;
}

export function getSupabaseService(): SupabaseClient {
  if (!serviceClient) {
    serviceClient = createClient(
      requireEnv("SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }
  return serviceClient;
}

export type AuthUser = User;

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
  return data;
}
