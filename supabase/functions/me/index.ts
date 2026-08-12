/**
 * Supabase Edge Function — /me
 * Migrated from artifacts/api-server/src/routes/me.ts
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, noContent, subPath } from "../_shared/cors.ts";
import { authenticate, requireNotBanned } from "../_shared/auth.ts";
import { getSupabaseService } from "../_shared/supabase.ts";

function platformAdminUsernames(): Set<string> {
  return new Set(
    String(Deno.env.get("PLATFORM_ADMIN_USERNAMES") ?? "uniliveofficial2026,oowai20")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

function platformAdminEmails(): Set<string> {
  return new Set(
    String(Deno.env.get("PLATFORM_ADMIN_EMAILS") ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

async function ensurePlatformAdminBootstrap(opts: {
  userId: string;
  email?: string | null;
  username?: string | null;
  role?: string | null;
}): Promise<string> {
  const current = opts.role ?? "user";
  if (current === "admin") return "admin";
  const usernameHit = opts.username
    ? platformAdminUsernames().has(opts.username.toLowerCase())
    : false;
  const emailHit = opts.email ? platformAdminEmails().has(opts.email.toLowerCase()) : false;
  if (!usernameHit && !emailHit) return current;
  try {
    const { data, error } = await getSupabaseService()
      .from("profiles")
      .update({ role: "admin", updated_at: new Date().toISOString() })
      .eq("id", opts.userId)
      .select("role")
      .single();
    if (!error && data?.role === "admin") return "admin";
  } catch {
    /* keep current */
  }
  return current;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return noContent();

  const seg = subPath(new URL(req.url), "me");
  // Mounted as /functions/v1/me — empty path is the resource itself.
  if (seg.length > 0) return json({ error: "not_found" }, 404);

  const ctx = await authenticate(req);
  if (ctx instanceof Response) return ctx;
  const sb = getSupabaseService();

  if (req.method === "GET") {
    const user = ctx.user;
    const profile = ctx.profile;
    const role = await ensurePlatformAdminBootstrap({
      userId: user.id,
      email: user.email,
      username: profile?.username ?? null,
      role: profile?.role ?? user.app_metadata?.role ?? "user",
    });
    return json({
      id: user.id,
      email: user.email,
      role,
      bannedAt: profile?.banned_at ?? null,
      banReason: profile?.ban_reason ?? null,
      mutedUntil: profile?.muted_until ?? null,
      username: profile?.username ?? null,
      displayName: profile?.display_name ?? null,
      avatarUrl: profile?.avatar_url ?? null,
      bio: profile?.bio ?? null,
      publicUserId: profile?.public_user_id ?? null,
      profileSetupComplete: profile?.profile_setup_complete ?? false,
    });
  }

  if (req.method === "PATCH") {
    const banned = requireNotBanned(ctx);
    if (banned) return banned;
    const { displayName, bio, avatarUrl } = (await req.json().catch(() => ({}))) as {
      displayName?: string;
      bio?: string;
      avatarUrl?: string | null;
    };
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (displayName !== undefined) patch.display_name = String(displayName).slice(0, 80);
    if (bio !== undefined) patch.bio = String(bio).slice(0, 500);
    if (avatarUrl !== undefined) patch.avatar_url = avatarUrl;

    const { data, error } = await sb
      .from("profiles")
      .update(patch)
      .eq("id", ctx.user.id)
      .select("username, display_name, avatar_url, bio, public_user_id")
      .single();
    if (error) return json({ error: error.message }, 400);
    return json(data);
  }

  return json({ error: "not_found" }, 404);
});
