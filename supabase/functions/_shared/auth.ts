import { corsHeaders } from "./cors.ts";
import { fetchProfile, getSupabaseAnon, type ProfileRecord } from "./supabase.ts";

export type AuthUser = {
  id: string;
  email?: string;
  app_metadata?: { role?: string } & Record<string, unknown>;
};

export type AuthContext = {
  user: AuthUser;
  profile: ProfileRecord | null;
};

function err(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...corsHeaders },
  });
}

/**
 * Verifies a Supabase access token and loads the caller profile.
 * Mirrors the Express `auth` middleware's Supabase lane. Firebase-backup
 * tokens are not verified here; callers relying on those still hit Express.
 * Returns either an AuthContext or a ready-to-send error Response.
 */
export async function authenticate(req: Request): Promise<AuthContext | Response> {
  const header = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) {
    return err(401, { error: "Missing bearer token" });
  }
  const token = header.slice("Bearer ".length).trim();
  if (!token) return err(401, { error: "Missing bearer token" });

  try {
    const { data, error } = await getSupabaseAnon().auth.getUser(token);
    if (!error && data.user) {
      let profile: ProfileRecord | null = null;
      try {
        profile = await fetchProfile(data.user.id);
      } catch {
        profile = null;
      }
      return {
        user: {
          id: data.user.id,
          email: data.user.email ?? undefined,
          app_metadata: data.user.app_metadata as AuthContext["user"]["app_metadata"],
        },
        profile,
      };
    }
  } catch {
    /* fall through */
  }

  return err(401, { error: "Invalid token", lane: "supabase_only" });
}

export function requireNotBanned(ctx: AuthContext): Response | null {
  if (ctx.profile?.banned_at) {
    return err(403, { error: "Account banned", reason: ctx.profile.ban_reason });
  }
  return null;
}

export function isAdmin(ctx: AuthContext): boolean {
  const role = ctx.user.app_metadata?.role ?? ctx.profile?.role;
  return role === "admin";
}

export function requireAdmin(ctx: AuthContext): Response | null {
  if (!isAdmin(ctx)) return err(403, { error: "Admin only" });
  return null;
}
