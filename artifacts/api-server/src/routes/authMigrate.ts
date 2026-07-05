import { Router, type IRouter } from "express";
import { migrateFirebaseUserToSupabase } from "../lib/firebaseMigrate";

const router: IRouter = Router();

router.post("/auth/migrate-firebase", async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      res.status(401).json({ error: "missing_bearer_token" });
      return;
    }

    const firebaseIdToken = header.slice("Bearer ".length).trim();
    const body = req.body as {
      firebaseUid?: string;
      username?: string;
      displayName?: string;
      profileSetupComplete?: boolean;
      avatarUrl?: string | null;
    };

    const firebaseUid = String(body?.firebaseUid ?? "").trim();
    if (!firebaseUid) {
      res.status(400).json({ error: "firebaseUid required" });
      return;
    }

    const result = await migrateFirebaseUserToSupabase(firebaseIdToken, {
      firebaseUid,
      username: body.username,
      displayName: body.displayName,
      profileSetupComplete: body.profileSetupComplete,
      avatarUrl: body.avatarUrl,
    });

    res.json({
      supabaseUserId: result.supabaseUserId,
      access_token: result.accessToken,
      refresh_token: result.refreshToken,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "invalid_firebase_token" || message === "firebase_uid_mismatch") {
      res.status(401).json({ error: message });
      return;
    }
    if (message === "firebase_email_required") {
      res.status(400).json({ error: message });
      return;
    }
    next(err);
  }
});

export default router;
