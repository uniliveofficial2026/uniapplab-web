import { Router, type IRouter } from "express";
import { auth } from "../middlewares/auth";
import { requireNotBanned } from "../middlewares/requireNotBanned";
import { getSupabaseService } from "../lib/supabase";
import { verifyFirebaseIdToken } from "../lib/firebaseAuth";
import {
  type AuthProvider,
  linkVerifiedIdentity,
  listAuthIdentities,
  unlinkIdentity,
} from "../lib/authIdentities";

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

async function handleGetMe(req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) {
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
}

router.get("/", auth, handleGetMe);
router.get("/me", auth, handleGetMe);

async function handlePatchMe(req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) {
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
}

router.patch("/", auth, requireNotBanned, handlePatchMe);
router.patch("/me", auth, requireNotBanned, handlePatchMe);

const LINKABLE_PROVIDERS = new Set<AuthProvider>(["firebase", "google", "apple", "supabase"]);

router.get("/identities", auth, requireNotBanned, async (req, res, next) => {
  try {
    const rows = await listAuthIdentities(req.authUser!.id);
    res.json({
      identities: rows.map((row) => ({
        id: row.id,
        provider: row.provider,
        providerUserId: row.provider_user_id,
        verified: row.verified,
        linkageStatus: row.linkage_status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.post("/identities/link", auth, requireNotBanned, async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const body = req.body as { provider?: string; idToken?: string; providerUserId?: string };
    const provider = String(body.provider || "").trim() as AuthProvider;
    if (!LINKABLE_PROVIDERS.has(provider)) {
      res.status(400).json({ error: "unsupported_provider" });
      return;
    }

    let providerUserId = "";
    if (provider === "firebase" || provider === "google" || provider === "apple") {
      const token = String(body.idToken || "").trim();
      if (!token) {
        res.status(400).json({ error: "idToken required" });
        return;
      }
      const verified = await verifyFirebaseIdToken(token);
      if (!verified?.firebaseUid) {
        res.status(401).json({ error: "provider_token_invalid" });
        return;
      }
      providerUserId = verified.firebaseUid;
    } else {
      providerUserId = String(body.providerUserId || userId).trim();
    }

    const linked = await linkVerifiedIdentity({
      canonicalUserId: userId,
      provider,
      providerUserId,
    });
    if (!linked.ok && linked.code === "conflict") {
      res.status(409).json({
        error: "identity_conflict",
        message: "This provider subject already belongs to another account. Explicit operator resolution is required.",
      });
      return;
    }
    if (!linked.ok) {
      res.status(400).json({ error: "identity_link_failed" });
      return;
    }
    res.json({ ok: true, created: linked.created, identity: linked.identity });
  } catch (err) {
    next(err);
  }
});

router.post("/identities/unlink", auth, requireNotBanned, async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const body = req.body as { provider?: string; providerUserId?: string };
    const provider = String(body.provider || "").trim() as AuthProvider;
    const providerUserId = String(body.providerUserId || "").trim();
    if (!LINKABLE_PROVIDERS.has(provider) || !providerUserId) {
      res.status(400).json({ error: "provider and providerUserId required" });
      return;
    }
    const result = await unlinkIdentity({ canonicalUserId: userId, provider, providerUserId });
    if (!result.ok && result.code === "last_identity") {
      res.status(409).json({ error: "cannot_unlink_last_identity" });
      return;
    }
    if (!result.ok && result.code === "not_found") {
      res.status(404).json({ error: "identity_not_found" });
      return;
    }
    if (!result.ok) {
      res.status(400).json({ error: "identity_unlink_failed" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
