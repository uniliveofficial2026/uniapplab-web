import { Router, type IRouter } from "express";
import fs from "node:fs";
import path from "node:path";
import { isUpstashConfigured, pushHandoffTask } from "../lib/upstash";

const router: IRouter = Router();
const workspaceRoot = path.resolve(import.meta.dirname, "../../../..");
const handoffPath = path.join(workspaceRoot, ".local/handoff-queue.jsonl");

router.post("/handoff/task", async (req, res) => {
  const task = req.body;
  if (!task || typeof task !== "object" || !task.type) {
    res.status(400).json({ error: "task.type required" });
    return;
  }

  try {
    if (isUpstashConfigured()) {
      await pushHandoffTask({ ...task, source: task.source || "api" });
    } else {
      const entry = {
        id: `h_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        t: Date.now(),
        status: "pending",
        priority: 3,
        source: "api",
        ...task,
      };
      fs.mkdirSync(path.dirname(handoffPath), { recursive: true });
      fs.appendFileSync(handoffPath, `${JSON.stringify(entry)}\n`);
    }
    res.status(204).send();
  } catch {
    res.status(204).send();
  }
});

export default router;
