import crypto from "node:crypto";
import { Router, type IRouter, type Request, type Response } from "express";
import {
  createIssue,
  getViewer,
  isLinearConfigured,
  listTeams,
  verifyLinearWebhook,
} from "../lib/linear";
import { upstashRateLimit } from "../lib/ratelimit";

const router: IRouter = Router();
router.use(upstashRateLimit);

function timingSafeEqualString(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function requireIssueCreateSecret(req: Request, res: Response): boolean {
  const secret = process.env.LINEAR_ISSUE_CREATE_SECRET?.trim();
  if (!secret) {
    res.status(503).json({ error: "linear_issue_secret_not_configured" });
    return false;
  }

  const header = req.headers.authorization;
  const token =
    typeof header === "string" && header.startsWith("Bearer ")
      ? header.slice("Bearer ".length).trim()
      : "";

  if (!token || !timingSafeEqualString(token, secret)) {
    res.status(401).json({ error: "invalid_linear_issue_secret" });
    return false;
  }

  return true;
}

router.get("/linear/health", async (_req, res) => {
  if (!isLinearConfigured()) {
    res.status(503).json({ ok: false, configured: false });
    return;
  }

  try {
    const viewer = await getViewer();
    const teams = await listTeams();
    res.json({
      ok: Boolean(viewer),
      configured: true,
      viewer: viewer ? { name: viewer.name, email: viewer.email } : null,
      teams: teams.map((t) => ({ key: t.key, name: t.name })),
    });
  } catch (err) {
    res.status(503).json({
      ok: false,
      configured: true,
      reason: err instanceof Error ? err.message : String(err),
    });
  }
});

router.post("/linear/issues", async (req, res) => {
  if (!requireIssueCreateSecret(req, res)) {
    return;
  }

  if (!isLinearConfigured()) {
    res.status(503).json({ error: "Linear not configured" });
    return;
  }

  const { title, description, priority } = req.body ?? {};
  if (!title || typeof title !== "string") {
    res.status(400).json({ error: "title required" });
    return;
  }

  try {
    const issue = await createIssue({
      title,
      description: typeof description === "string" ? description : undefined,
      // Use LINEAR_TEAM_ID from server config; never trust an HTTP caller's team id.
      priority: typeof priority === "number" ? priority : undefined,
    });
    if (!issue) {
      res.status(500).json({ error: "issueCreate failed" });
      return;
    }
    res.status(201).json(issue);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Linear create failed",
    });
  }
});

router.post("/linear/webhook", (req, res) => {
  const signature = req.headers["linear-signature"];
  const raw = (req as { body?: Buffer }).body;
  if (!Buffer.isBuffer(raw)) {
    res.status(400).json({ error: "raw body required" });
    return;
  }

  if (
    !verifyLinearWebhook(
      raw,
      typeof signature === "string" ? signature : undefined,
    )
  ) {
    res.status(401).json({ error: "invalid signature" });
    return;
  }

  let payload: { action?: string; type?: string; data?: { id?: string } };
  try {
    payload = JSON.parse(raw.toString("utf8"));
  } catch {
    res.status(400).json({ error: "invalid json" });
    return;
  }

  res
    .status(200)
    .json({ ok: true, action: payload.action, type: payload.type });
});

export default router;
