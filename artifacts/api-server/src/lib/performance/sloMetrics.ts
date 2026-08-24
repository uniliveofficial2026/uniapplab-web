import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export type SloSample = {
  actionId: string;
  platform: "web" | "ios" | "android";
  appVersion: string;
  deviceTier: string;
  networkClass: string;
  feedbackMs: number;
  usableMs: number;
  authorityMs: number;
  error?: boolean;
  timeout?: boolean;
  longTask?: boolean;
  fallback?: boolean;
};

type Bucket = {
  actionId: string;
  platform: string;
  appVersion: string;
  deviceTier: string;
  networkClass: string;
  feedback: number[];
  usable: number[];
  authority: number[];
  errors: number;
  timeouts: number;
  longTasks: number;
  fallbacks: number;
};

const buckets = new Map<string, Bucket>();
const MAX_PER_BUCKET = 200;

function keyOf(s: Pick<SloSample, "actionId" | "platform" | "appVersion" | "deviceTier" | "networkClass">): string {
  return [s.actionId, s.platform, s.appVersion, s.deviceTier, s.networkClass].join("|");
}

function percentile(values: number[], p: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx] ?? null;
}

const FORBIDDEN = /token|password|secret|authorization|messageContent|cardNumber|cvv|privateKey/i;

export function ingestSloSample(raw: unknown): { ok: boolean; error?: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "invalid" };
  const rec = raw as Record<string, unknown>;
  for (const [k, v] of Object.entries(rec)) {
    if (FORBIDDEN.test(k) || (typeof v === "string" && FORBIDDEN.test(v) && v.length > 40)) {
      return { ok: false, error: "forbidden_field" };
    }
  }
  const sample: SloSample = {
    actionId: String(rec.actionId || "").trim(),
    platform: rec.platform === "ios" || rec.platform === "android" ? rec.platform : "web",
    appVersion: String(rec.appVersion || "0").slice(0, 32),
    deviceTier: String(rec.deviceTier || "tier-2-medium").slice(0, 32),
    networkClass: String(rec.networkClass || "unknown").slice(0, 32),
    feedbackMs: Number(rec.feedbackMs),
    usableMs: Number(rec.usableMs),
    authorityMs: Number(rec.authorityMs),
    error: Boolean(rec.error),
    timeout: Boolean(rec.timeout),
    longTask: Boolean(rec.longTask),
    fallback: Boolean(rec.fallback),
  };
  if (!sample.actionId || !Number.isFinite(sample.feedbackMs) || !Number.isFinite(sample.usableMs)) {
    return { ok: false, error: "invalid_sample" };
  }
  const key = keyOf(sample);
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = {
      actionId: sample.actionId,
      platform: sample.platform,
      appVersion: sample.appVersion,
      deviceTier: sample.deviceTier,
      networkClass: sample.networkClass,
      feedback: [],
      usable: [],
      authority: [],
      errors: 0,
      timeouts: 0,
      longTasks: 0,
      fallbacks: 0,
    };
    buckets.set(key, bucket);
  }
  bucket.feedback.push(sample.feedbackMs);
  bucket.usable.push(sample.usableMs);
  if (Number.isFinite(sample.authorityMs)) bucket.authority.push(sample.authorityMs);
  if (sample.error) bucket.errors += 1;
  if (sample.timeout) bucket.timeouts += 1;
  if (sample.longTask) bucket.longTasks += 1;
  if (sample.fallback) bucket.fallbacks += 1;
  if (bucket.feedback.length > MAX_PER_BUCKET) bucket.feedback.shift();
  if (bucket.usable.length > MAX_PER_BUCKET) bucket.usable.shift();
  if (bucket.authority.length > MAX_PER_BUCKET) bucket.authority.shift();
  return { ok: true };
}

export function listSloAggregates() {
  return [...buckets.values()].map((b) => {
    const n = b.feedback.length || 1;
    return {
      actionId: b.actionId,
      platform: b.platform,
      appVersion: b.appVersion,
      deviceTier: b.deviceTier,
      networkClass: b.networkClass,
      samples: b.feedback.length,
      feedback: { p50: percentile(b.feedback, 50), p75: percentile(b.feedback, 75), p95: percentile(b.feedback, 95) },
      usable: { p50: percentile(b.usable, 50), p75: percentile(b.usable, 75), p95: percentile(b.usable, 95) },
      authority: { p50: percentile(b.authority, 50), p75: percentile(b.authority, 75), p95: percentile(b.authority, 95) },
      errorRate: b.errors / n,
      timeoutRate: b.timeouts / n,
      longTaskRate: b.longTasks / n,
      fallbackRate: b.fallbacks / n,
    };
  });
}

export function loadSloContract() {
  const candidates = [
    join(process.cwd(), "config/performance/critical-flows.json"),
    join(process.cwd(), "../config/performance/critical-flows.json"),
    join(process.cwd(), "../../config/performance/critical-flows.json"),
  ];
  const path = candidates.find((p) => existsSync(p));
  if (!path) return { flows: [], budgets: null };
  const flows = JSON.parse(readFileSync(path, "utf8"));
  const budgetPath = path.replace("critical-flows.json", "budgets.json");
  const budgets = existsSync(budgetPath) ? JSON.parse(readFileSync(budgetPath, "utf8")) : null;
  return { flows: flows.flows || [], budgets };
}

export function sloPublicationBlocked(metrics: Record<string, unknown> = {}): string[] {
  const failed: string[] = [];
  const feedbackP75 = Number(metrics.sloFeedbackP75Ms ?? metrics.feedbackP75Ms ?? NaN);
  const usableP75 = Number(metrics.sloUsableP75Ms ?? metrics.usableP75Ms ?? NaN);
  const longTask = Number(metrics.mainThreadLongTaskMs ?? NaN);
  if (Number.isFinite(feedbackP75) && feedbackP75 > 100) failed.push("oneSecondSloFails");
  if (Number.isFinite(usableP75) && usableP75 > 1000) failed.push("oneSecondSloFails");
  if (Number.isFinite(longTask) && longTask > 100) failed.push("oneSecondSloFails");
  return failed;
}
