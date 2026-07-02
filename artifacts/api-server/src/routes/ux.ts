import { Router, type IRouter } from "express";
import fs from "node:fs";
import path from "node:path";
import { isUpstashConfigured, pushUxSignals } from "../lib/upstash";

const router: IRouter = Router();

const workspaceRoot = path.resolve(import.meta.dirname, "../../../..");
const signalsPath =
  process.env.UX_SIGNALS_PATH || path.join(workspaceRoot, ".local/ux-signals.jsonl");

router.post("/ux/signals", async (req, res) => {
  const signals = req.body?.signals;
  if (!Array.isArray(signals) || signals.length === 0) {
    res.status(400).json({ error: "signals array required" });
    return;
  }

  try {
    if (isUpstashConfigured()) {
      await pushUxSignals(signals);
    } else {
      fs.mkdirSync(path.dirname(signalsPath), { recursive: true });
      for (const signal of signals) {
        fs.appendFileSync(signalsPath, `${JSON.stringify(signal)}\n`);
      }
    }
    res.status(204).send();
  } catch {
    res.status(204).send();
  }
});

export default router;
