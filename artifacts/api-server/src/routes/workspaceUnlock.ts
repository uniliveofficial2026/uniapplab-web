import { Router, type IRouter } from "express";
import crypto from "node:crypto";
import { apiError } from "../lib/apiError";

const router: IRouter = Router();

const COOKIE_NAME = "workspace_unlock";
const TOKEN_TTL_MS = 8 * 60 * 60 * 1000;

function expectedStaffCode(): string {
  return String(process.env.WORKSPACE_STAFF_CODE || "").trim();
}

function signingSecret(): string {
  return (
    String(process.env.WORKSPACE_UNLOCK_SIGNING_SECRET || "").trim() ||
    String(process.env.SESSION_SECRET || "").trim() ||
    String(process.env.WORKSPACE_STAFF_CODE || "").trim()
  );
}

function timingSafeEqualUtf8(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function mintUnlockToken(): string | null {
  const secret = signingSecret();
  if (!secret) return null;
  const exp = Date.now() + TOKEN_TTL_MS;
  const body = `workspace_unlock:${exp}`;
  const sig = crypto.createHmac("sha256", secret).update(body).digest("hex");
  return `${exp}.${sig}`;
}

export function verifyUnlockToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const secret = signingSecret();
  if (!secret) return false;
  const [expRaw, sig] = String(token).split(".");
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || !sig || Date.now() > exp) return false;
  const body = `workspace_unlock:${exp}`;
  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
  return timingSafeEqualUtf8(sig, expected);
}

/**
 * Staff access-code unlock for Workspace UI.
 * Source of truth is WORKSPACE_STAFF_CODE (server env). Never echo the code.
 * UI unlock ≠ Admin control-plane privilege (those routes still require admin authz).
 */
router.post("/unlock", (req, res) => {
  const expected = expectedStaffCode();
  if (!expected) {
    apiError(res, 503, "error.workspaceStaffCodeUnset");
    return;
  }
  const code = String(req.body?.code ?? "").trim();
  if (!timingSafeEqualUtf8(code, expected)) {
    apiError(res, 401, "error.invalidWorkspaceAccessCode");
    return;
  }
  const token = mintUnlockToken();
  if (!token) {
    apiError(res, 503, "error.workspaceUnlockUnavailable");
    return;
  }
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(TOKEN_TTL_MS / 1000)}`,
  );
  res.json({ ok: true, expiresInSec: Math.floor(TOKEN_TTL_MS / 1000) });
});

router.get("/session", (req, res) => {
  const raw = String(req.headers.cookie || "");
  const match = raw.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  const token = match?.[1] ? decodeURIComponent(match[1]) : null;
  res.json({ unlocked: verifyUnlockToken(token) });
});

router.post("/lock", (_req, res) => {
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
  );
  res.json({ ok: true });
});

export default router;
