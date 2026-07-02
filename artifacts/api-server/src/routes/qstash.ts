import { Router, type IRouter } from "express";
import { Receiver } from "@upstash/qstash";
import { spawn } from "node:child_process";
import path from "node:path";

const router: IRouter = Router();

function runHandoffCycle(): Promise<number> {
  const root = path.resolve(import.meta.dirname, "../../../..");
  return new Promise((resolve) => {
    const child = spawn("node", ["scripts/app-handoff.mjs", "cycle"], {
      cwd: root,
      stdio: "ignore",
      env: { ...process.env, UX_AGENT_SILENT: "1", HANDOFF_VERBOSE: "0" },
    });
    child.on("close", (code) => resolve(code ?? 1));
  });
}

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
    const body = typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? {});
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

  const code = await runHandoffCycle();
  res.status(code === 0 ? 200 : 500).json({ ok: code === 0 });
});

export default router;
