import { Router, type IRouter } from "express";
import { auth } from "../middlewares/auth";
import { requireNotBanned } from "../middlewares/requireNotBanned";
import { getSupabaseService } from "../lib/supabase";

const router: IRouter = Router();

router.get("/me", auth, (req, res) => {
  const user = req.authUser!;
  const profile = req.profile;
  res.json({
    id: user.id,
    email: user.email,
    role: profile?.role ?? (user.app_metadata as { role?: string })?.role ?? "user",
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
