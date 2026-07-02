import { Router, type IRouter } from "express";
import {
  createIssue,
  getViewer,
  isLinearConfigured,
  listTeams,
  verifyLinearWebhook,
} from "../lib/linear";

const router: IRouter = Router();

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
  if (!isLinearConfigured()) {
    res.status(503).json({ error: "Linear not configured" });
    return;
  }

  const { title, description, teamId, priority } = req.body ?? {};
  if (!title || typeof title !== "string") {
    res.status(400).json({ error: "title required" });
    return;
  }

  try {
    const issue = await createIssue({
      title,
      description: typeof description === "string" ? description : undefined,
      teamId: typeof teamId === "string" ? teamId : undefined,
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

  if (!verifyLinearWebhook(raw, typeof signature === "string" ? signature : undefined)) {
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

  res.status(200).json({ ok: true, action: payload.action, type: payload.type });
});

export default router;
