import { Router, type IRouter } from "express";
import { auth } from "../middlewares/auth";
import { requireNotBanned } from "../middlewares/requireNotBanned";
import { getSupabaseService } from "../lib/supabase";

const router: IRouter = Router();

function platformAdminUsernames(): Set<string> {
  return new Set(
    String(process.env.PLATFORM_ADMIN_USERNAMES ?? "uniliveofficial2026,oowai20")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

function platformAdminEmails(): Set<string> {
  return new Set(
    String(process.env.PLATFORM_ADMIN_EMAILS ?? "")
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
    /* keep current role */
  }
  return current;
}

router.get("/me", auth, async (req, res, next) => {
  try {
    const user = req.authUser!;
    const profile = req.profile;
    const role = await ensurePlatformAdminBootstrap({
      userId: user.id,
      email: user.email,
      username: profile?.username ?? null,
      role: profile?.role ?? (user.app_metadata as { role?: string } | undefined)?.role ?? "user",
    });
    if (profile && role === "admin" && profile.role !== "admin") {
      profile.role = "admin";
    }
    res.json({
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
  } catch (err) {
    next(err);
  }
});

router.patch("/me", auth, requireNotBanned, async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const { displayName, bio, avatarUrl } = req.body as {
      displayName?: string;
      bio?: string;
      avatarUrl?: string | null;
    };
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (displayName !== undefined) patch.display_name = String(displayName).slice(0, 80);
    if (bio !== undefined) patch.bio = String(bio).slice(0, 500);
    if (avatarUrl !== undefined) patch.avatar_url = avatarUrl;

    const { data, error } = await getSupabaseService()
      .from("profiles")
      .update(patch)
      .eq("id", userId)
      .select("username, display_name, avatar_url, bio, public_user_id")
      .single();
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.json(data);
  } catch (err) {
    next(err);
  }
});

export default router;
