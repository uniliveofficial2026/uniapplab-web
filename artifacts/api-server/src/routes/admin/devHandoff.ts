import { Router, type IRouter } from "express";
import { randomBytes } from "node:crypto";
import { auth } from "../../middlewares/auth";
import { detectAdminEnvironment } from "../../domain/admin-control-plane/adminIdentityService";
import { apiError } from "../../lib/apiError";
import {
  mintDevLocalAdminToken,
  resolveLocalPlatformAdminUser,
} from "../../lib/devLocalAdminAuth";

type HandoffEntry = { token: string; exp: number };

const handoffs = new Map<string, HandoffEntry>();
const TTL_MS = 60_000;

function localDevOnly(_req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) {
  if (detectAdminEnvironment() !== "local") {
    apiError(res, 404, "error.notFound");
    return;
  }
  next();
}

function purgeExpired(): void {
  const now = Date.now();
  for (const [key, entry] of handoffs) {
    if (entry.exp <= now) handoffs.delete(key);
  }
}

const router: IRouter = Router();

router.use(localDevOnly);

/** Local dev: mint admin bearer without main-app session (localhost only). */
router.post("/mint-local", async (_req, res) => {
  try {
    const admin = await resolveLocalPlatformAdminUser();
    if (!admin) {
      apiError(res, 404, "error.notFound");
      return;
    }
    res.json({
      token: mintDevLocalAdminToken(admin.userId),
      userId: admin.userId,
      username: admin.username,
      email: admin.email,
      mode: "dev-local",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "mint failed";
    res.status(500).json({ error: message, code: "error.internal" });
  }
});

/** Admin panel registers interest; optional — pickup works with any random nonce. */
router.post("/register", (_req, res) => {
  purgeExpired();
  const nonce = randomBytes(16).toString("hex");
  handoffs.set(nonce, { token: "", exp: Date.now() + TTL_MS });
  res.json({ nonce, expiresInMs: TTL_MS });
});

/** Main app (authenticated) stores its bearer token for the admin panel to collect. */
router.post("/complete", auth, (req, res) => {
  purgeExpired();
  const nonce = String(req.body?.nonce || "").trim();
  if (!nonce || nonce.length < 16) {
    apiError(res, 400, "error.badRequest");
    return;
  }
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  if (!token) {
    apiError(res, 401, "error.unauthorized");
    return;
  }
  handoffs.set(nonce, { token, exp: Date.now() + TTL_MS });
  res.json({ ok: true });
});

/** Admin panel picks up the token once (localhost dev only). */
router.get("/pickup", (req, res) => {
  purgeExpired();
  const nonce = String(req.query.nonce || "").trim();
  if (!nonce) {
    apiError(res, 400, "error.badRequest");
    return;
  }
  const entry = handoffs.get(nonce);
  if (!entry?.token) {
    apiError(res, 404, "error.notFound");
    return;
  }
  handoffs.delete(nonce);
  res.json({ token: entry.token });
});

export default router;
