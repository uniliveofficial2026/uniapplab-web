import { Router, type IRouter } from "express";
import fs from "node:fs";
import path from "node:path";
import { isUpstashConfigured, pushUxSignals } from "../lib/upstash";

const router: IRouter = Router();

const workspaceRoot = path.resolve(import.meta.dirname, "../../../..");
const signalsPath =
  process.env.UX_SIGNALS_PATH || path.join(workspaceRoot, ".local/ux-signals.jsonl");
const MAX_SIGNALS_PER_REQUEST = 20;
const MAX_LOCAL_SIGNALS = 500;
const ALLOWED_TYPES = new Set([
  "screen_view",
  "tap",
  "error",
  "warning",
  "media_fail",
  "heal",
  "rage_tap",
  "dwell",
  "intent",
]);
const ALLOWED_META_KEYS = new Set([
  "session",
  "platform",
  "os",
  "form",
  "shell",
  "touch",
  "count",
  "ms",
  "file",
  "line",
]);

function truncate(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : undefined;
}

function sanitizeMeta(meta: unknown): Record<string, string | number | boolean> | undefined {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return undefined;
  const sanitized: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(meta as Record<string, unknown>)) {
    if (!ALLOWED_META_KEYS.has(key)) continue;
    if (typeof value === "string") sanitized[key] = value.slice(0, 160);
    else if (typeof value === "number" && Number.isFinite(value)) sanitized[key] = value;
    else if (typeof value === "boolean") sanitized[key] = value;
  }
  return Object.keys(sanitized).length ? sanitized : undefined;
}

function sanitizeSignal(signal: unknown) {
  if (!signal || typeof signal !== "object" || Array.isArray(signal)) return null;
  const raw = signal as Record<string, unknown>;
  const type = truncate(raw.type, 40);
  if (!type || !ALLOWED_TYPES.has(type)) return null;
  return {
    t: typeof raw.t === "number" && Number.isFinite(raw.t) ? raw.t : Date.now(),
    type,
    screen: truncate(raw.screen, 120),
    detail: truncate(raw.detail, 500),
    meta: sanitizeMeta(raw.meta),
  };
}

function appendLocalSignals(signals: unknown[]): void {
  fs.mkdirSync(path.dirname(signalsPath), { recursive: true });
  let existing: string[] = [];
  try {
    existing = fs.readFileSync(signalsPath, "utf8").split("\n").filter(Boolean);
  } catch {
    existing = [];
  }
  const next = [...existing, ...signals.map((signal) => JSON.stringify(signal))];
  fs.writeFileSync(signalsPath, `${next.slice(-MAX_LOCAL_SIGNALS).join("\n")}\n`);
}

router.post("/ux/signals", async (req, res) => {
  const signals = req.body?.signals;
  if (!Array.isArray(signals) || signals.length === 0) {
    res.status(400).json({ error: "signals array required" });
    return;
  }

  const sanitized = signals
    .slice(0, MAX_SIGNALS_PER_REQUEST)
    .map(sanitizeSignal)
    .filter((signal): signal is NonNullable<ReturnType<typeof sanitizeSignal>> => Boolean(signal));
  if (sanitized.length === 0) {
    res.status(204).send();
    return;
  }

  try {
    if (isUpstashConfigured()) {
      await pushUxSignals(sanitized);
    } else {
      appendLocalSignals(sanitized);
    }
    res.status(204).send();
  } catch {
    res.status(204).send();
  }
});

export default router;
