import { Router, type IRouter } from "express";
import fs from "node:fs";
import path from "node:path";
import { auth } from "../middlewares/auth";
import { requireNotBanned } from "../middlewares/requireNotBanned";
import { isUpstashConfigured, pushUxSignals } from "../lib/upstash";

const router: IRouter = Router();

const workspaceRoot = path.resolve(import.meta.dirname, "../../../..");
const signalsPath =
  process.env.UX_SIGNALS_PATH || path.join(workspaceRoot, ".local/ux-signals.jsonl");

router.post("/ux/signals", auth, requireNotBanned, async (req, res) => {
  const signals = req.body?.signals;
  if (!Array.isArray(signals) || signals.length === 0 || signals.length > 50) {
    res.status(400).json({ error: "signals array required (max 50)" });
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
