import { Router, type IRouter } from "express";
import { Receiver } from "@upstash/qstash";
import { isUpstashConfigured, pushHandoffTask } from "../lib/upstash";

const router: IRouter = Router();

router.post("/qstash/handoff-cycle", async (req, res) => {
  const currentKey = process.env.QSTASH_CURRENT_SIGNING_KEY?.trim();
  const nextKey = process.env.QSTASH_NEXT_SIGNING_KEY?.trim();
  if (!currentKey) {
    res.status(503).json({ error: "QSTASH_CURRENT_SIGNING_KEY not configured" });
    return;
  }

  const receiver = new Receiver({
    currentSigningKey: currentKey,
    nextSigningKey: nextKey || currentKey,
  });

  try {
    const signature = req.headers["upstash-signature"];
    if (typeof signature !== "string") {
      res.status(401).json({ error: "missing signature" });
      return;
    }
    const body =
      req.body instanceof Buffer
        ? req.body.toString("utf8")
        : typeof req.body === "string"
          ? req.body
          : JSON.stringify(req.body ?? {});
    const isValid = await receiver.verify({
      signature,
      body,
      url: `${process.env.PUBLIC_APP_ORIGIN || "https://app.uniapplab.com"}/api/qstash/handoff-cycle`,
    });
    if (!isValid) {
      res.status(401).json({ error: "invalid signature" });
      return;
    }
  } catch {
    res.status(401).json({ error: "signature verification failed" });
    return;
  }

  if (!isUpstashConfigured()) {
    res.status(503).json({ error: "upstash_not_configured" });
    return;
  }

  const queued = [];
  for (const type of ["cloud_data", "health", "verify"] as const) {
    const id = await pushHandoffTask({
      type,
      reason: "qstash_cron",
      source: "qstash",
      priority: type === "cloud_data" ? 1 : 5,
    });
    if (id) queued.push({ type, id });
  }

  res.json({ ok: true, queued });
});

export default router;
