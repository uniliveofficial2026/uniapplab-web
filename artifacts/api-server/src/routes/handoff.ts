import { Router, type IRouter } from "express";
import fs from "node:fs";
import path from "node:path";
import { isUpstashConfigured, pushHandoffTask, trimHandoffQueue } from "../lib/upstash";

const router: IRouter = Router();
const workspaceRoot = path.resolve(import.meta.dirname, "../../../..");
const handoffPath = path.join(workspaceRoot, ".local/handoff-queue.jsonl");
const PUBLIC_HANDOFF_TYPES = new Set(["health", "ux_learn"]);
const MAX_PUBLIC_QUEUE_ENTRIES = 200;

function truncate(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : undefined;
}

function sanitizePublicTask(task: Record<string, unknown>) {
  const type = truncate(task.type, 40);
  if (!type || !PUBLIC_HANDOFF_TYPES.has(type)) return null;
  return {
    type,
    reason: truncate(task.reason, 120),
    detail: truncate(task.detail, 500),
    screen: truncate(task.screen, 120),
    source: "api",
  };
}

function appendLocalTask(entry: Record<string, unknown>) {
  fs.mkdirSync(path.dirname(handoffPath), { recursive: true });
  let lines: string[] = [];
  try {
    lines = fs.readFileSync(handoffPath, "utf8").split("\n").filter(Boolean);
  } catch {
    lines = [];
  }
  lines.push(JSON.stringify(entry));
  fs.writeFileSync(handoffPath, `${lines.slice(-MAX_PUBLIC_QUEUE_ENTRIES).join("\n")}\n`);
}

router.post("/handoff/task", async (req, res) => {
  const task = req.body;
  if (!task || typeof task !== "object" || !task.type) {
    res.status(400).json({ error: "task.type required" });
    return;
  }

  // This endpoint is public browser telemetry, not a remote-control API for the worker.
  const publicTask = sanitizePublicTask(task as Record<string, unknown>);
  if (!publicTask) {
    res.status(204).send();
    return;
  }

  try {
    if (isUpstashConfigured()) {
      await pushHandoffTask(publicTask);
      await trimHandoffQueue(MAX_PUBLIC_QUEUE_ENTRIES);
    } else {
      const entry = {
        id: `h_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        t: Date.now(),
        status: "pending",
        priority: 3,
        ...publicTask,
      };
      appendLocalTask(entry);
    }
    res.status(204).send();
  } catch {
    res.status(204).send();
  }
});

export default router;
